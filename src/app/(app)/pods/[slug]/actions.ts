"use server";

import { refresh } from "next/cache";
import { ForbiddenError } from "@/server/permissions";
import { getViewer } from "@/server/session";
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
