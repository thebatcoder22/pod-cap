import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { ActionState } from "./actions";

// The look every settings form shares, and how they report results.

export const focus = "focus:outline-2 focus:outline-offset-1 focus:outline-accent";
export const input = `h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm shadow-card placeholder:text-ink-faint ${focus}`;
export const primary =
  "h-9 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
export const select = `h-9 rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm shadow-card transition hover:bg-fill ${focus}`;
export const list = "divide-y divide-line";
export const row = "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm";
export const secondary =
  "h-9 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium shadow-card transition hover:bg-fill active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
export const ghostDanger =
  "h-9 rounded-lg px-2.5 text-sm text-ink-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50";
/** The action bar at the bottom of a settings panel. */
export const footer = "flex flex-wrap items-center gap-3 border-t border-line bg-fill/50 px-5 py-3";

/** Shows the most recent of the form's action results, so an older one never lingers as if current. */
export function Result({ states }: { states: ActionState[] }) {
  const state = states.reduce((a, b) => ((b?.at ?? 0) > (a?.at ?? 0) ? b : a), null);
  if (!state) return null;
  const Icon = state.ok ? CheckCircleIcon : WarningCircleIcon;
  return (
    <p className={`flex items-start gap-2 text-sm ${state.ok ? "text-success" : "text-danger"}`}>
      <Icon size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      {state.message}
    </p>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Live({ states }: { states: ActionState[] }) {
  return (
    <div aria-live="polite" className="border-b border-line bg-fill/50 px-5 py-2.5 empty:hidden">
      <Result states={states} />
    </div>
  );
}
