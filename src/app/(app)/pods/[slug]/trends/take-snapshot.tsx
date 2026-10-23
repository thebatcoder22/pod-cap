"use client";

import { useActionState } from "react";
import { CameraIcon } from "@phosphor-icons/react";
import { takeSnapshotAction } from "../actions";

const field =
  "h-8 rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm font-medium shadow-card transition hover:bg-fill focus:outline-2 focus:outline-offset-1 focus:outline-accent";

/** The admin's way to take or retake a snapshot the sync missed. Checked again on the server. */
export function TakeSnapshot({
  podId,
  sprints,
}: {
  podId: number;
  sprints: { id: number; name: string; state: "active" | "future" | "closed" }[];
}) {
  const [state, take, taking] = useActionState(takeSnapshotAction, null);
  return (
    <form action={take} className="flex flex-wrap items-center gap-2.5 text-sm">
      <input type="hidden" name="podId" value={podId} />
      {/* Each label wraps with its select. */}
      <span className="flex items-center gap-2.5">
        <label htmlFor="snapshot-sprint" className="text-ink-muted">
          Sprint
        </label>
        <select id="snapshot-sprint" name="sprintId" className={field}>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.state === "active" ? " (active)" : ""}
            </option>
          ))}
        </select>
      </span>
      <span className="flex items-center gap-2.5">
        <label htmlFor="snapshot-kind" className="text-ink-muted">
          Snapshot
        </label>
        <select id="snapshot-kind" name="kind" className={field}>
          <option value="start">Start</option>
          <option value="close">Close</option>
        </select>
      </span>
      <button
        type="submit"
        disabled={taking}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium shadow-card transition hover:bg-fill active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        <CameraIcon size={16} aria-hidden />
        {taking ? "Taking…" : "Take snapshot"}
      </button>
      <span aria-live="polite" className={`text-sm ${state?.ok === false ? "text-danger" : "text-ink-muted"}`}>
        {!taking && state?.message}
      </span>
    </form>
  );
}
