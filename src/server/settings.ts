import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { allowlist, holidays, jiraSettings, planningSettings } from "@/db/schema";
import { normalizeEmail } from "./access";
import { createJiraClient, JiraError, type JiraCredentials, type MakeJiraClient } from "./jira-client";
import { assertAdmin } from "./permissions";
import { decryptSecret, encryptSecret } from "./secrets";
import type { Viewer } from "./viewer";

const JIRA_PROJECT = "DTP";

/** Bad input the admin can fix. The message is shown as is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ---- Jira connection ----

/** Everything about the connection except the token itself. */
export async function getJiraSettings(viewer: Viewer | null) {
  assertAdmin(viewer);
  const [row] = await db
    .select({ site: jiraSettings.site, email: jiraSettings.email, tokenUpdatedAt: jiraSettings.tokenUpdatedAt })
    .from(jiraSettings);
  return row ?? null;
}

/** A blank token keeps the current one. A new token replaces it outright. */
export async function saveJiraSettings(viewer: Viewer | null, input: { site: string; email: string; token: string }) {
  assertAdmin(viewer);
  const site = parseSite(input.site);
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter the Jira account email.");
  const token = input.token.trim();

  if (!token) {
    const updated = await db.update(jiraSettings).set({ site, email }).returning({ id: jiraSettings.id });
    if (!updated.length) throw new ValidationError("Enter an API token.");
    return;
  }
  const values = { site, email, tokenCiphertext: encryptSecret(token), tokenUpdatedAt: new Date() };
  await db.insert(jiraSettings).values(values).onConflictDoUpdate({ target: jiraSettings.id, set: values });
}

/** Jira Cloud only, so the token can only ever be sent to an Atlassian site. */
function parseSite(raw: string) {
  const input = raw.trim();
  let url: URL | null = null;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
  } catch {}
  if (url?.protocol !== "https:" || !url.hostname.endsWith(".atlassian.net") || url.port) {
    throw new ValidationError("Enter your Jira Cloud site, like delightree.atlassian.net.");
  }
  return url.origin;
}

export async function loadJiraCredentials(): Promise<JiraCredentials | null> {
  const [row] = await db.select().from(jiraSettings);
  if (!row) return null;
  try {
    return { site: row.site, email: row.email, token: decryptSecret(row.tokenCiphertext) };
  } catch {
    throw new ValidationError(
      "The saved API token cannot be decrypted, so ENCRYPTION_KEY has probably changed. Paste the token again and save.",
    );
  }
}

export type ConnectionResult =
  | { ok: true; message: string }
  | { ok: false; reason: "not-configured" | "bad-credentials" | "no-project-access" | "unreachable"; message: string };

/** Confirms the saved token can read the DTP project. */
export async function testJiraConnection(
  viewer: Viewer | null,
  makeClient: MakeJiraClient = createJiraClient,
): Promise<ConnectionResult> {
  assertAdmin(viewer);
  let creds;
  try {
    creds = await loadJiraCredentials();
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, reason: "not-configured", message: e.message };
    throw e;
  }
  if (!creds) return { ok: false, reason: "not-configured", message: "Save the Jira site, email and token first." };
  const jira = makeClient(creds);

  let me;
  try {
    me = await jira.myself();
    const project = await jira.getProject(JIRA_PROJECT);
    return { ok: true, message: `Connected as ${me.displayName}. ${project.key} (${project.name}) is readable.` };
  } catch (e) {
    if (!(e instanceof JiraError)) throw e;
    if (e.kind === "unreachable") return { ok: false, reason: "unreachable", message: e.message };
    // /myself only 404s when there is no Jira site at that address.
    if (!me && e.kind === "not-found") {
      return {
        ok: false,
        reason: "unreachable",
        message: `No Jira site answers at ${creds.site}. Check the site address.`,
      };
    }
    if (!me || e.kind === "unauthorized") {
      return {
        ok: false,
        reason: "bad-credentials",
        message: `Jira rejected the email and token. Check that the token belongs to ${creds.email}, has not expired, and that the account has Jira access.`,
      };
    }
    return {
      ok: false,
      reason: "no-project-access",
      message: `Signed in as ${me.displayName}, but that account cannot read the ${JIRA_PROJECT} project.`,
    };
  }
}

// ---- Allowlist ----

export async function listAllowlist(viewer: Viewer | null) {
  assertAdmin(viewer);
  return db
    .select({ email: allowlist.email, isAdmin: allowlist.isAdmin })
    .from(allowlist)
    .orderBy(asc(allowlist.email));
}

export async function addAllowlisted(viewer: Viewer | null, rawEmail: string) {
  assertAdmin(viewer);
  const email = normalizeEmail(rawEmail);
  // Google sign-in only admits the delightree.com workspace.
  if (!/^[^\s@]+@delightree\.com$/.test(email)) throw new ValidationError("Enter a @delightree.com address.");
  await db.insert(allowlist).values({ email }).onConflictDoNothing();
}

export async function removeAllowlisted(viewer: Viewer | null, rawEmail: string) {
  assertAdmin(viewer);
  const email = normalizeEmail(rawEmail);
  if (email === viewer.email) throw new ValidationError("You cannot remove your own address.");

  await db.transaction(async (tx) => {
    // Locking every admin row serialises concurrent removals, so two admins cannot remove each other.
    const admins = await tx.select().from(allowlist).where(eq(allowlist.isAdmin, true)).for("update");
    if (admins.some((a) => a.email === email) && admins.length <= 1) {
      throw new ValidationError(`${email} is the last admin and cannot be removed.`);
    }
    await tx.delete(allowlist).where(eq(allowlist.email, email));
  });
}

// ---- Capacity planning ----

const DEFAULT_FOCUS_PERCENT = 70;

/** Read by every capacity sheet, so any signed-in lead may read it. */
export async function getPlanningSettings() {
  const [[row], days] = await Promise.all([
    db.select().from(planningSettings),
    db.select().from(holidays).orderBy(asc(holidays.date)),
  ]);
  return { focusPercent: row?.focusPercent ?? DEFAULT_FOCUS_PERCENT, holidays: days };
}

/** Adds a company holiday, or renames the one already on that date. */
export async function addHoliday(viewer: Viewer | null, input: { date: string; name: string }) {
  assertAdmin(viewer);
  const date = parseDay(input.date);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Name the holiday.");
  await db.insert(holidays).values({ date, name }).onConflictDoUpdate({ target: holidays.date, set: { name } });
}

export async function setFocusFactor(viewer: Viewer | null, percent: number) {
  assertAdmin(viewer);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100)
    throw new ValidationError("Enter a whole number from 1 to 100.");
  await db
    .insert(planningSettings)
    .values({ focusPercent: percent })
    .onConflictDoUpdate({ target: planningSettings.id, set: { focusPercent: percent } });
}

export async function removeHoliday(viewer: Viewer | null, date: string) {
  assertAdmin(viewer);
  await db.delete(holidays).where(eq(holidays.date, parseDay(date)));
}

/** A YYYY-MM-DD date. Round-tripping through Date refuses 2026-02-30 as well. */
function parseDay(raw: string) {
  const date = raw.trim();
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) {
    throw new ValidationError("Pick a date.");
  }
  return date;
}
