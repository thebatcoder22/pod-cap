"use server";

import { refresh } from "next/cache";
import type { Skill, SnapshotKind, TshirtSize } from "@/db/schema";
import { setLeave } from "@/server/capacity";
import { setEpicSize } from "@/server/epics";
import { addManualItem, deleteManualItem, updateManualItem, type ManualItemInput } from "@/server/manual-items";
import { ForbiddenError } from "@/server/permissions";
import { setProficiency } from "@/server/people";
import { getViewer } from "@/server/session";
import { ValidationError } from "@/server/settings";
import { takeSnapshot } from "@/server/snapshots";
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
export type CellState = { error: string } | null;

const num = (form: FormData, name: string) => Number(form.get(name) || NaN);

async function saveCell(work: () => Promise<void>): Promise<CellState> {
  try {
    await work();
    refresh();
    return null;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function setProficiencyAction(_: CellState, form: FormData): Promise<CellState> {
  return saveCell(async () =>
    setProficiency(await getViewer(), num(form, "personId"), String(form.get("skill")) as Skill, num(form, "percent")),
  );
}

export async function setLeaveAction(_: CellState, form: FormData): Promise<CellState> {
  return saveCell(async () =>
    setLeave(await getViewer(), num(form, "personId"), num(form, "sprintId"), num(form, "days")),
  );
}

export async function setEpicSizeAction(_: CellState, form: FormData): Promise<CellState> {
  return saveCell(async () =>
    setEpicSize(
      await getViewer(),
      String(form.get("key")),
      (String(form.get("size") ?? "") || null) as TshirtSize | null,
    ),
  );
}

/** Echoes what was typed when the save is refused, so nothing is lost. `at` remounts the form on each result. */
export type ItemState = { ok: boolean; error?: string; fields?: Record<string, string>; at: number } | null;

const itemInput = (form: FormData): ManualItemInput => ({
  kind: String(form.get("kind")) as ManualItemInput["kind"],
  title: String(form.get("title") ?? ""),
  personId: form.get("personId") ? num(form, "personId") : null,
  skill: String(form.get("skill")) as Skill,
  days: num(form, "days"),
  jiraKey: String(form.get("jiraKey") ?? "") || null,
});

async function saveItem(form: FormData, work: () => Promise<unknown>): Promise<ItemState> {
  try {
    await work();
    refresh();
    return { ok: true, at: Date.now() };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) {
      const fields = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
      return { ok: false, error: e.message, fields, at: Date.now() };
    }
    throw e;
  }
}

export async function addManualItemAction(_: ItemState, form: FormData): Promise<ItemState> {
  return saveItem(form, async () =>
    addManualItem(await getViewer(), {
      ...itemInput(form),
      podId: num(form, "podId"),
      sprintId: num(form, "sprintId"),
    }),
  );
}

export async function updateManualItemAction(_: ItemState, form: FormData): Promise<ItemState> {
  return saveItem(form, async () => updateManualItem(await getViewer(), num(form, "id"), itemInput(form)));
}

export async function deleteManualItemAction(_: ItemState, form: FormData): Promise<ItemState> {
  return saveItem(form, async () => deleteManualItem(await getViewer(), num(form, "id")));
}

export async function takeSnapshotAction(_: SyncState, form: FormData): Promise<SyncState> {
  const kind = String(form.get("kind")) as SnapshotKind;
  try {
    await takeSnapshot(await getViewer(), num(form, "podId"), num(form, "sprintId"), kind);
    refresh();
    return { ok: true, message: kind === "start" ? "Start snapshot taken." : "Close snapshot taken.", at: Date.now() };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) {
      return { ok: false, message: e.message, at: Date.now() };
    }
    throw e;
  }
}
