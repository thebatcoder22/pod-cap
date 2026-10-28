// Pieces shared by the pod page's sections.
import {
  CaretDoubleDownIcon,
  CaretDoubleUpIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  EqualsIcon,
} from "@phosphor-icons/react/dist/ssr";
import { SKILLS, type Skill } from "@/db/schema";
import { Avatar } from "@/components/brand";
import type { SprintView } from "@/server/sprints";
import type { CapacitySheet } from "@/server/capacity";

export type Ticket = SprintView["tickets"][number];
export type LoadTicket = CapacitySheet["load"]["tickets"][number];
export type Category = Ticket["statusCategory"];

export const card = "overflow-hidden rounded-lg border border-line bg-surface shadow-card";
export const cardTitle = "text-sm font-medium";
export const badge = "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium";
/** Sets the order a section rises in on load. */
export const rise = (i: number) => ({ className: "rise", style: { "--i": i } as React.CSSProperties });
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Display order: the work in flight first, as a lead scans a sprint. */
export const GROUPS: { category: Category; label: string }[] = [
  { category: "indeterminate", label: "In progress" },
  { category: "new", label: "To do" },
  { category: "done", label: "Done" },
];

export const CATEGORY = {
  new: { Icon: CircleDashedIcon, weight: "bold", color: "text-ink-faint", bar: "bg-line-strong" },
  indeterminate: { Icon: CircleHalfIcon, weight: "fill", color: "text-accent", bar: "bg-accent" },
  done: { Icon: CheckCircleIcon, weight: "fill", color: "text-success", bar: "bg-success" },
} as const;

export function StatusIcon({ category, size = 16 }: { category: Category; size?: number }) {
  const { Icon, weight, color } = CATEGORY[category];
  return <Icon size={size} weight={weight} className={`shrink-0 ${color}`} aria-hidden />;
}

// Jira's own priority glyphs, so the scale reads the same as in Jira.
const PRIORITY: Record<string, { Icon: typeof EqualsIcon; color: string }> = {
  Highest: { Icon: CaretDoubleUpIcon, color: "text-danger" },
  High: { Icon: CaretUpIcon, color: "text-warning" },
  Medium: { Icon: EqualsIcon, color: "text-ink-faint" },
  Low: { Icon: CaretDownIcon, color: "text-accent" },
  Lowest: { Icon: CaretDoubleDownIcon, color: "text-accent" },
};

export function Priority({ name }: { name: string | null }) {
  if (!name) return <span className="text-ink-faint">None</span>;
  const p = PRIORITY[name];
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      {p && <p.Icon size={15} weight="bold" className={p.color} aria-hidden />}
      {name}
    </span>
  );
}

export function Owners({ owners }: { owners: Ticket["owners"] }) {
  if (!owners.length) return <span className="text-ink-faint">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 -space-x-0.5">
        {owners.slice(0, 3).map((o) => (
          <Avatar key={o.accountId} name={o.displayName} size="sm" ring />
        ))}
      </span>
      <span className="min-w-0 truncate text-ink-muted" title={owners.map((o) => o.displayName).join(", ")}>
        {owners.map((o) => o.displayName).join(", ")}
      </span>
    </span>
  );
}
export const days = (n: number) => plural(n, "day");

/** A list of skill-days as chips, "FE 1.5d". */
export function SkillDays({ days, empty }: { days: Ticket["estimates"]; empty: string }) {
  const set = SKILLS.filter((k) => days[k] !== undefined);
  if (!set.length) return <span className="text-ink-faint">{empty}</span>;
  return (
    <span className="flex items-center gap-1.5">
      {set.map((k) => (
        <span key={k} className="rounded-md bg-fill px-1.5 py-px font-mono text-xs text-ink-muted tabular-nums">
          {k} {days[k]}d
        </span>
      ))}
    </span>
  );
}

/** One step of the accent per skill, so team shape reads as a single scale, not four brands. */
export const SKILL_TONE: Record<Skill, string> = {
  FE: "bg-accent",
  BE: "bg-accent/65",
  Data: "bg-accent/40",
  AI: "bg-accent/20",
};

/** The box every proficiency value sits in, editable or not, so the column lines up. */
export const skillCell = "inline-flex h-7 items-center justify-end rounded-md border px-1.5 tabular-nums";

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-fill text-ink-muted">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p>}
    </div>
  );
}

/**
 * Days used against capacity, on a scale shared by every bar in a card so their lengths compare. The track is
 * the capacity itself and ends there, so a short track is a small capacity; anything past it runs on in red.
 * A label rides just past the end of the bar.
 */
export function CapacityBar({
  used,
  capacity,
  max,
  tone,
  i,
  className = "flex",
  label,
}: {
  used: number;
  capacity: number;
  max: number;
  tone: string;
  i: number;
  className?: string;
  label?: React.ReactNode;
}) {
  const share = (n: number) => `${(n / max) * 100}%`;
  const over = used - capacity;
  return (
    // The margin keeps room for the label, so the widths stay shares of the scale.
    <span className={`${className} relative h-1.5 gap-0.5 ${label !== undefined ? "mr-10" : ""}`}>
      <span className="h-full rounded-full bg-fill" style={{ width: share(capacity) }} aria-hidden>
        <span
          className={`grow-x block h-full rounded-full ${tone}`}
          style={
            { width: `${capacity ? (Math.min(used, capacity) / capacity) * 100 : 0}%`, "--i": i } as React.CSSProperties
          }
        />
      </span>
      {over > 0 && (
        <span
          className="grow-x block h-full rounded-full bg-danger"
          style={{ width: share(over), "--i": i } as React.CSSProperties}
          aria-hidden
        />
      )}
      {label != null && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 ${used || capacity ? "ml-2" : ""} text-sm whitespace-nowrap tabular-nums`}
          style={{ left: share(Math.max(used, capacity)) }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
