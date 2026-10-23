import { desc, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  epics,
  SKILLS,
  sprints,
  syncRuns,
  tickets,
  type Estimates,
  type JiraUser,
  type Skill,
  type StatusCategory,
} from "@/db/schema";
import { createJiraClient, JiraError, type JiraField, type JiraIssue, type MakeJiraClient } from "./jira-client";
import { linkJiraAccounts } from "./people";
import { ForbiddenError } from "./permissions";
import { loadJiraCredentials, ValidationError } from "./settings";
import type { Viewer } from "./viewer";

export const BOARD_ID = 267;
const EPIC = "Epic";
const PLANNABLE_TYPES = ["Story", "Improvement", "Tech Story", "Bug", "Prod Bug", "Dev Custom Task"];
// Epics come in the same search: they carry the POD and Ready for Production Date fields too.
const JQL = `project = DTP AND issuetype in (${[...PLANNABLE_TYPES, EPIC].map((t) => `"${t}"`).join(", ")})`;
// DTP's custom field ids, verified against the live project (see SPEC.md "Jira mapping").
const FIELD = {
  pod: "customfield_11457",
  devOwners: "customfield_10777",
  sprint: "customfield_10020",
  readyForProduction: "customfield_10946",
} as const;
const FIELDS = ["summary", "issuetype", "status", "priority", "assignee", "parent", ...Object.values(FIELD)];

/** Estimate fields by skill, found by name: Data Days and AI Days start counting once the Jira admin adds them. */
export function estimateFields(fields: JiraField[]) {
  const ids = new Map<Skill, string>();
  for (const skill of SKILLS) {
    const field = fields.find((f) => f.name === `${skill} Days` && f.schema?.type === "number");
    if (field) ids.set(skill, field.id);
  }
  return ids;
}

export type SyncResult = { status: "succeeded" } | { status: "skipped" } | { status: "failed"; error: string };

/** "Sync now": any signed-in lead may pull from Jira. */
export async function syncNow(viewer: Viewer | null, makeClient?: MakeJiraClient) {
  if (!viewer) throw new ForbiddenError("Sign in to sync with Jira.");
  return runSync(makeClient);
}

/**
 * Pulls every sprint on the board and every plannable DTP ticket and epic, replacing the previous copy.
 * Shared by the hourly cron and "Sync now". Returns "skipped" when another sync holds the lock.
 */
export async function runSync(makeClient: MakeJiraClient = createJiraClient): Promise<SyncResult> {
  // A transaction-scoped lock is released however the run ends, and works through Neon's pooler.
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtext('jira-sync')) as locked`,
    );
    if (!rows[0].locked) return { status: "skipped" } as const;

    // Holding the lock means any run still marked running was cut off (e.g. by a function timeout).
    await tx
      .update(syncRuns)
      .set({ status: "failed", finishedAt: syncRuns.startedAt, error: "Stopped before it finished." })
      .where(eq(syncRuns.status, "running"));
    // Written outside the transaction so the page can show the run while it is in flight.
    const [run] = await db.insert(syncRuns).values({}).returning({ id: syncRuns.id });

    let result: SyncResult;
    try {
      const creds = await loadJiraCredentials();
      if (!creds) throw new ValidationError("Jira is not connected yet. The admin can connect it in Settings.");
      const jira = makeClient(creds);
      const estimateIds = estimateFields(await jira.listFields());
      const [pagedSprints, pagedIssues] = await Promise.all([
        jira.listSprints(BOARD_ID),
        jira.searchIssues(JQL, [...FIELDS, ...estimateIds.values()]),
      ]);

      // Jira's pages can overlap when data changes mid-sync; keep one copy of each.
      const boardSprints = [...new Map(pagedSprints.map((s) => [s.id, s])).values()];
      const issues = [...new Map(pagedIssues.map((i) => [i.key, i])).values()];

      // A savepoint, so a failed write leaves the previous sync's data in place.
      await tx.transaction(async (w) => {
        const sprintRows = boardSprints.map((s) => ({
          id: s.id,
          name: s.name,
          state: s.state,
          startDate: toDate(s.startDate),
          endDate: toDate(s.endDate),
          completeDate: toDate(s.completeDate),
        }));
        if (sprintRows.length) {
          await w
            .insert(sprints)
            .values(sprintRows)
            .onConflictDoUpdate({
              target: sprints.id,
              set: {
                name: sql`excluded.name`,
                state: sql`excluded.state`,
                startDate: sql`excluded.start_date`,
                endDate: sql`excluded.end_date`,
                completeDate: sql`excluded.complete_date`,
              },
            });
        }
        await w.delete(sprints).where(
          sprintRows.length
            ? notInArray(
                sprints.id,
                sprintRows.map((s) => s.id),
              )
            : undefined,
        );

        // ponytail: full replace of ~3k rows each hour; switch to upserts if other tables start referencing tickets.
        await w.delete(tickets);
        const rows = issues.filter(isPlannable).map((i) => toTicket(i, estimateIds));
        for (let i = 0; i < rows.length; i += 500) await w.insert(tickets).values(rows.slice(i, i + 500));
        await w.delete(epics);
        const epicRows = issues.filter((i) => fieldsOf(i).issuetype.name === EPIC).map(toEpic);
        if (epicRows.length) await w.insert(epics).values(epicRows);
        await linkJiraAccounts(w);
      });
      result = { status: "succeeded" };
    } catch (e) {
      result = { status: "failed", error: describe(e) };
    }

    await tx
      .update(syncRuns)
      .set({
        status: result.status === "succeeded" ? "succeeded" : "failed",
        finishedAt: new Date(),
        error: result.status === "failed" ? result.error : null,
      })
      .where(eq(syncRuns.id, run.id));
    return result;
  });
}

export type SyncStatus = {
  lastSuccessAt: Date | null;
  /** The latest finished run, when it failed. */
  failure: { at: Date; error: string } | null;
  running: boolean;
};

export async function getSyncStatus(): Promise<SyncStatus> {
  const [[success], [latest], [running]] = await Promise.all([
    db
      .select({ at: syncRuns.finishedAt })
      .from(syncRuns)
      .where(eq(syncRuns.status, "succeeded"))
      .orderBy(desc(syncRuns.finishedAt))
      .limit(1),
    db.select().from(syncRuns).where(isNotNull(syncRuns.finishedAt)).orderBy(desc(syncRuns.finishedAt)).limit(1),
    db.select({ id: syncRuns.id }).from(syncRuns).where(eq(syncRuns.status, "running")).limit(1),
  ]);
  return {
    lastSuccessAt: success?.at ?? null,
    failure: latest?.status === "failed" ? { at: latest.finishedAt!, error: latest.error ?? "Unknown error." } : null,
    running: Boolean(running),
  };
}

// ---- Mapping Jira's issue JSON ----

type Named = { name: string };
type IssueFields = {
  summary: string;
  issuetype: Named & { subtask: boolean };
  status: Named & { statusCategory: { key: StatusCategory } };
  priority: Named | null;
  assignee: JiraUser | null;
  parent?: { key: string; fields: { summary: string; issuetype: Named } };
  [FIELD.pod]: { value: string } | null;
  [FIELD.devOwners]: JiraUser[] | null;
  [FIELD.sprint]: { id: number }[] | null;
  [FIELD.readyForProduction]: string | null;
};

const fieldsOf = (issue: JiraIssue) => issue.fields as IssueFields;

function isPlannable(issue: JiraIssue) {
  const { issuetype } = fieldsOf(issue);
  return !issuetype.subtask && PLANNABLE_TYPES.includes(issuetype.name);
}

const user = (u: JiraUser): JiraUser => ({
  accountId: u.accountId,
  displayName: u.displayName,
  ...(u.emailAddress ? { emailAddress: u.emailAddress } : {}),
});

function toTicket(issue: JiraIssue, estimateIds: Map<Skill, string>): typeof tickets.$inferInsert {
  const f = fieldsOf(issue);
  const estimates: Estimates = {};
  for (const [skill, id] of estimateIds) {
    const days = issue.fields[id];
    // Jira number fields are null when empty; 0 is a real estimate.
    if (typeof days === "number" && days >= 0) estimates[skill] = days;
  }
  const epic = f.parent?.fields.issuetype.name === EPIC ? f.parent : null;
  return {
    key: issue.key,
    summary: f.summary,
    type: f.issuetype.name,
    status: f.status.name,
    statusCategory: f.status.statusCategory.key,
    priority: f.priority?.name ?? null,
    pod: f[FIELD.pod]?.value ?? null,
    sprintIds: (f[FIELD.sprint] ?? []).map((s) => s.id),
    assignee: f.assignee ? user(f.assignee) : null,
    devOwners: (f[FIELD.devOwners] ?? []).map(user),
    epicKey: epic?.key ?? null,
    epicSummary: epic?.fields.summary ?? null,
    readyForProductionDate: f[FIELD.readyForProduction] ?? null,
    estimates,
  };
}

function toEpic(issue: JiraIssue): typeof epics.$inferInsert {
  const f = fieldsOf(issue);
  return {
    key: issue.key,
    summary: f.summary,
    status: f.status.name,
    statusCategory: f.status.statusCategory.key,
    pod: f[FIELD.pod]?.value ?? null,
    readyForProductionDate: f[FIELD.readyForProduction] ?? null,
  };
}

const toDate = (iso?: string) => (iso ? new Date(iso) : null);

/** The reason shown on the failed-sync banner. */
function describe(e: unknown): string {
  if (e instanceof JiraError) {
    if (e.kind === "unauthorized")
      return "Jira rejected the saved API token (401). The admin can replace it in Settings.";
    if (e.kind === "forbidden") return `The Jira account cannot read DTP or board ${BOARD_ID} (403). ${e.message}`;
    return e.message;
  }
  if (e instanceof ValidationError) return e.message;
  return `Unexpected error: ${e instanceof Error ? e.message : String(e)}`;
}
