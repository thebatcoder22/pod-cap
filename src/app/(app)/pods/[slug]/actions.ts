"use server";

import { refresh } from "next/cache";
import type { Skill } from "@/db/schema";
import { ForbiddenError } from "@/server/permissions";
import { setProficiency } from "@/server/people";
import { getViewer } from "@/server/session";
import { ValidationError } from "@/server/settings";
import { syncNow } from "@/server/sync";

export type SyncState = { ok: boolean; message: string; at: number } | null;

const MESSAGES = {
  succeeded: "Synced.",
  skipped: "A sync is already running. Its results show here when it finishes.",
  // The banner above carries the reason.
  failed: "Sync failed.",
};

export async function syncNowAction(): Promise<SyncState> {
  try {
    const { status } = await syncNow(await getViewer());
    refresh();
    return { ok: status !== "failed", message: MESSAGES[status], at: Date.now() };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message, at: Date.now() };
    throw e;
  }
}

/** Null once saved: the refreshed value is the confirmation. */
export type ProficiencyState = { error: string } | null;

export async function setProficiencyAction(_: ProficiencyState, form: FormData): Promise<ProficiencyState> {
  try {
    await setProficiency(
      await getViewer(),
      Number(form.get("personId") || NaN),
      String(form.get("skill")) as Skill,
      Number(form.get("percent") || NaN),
    );
    refresh();
    return null;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}
