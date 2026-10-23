"use client";

import { useActionState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { syncNowAction } from "./actions";

export function SyncNowButton() {
  const [state, sync, syncing] = useActionState(syncNowAction, null);
  return (
    <form action={sync} className="flex items-center gap-3">
      <span aria-live="polite" className={`text-sm ${state?.ok === false ? "text-danger" : "text-ink-muted"}`}>
        {!syncing && state?.message}
      </span>
      <button
        type="submit"
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium transition hover:bg-line/60 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        <ArrowsClockwiseIcon size={16} aria-hidden className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </form>
  );
}

type Option = { id: number; name: string; state: "active" | "future" | "closed" };
const GROUPS = [
  ["active", "Active"],
  ["future", "Upcoming"],
  ["closed", "Closed"],
] as const;

export function SprintPicker({ sprints, selected }: { sprints: Option[]; selected: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="sprint-picker" className="text-ink-muted">
        Sprint
      </label>
      <select
        id="sprint-picker"
        value={selected}
        aria-busy={pending}
        onChange={(e) => {
          const sprint = e.target.value;
          startTransition(() => router.push(`${pathname}?sprint=${sprint}`, { scroll: false }));
        }}
        className={`rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium focus:outline-2 focus:outline-accent ${pending ? "opacity-60" : ""}`}
      >
        {GROUPS.map(([state, label]) => {
          const options = sprints.filter((s) => s.state === state);
          return options.length ? (
            <optgroup key={state} label={label}>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}
