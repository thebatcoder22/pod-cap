"use server";

import { refresh } from "next/cache";
import { ForbiddenError } from "@/server/permissions";
import { getViewer } from "@/server/session";
import { syncNow, type SyncResult } from "@/server/sync";

export type SyncState = { ok: boolean; message: string; at: number } | null;

const MESSAGES: Record<SyncResult["status"], string> = {
  // Empty: the refreshed "Synced" time is the confirmation.
  succeeded: "",
  skipped: "A sync is already running. Its results show when it finishes.",
  // The pod page's banner carries the reason.
  failed: "Sync failed.",
};

/** The sidebar's "Sync with Jira", on every page. */
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
