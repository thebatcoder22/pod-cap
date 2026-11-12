"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

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
    <div className="flex items-center gap-2.5 text-sm">
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
        className={`h-8 rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm font-medium shadow-card transition hover:bg-fill focus:outline-2 focus:outline-offset-1 focus:outline-accent ${pending ? "opacity-60" : ""}`}
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
