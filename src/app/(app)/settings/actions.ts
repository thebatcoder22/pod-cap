"use server";

import { refresh } from "next/cache";
import { normalizeEmail } from "@/server/access";
import { ForbiddenError } from "@/server/permissions";
import { getViewer } from "@/server/session";
import {
  addAllowlisted,
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
      return `${normalizeEmail(email)} can now sign in.`;
    },
    { email },
  );
}

export async function removeAllowlistAction(_: ActionState, form: FormData) {
  const email = text(form, "email");
  return run(async () => {
    await removeAllowlisted(await getViewer(), email);
    return `${normalizeEmail(email)} can no longer sign in.`;
  });
}
