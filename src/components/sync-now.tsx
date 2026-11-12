"use client";

import { useActionState } from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { syncNowAction } from "@/app/(app)/actions";

/** What the sidebar says about the last sync, worked out on the server. */
export type SyncLine = { text: string; failed: boolean };

/**
 * "Sync with Jira", for every page: a button at the top of the sidebar, above the pods, with the last sync under
 * it, or an icon in the small-screen top bar.
 */
export function SyncNow({ line, compact = false }: { line: SyncLine; compact?: boolean }) {
  const [state, sync, syncing] = useActionState(syncNowAction, null);
  // After a run, its own message when it has one; a success shows the refreshed time instead.
  const message = syncing ? "Pulling sprints and tickets…" : state?.message || line.text;
  const failed = syncing ? false : state?.message ? !state.ok : line.failed;
  const icon = (size: number) => (
    <ArrowsClockwiseIcon size={size} aria-hidden className={syncing ? "animate-spin" : ""} />
  );

  if (compact)
    return (
      <form action={sync}>
        <button
          type="submit"
          disabled={syncing}
          title={message}
          className="grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-fill hover:text-ink active:scale-[0.96] disabled:opacity-60"
        >
          {icon(18)}
          <span className="sr-only">{syncing ? "Syncing with Jira" : "Sync with Jira"}</span>
        </button>
        <span aria-live="polite" className="sr-only">
          {!syncing && state?.message}
        </span>
      </form>
    );

  return (
    <form action={sync}>
      <button
        type="submit"
        disabled={syncing}
        className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink shadow-card transition hover:bg-fill active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
      >
        {icon(16)}
        {syncing ? "Syncing…" : "Sync with Jira"}
      </button>
      <p aria-live="polite" className={`mt-1.5 px-2 text-center text-xs ${failed ? "text-danger" : "text-ink-faint"}`}>
        {message}
      </p>
    </form>
  );
}
