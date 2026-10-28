"use server";

import { refresh } from "next/cache";
import type { Skill } from "@/db/schema";
import { normalizeEmail } from "@/server/access";
import { addFromJira, addToPod, confirmJiraAccount, movePerson, removePerson, setShare } from "@/server/people";
import { ForbiddenError } from "@/server/permissions";
import { getViewer } from "@/server/session";
import {
  addAllowlisted,
  addHoliday,
  removeHoliday,
  setFocusFactor,
  removeAllowlisted,
  saveJiraSettings,
  testJiraConnection,
  ValidationError,
} from "@/server/settings";

// Every action re-reads the viewer; the settings service refuses non-admins.

// `at` lets a form with two actions show only the latest result.
export type ActionState = { ok: boolean; message: string; at: number; fields?: Record<string, string> } | null;

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

async function run(work: () => Promise<string>, fields?: Record<string, string>): Promise<ActionState> {
  try {
    const message = await work();
    refresh();
    return { ok: true, message, at: Date.now() };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError)
      return { ok: false, message: e.message, at: Date.now(), fields };
    throw e;
  }
}

export async function saveJiraAction(_: ActionState, form: FormData) {
  const input = { site: text(form, "site"), email: text(form, "email"), token: text(form, "token") };
  return run(
    async () => {
      await saveJiraSettings(await getViewer(), input);
      return input.token.trim() ? "Saved. The new token is in use." : "Saved.";
    },
    // Never echo the token back.
    { site: input.site, email: input.email },
  );
}

export async function testJiraAction(): Promise<ActionState> {
  try {
    const { ok, message } = await testJiraConnection(await getViewer());
    return { ok, message, at: Date.now() };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message, at: Date.now() };
    throw e;
  }
}

export async function addAllowlistAction(_: ActionState, form: FormData) {
  const email = text(form, "email");
  return run(
    async () => {
      await addAllowlisted(await getViewer(), email);
      return `${normalizeEmail(email)} can now edit their pod.`;
    },
    { email },
  );
}

export async function removeAllowlistAction(_: ActionState, form: FormData) {
  const email = text(form, "email");
  return run(async () => {
    await removeAllowlisted(await getViewer(), email);
    return `${normalizeEmail(email)} is now read only.`;
  });
}

// ---- People ----

const intField = (form: FormData, name: string) => Number(text(form, name) || NaN);

export async function confirmJiraAccountAction(_: ActionState, form: FormData) {
  return run(async () => {
    const { name, jira } = await confirmJiraAccount(
      await getViewer(),
      intField(form, "personId"),
      text(form, "accountId"),
    );
    return `${name} is linked to ${jira} in Jira.`;
  });
}

export async function addFromJiraAction(_: ActionState, form: FormData) {
  return run(async () => {
    const { name, pod } = await addFromJira(await getViewer(), {
      accountId: text(form, "accountId"),
      podId: intField(form, "podId"),
      mainSkill: text(form, "mainSkill") as Skill,
    });
    return `${name} joined ${pod}.`;
  });
}

export async function movePersonAction(_: ActionState, form: FormData) {
  return run(async () => {
    const { name, pod } = await movePerson(
      await getViewer(),
      intField(form, "personId"),
      intField(form, "fromPodId"),
      intField(form, "podId"),
    );
    return `${name} moved to ${pod}.`;
  });
}

export async function addToPodAction(_: ActionState, form: FormData) {
  return run(async () => {
    const { name, pod } = await addToPod(await getViewer(), intField(form, "personId"), intField(form, "podId"));
    return `${name} is also in ${pod} now, with half of their time in each pod.`;
  });
}

export async function setShareAction(_: ActionState, form: FormData) {
  return run(async () => {
    const { name, pod, share, other } = await setShare(
      await getViewer(),
      intField(form, "personId"),
      intField(form, "podId"),
      intField(form, "share"),
    );
    return `${pod} now plans with ${share}% of ${name}'s time, and ${other.pod} with ${other.share}%.`;
  });
}

export async function removePersonAction(_: ActionState, form: FormData) {
  return run(async () => {
    const { name, pod, stillIn } = await removePerson(
      await getViewer(),
      intField(form, "personId"),
      intField(form, "podId"),
    );
    return stillIn
      ? `${name} left ${pod} and now spends all of their time in ${stillIn}.`
      : `${name} was removed and no longer counts toward any pod.`;
  });
}

// ---- Capacity planning ----

export async function setFocusFactorAction(_: ActionState, form: FormData) {
  const percent = text(form, "percent");
  return run(
    async () => {
      await setFocusFactor(await getViewer(), Number(percent || NaN));
      return `Capacity now plans ${percent}% of available days.`;
    },
    { percent },
  );
}

export async function addHolidayAction(_: ActionState, form: FormData) {
  const fields = { date: text(form, "date"), name: text(form, "name") };
  return run(async () => {
    await addHoliday(await getViewer(), fields);
    return `${fields.name.trim()} is a holiday for every pod.`;
  }, fields);
}

export async function removeHolidayAction(_: ActionState, form: FormData) {
  return run(async () => {
    await removeHoliday(await getViewer(), text(form, "date"));
    return "Holiday removed.";
  });
}
