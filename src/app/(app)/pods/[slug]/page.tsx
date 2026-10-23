import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  CaretDoubleDownIcon,
  CaretDoubleUpIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  TrayIcon,
  EqualsIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { SKILLS, type Skill } from "@/db/schema";
import { Avatar } from "@/components/brand";
import { dateTime, day } from "@/lib/format";
import { getPodPage, type PodPage as PodData } from "@/server/pods";
import { requireViewer } from "@/server/session";
import { getSprintView, type SprintView } from "@/server/sprints";
import { BOARD_ID, getSyncStatus } from "@/server/sync";
import { getCapacitySheet, type CapacitySheet } from "@/server/capacity";
import { setLeaveAction, setProficiencyAction } from "./actions";
import { CellInput } from "./cell-input";
import { SprintPicker, SyncNowButton } from "./sprint-controls";

// Covers the "Sync now" server action on this page.
export const maxDuration = 300;

export default function PodPage({ params, searchParams }: PageProps<"/pods/[slug]">) {
  return (
    <Suspense fallback={<PodSkeleton />}>
      <Pod params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Ticket = SprintView["tickets"][number];
type LoadTicket = CapacitySheet["load"]["tickets"][number];
type Category = Ticket["statusCategory"];

const card = "overflow-hidden rounded-lg border border-line bg-surface shadow-card";
const cardTitle = "text-sm font-medium";
const badge = "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium";
/** Sets the order a section rises in on load. */
const rise = (i: number) => ({ className: "rise", style: { "--i": i } as React.CSSProperties });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function Pod({ params, searchParams }: PageProps<"/pods/[slug]">) {
  const [{ slug }, { sprint: requested }, viewer] = await Promise.all([params, searchParams, requireViewer()]);
  const page = await getPodPage(slug);
  if (!page) notFound();
  const [view, sync] = await Promise.all([
    getSprintView(page.pod.jiraPodValue, typeof requested === "string" ? requested : undefined),
    getSyncStatus(),
  ]);

  const capacity = view.sprint && (await getCapacitySheet(page, view.sprint, view.tickets));
  const { pod, members } = page;
  const lead = members.find((m) => m.isLead);
  const isOwn = viewer.pod?.id === pod.id;

  return (
    <div className="space-y-8">
      <header {...rise(0)} className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{pod.name}</h1>
            <span className={`${badge} ${isOwn ? "bg-accent-soft text-accent" : "bg-fill text-ink-muted"}`}>
              {isOwn ? "Your pod" : "Read only"}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            {lead && (
              <span className="flex items-center gap-2">
                <Avatar name={lead.name} size="xs" tone="accent" />
                Led by {lead.name}
              </span>
            )}
            <span>{plural(members.length, "person", "people")}</span>
            <span>
              Jira POD <span className="font-medium text-ink">{pod.jiraPodValue}</span>
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-faint">
            {sync.running
              ? "Syncing with Jira now…"
              : sync.lastSuccessAt
                ? `Last synced ${dateTime(sync.lastSuccessAt)}`
                : "Never synced"}
          </p>
          <SyncNowButton />
        </div>
      </header>

      {sync.failure && (
        <div
          role="alert"
          {...rise(1)}
          className="rise flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3.5 text-sm"
        >
          <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0 text-danger" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-danger">The Jira sync at {dateTime(sync.failure.at)} failed.</p>
            <p className="text-ink">{sync.failure.error}</p>
            <p className="text-ink-muted">
              {sync.lastSuccessAt
                ? `Showing data from the last successful sync, ${dateTime(sync.lastSuccessAt)}.`
                : "Nothing has been synced from Jira yet."}
            </p>
          </div>
        </div>
      )}

      <div {...rise(2)}>
        <Sprint podName={pod.name} view={view} capacity={capacity} canEdit={isOwn} />
      </div>

      <div {...rise(3)}>
        <Team members={members} canEdit={isOwn} />
      </div>
    </div>
  );
}

// ---- Sprint ----

const STATE_LABEL = { active: "Active", future: "Upcoming", closed: "Closed" };

/** Display order: the work in flight first, as a lead scans a sprint. */
const GROUPS: { category: Category; label: string }[] = [
  { category: "indeterminate", label: "In progress" },
  { category: "new", label: "To do" },
  { category: "done", label: "Done" },
];

const CATEGORY = {
  new: { Icon: CircleDashedIcon, weight: "bold", color: "text-ink-faint", bar: "bg-line-strong" },
  indeterminate: { Icon: CircleHalfIcon, weight: "fill", color: "text-accent", bar: "bg-accent" },
  done: { Icon: CheckCircleIcon, weight: "fill", color: "text-success", bar: "bg-success" },
} as const;

function StatusIcon({ category, size = 16 }: { category: Category; size?: number }) {
  const { Icon, weight, color } = CATEGORY[category];
  return <Icon size={size} weight={weight} className={`shrink-0 ${color}`} aria-hidden />;
}

function Sprint({
  podName,
  view,
  capacity,
  canEdit,
}: {
  podName: string;
  view: SprintView;
  capacity: CapacitySheet | null;
  canEdit: boolean;
}) {
  const { sprint, tickets } = view;

  if (!sprint || !capacity) {
    return (
      <section aria-labelledby="sprint">
        <h2 id="sprint" className="sr-only">
          Sprint overview
        </h2>
        <Empty icon={<TrayIcon size={20} aria-hidden />} title="No sprints yet">
          Press Sync now to pull the sprints on board {BOARD_ID} from Jira.
        </Empty>
      </section>
    );
  }

  return (
    <section aria-labelledby="sprint" className="space-y-4">
      <h2 id="sprint" className="sr-only">
        Sprint overview
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SprintPicker
          sprints={view.sprints.map((s) => ({ id: s.id, name: s.name, state: s.state }))}
          selected={sprint.id}
        />
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <CalendarBlankIcon size={16} className="text-ink-faint" aria-hidden />
          {sprint.startDate && sprint.endDate ? `${day(sprint.startDate)} to ${day(sprint.endDate)}` : "No dates set"}
        </p>
        <span
          className={`${badge} ${sprint.state === "active" ? "bg-accent-soft text-accent" : "bg-fill text-ink-muted"}`}
        >
          {STATE_LABEL[sprint.state]}
        </span>
      </div>

      <Capacity sheet={capacity} sprintId={sprint.id} canEdit={canEdit} />

      {tickets.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Committed commitment={capacity.commitment} />
          <Unestimated tickets={capacity.commitment.unestimated} />
        </div>
      )}

      {tickets.length === 0 ? (
        <Empty icon={<TrayIcon size={20} aria-hidden />} title={`No ${podName} tickets in ${sprint.name}.`}>
          Tickets show here when their POD field is {podName} and they are in this sprint.
        </Empty>
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Workload load={capacity.load} />
            <Progress tickets={tickets} />
          </div>
          <TicketTable tickets={capacity.load.tickets} />
        </>
      )}
    </section>
  );
}

function Progress({ tickets }: { tickets: Ticket[] }) {
  const count = (c: Category) => tickets.filter((t) => t.statusCategory === c).length;
  const done = count("done");
  // Done first, so the bar fills from the left as the sprint completes.
  const segments = [GROUPS[2], GROUPS[0], GROUPS[1]].map((g) => ({ ...g, n: count(g.category) }));
  // Jira's own status names, in group order, so "Code Review" and "QA" are not lost inside "In progress".
  const statuses = GROUPS.flatMap(({ category }) => {
    const names = [...new Set(tickets.filter((t) => t.statusCategory === category).map((t) => t.status))];
    return names.map((name) => ({ name, category, n: tickets.filter((t) => t.status === name).length }));
  });

  return (
    <div className={`${card} flex flex-col p-5`}>
      <h3 className={cardTitle}>Sprint progress</h3>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {Math.round((done / tickets.length) * 100)}%
        </span>
        <span className="text-sm text-ink-muted">
          done, {done} of {plural(tickets.length, "ticket")}
        </span>
      </p>
      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {segments.map(
          (s, i) =>
            s.n > 0 && (
              <span
                key={s.category}
                className={`grow-x h-full ${CATEGORY[s.category].bar}`}
                style={{ flexGrow: s.n, "--i": i } as React.CSSProperties}
              />
            ),
        )}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-4">
        {GROUPS.map((g) => {
          const n = count(g.category);
          return (
            <div key={g.category} className="space-y-1">
              <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                <StatusIcon category={g.category} size={14} />
                {g.label}
              </dt>
              <dd className={`text-lg font-semibold tabular-nums ${n === 0 ? "text-ink-faint" : ""}`}>{n}</dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-auto border-t border-line pt-4">
        <h4 className="sr-only">By Jira status</h4>
        <ul className="flex flex-wrap gap-1.5">
          {statuses.map(({ name, category, n }) => (
            <li
              key={name}
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted"
            >
              <StatusIcon category={category} size={12} />
              {name}
              <span className="font-medium text-ink tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Jira's own priority glyphs, so the scale reads the same as in Jira.
const PRIORITY: Record<string, { Icon: typeof EqualsIcon; color: string }> = {
  Highest: { Icon: CaretDoubleUpIcon, color: "text-danger" },
  High: { Icon: CaretUpIcon, color: "text-warning" },
  Medium: { Icon: EqualsIcon, color: "text-ink-faint" },
  Low: { Icon: CaretDownIcon, color: "text-accent" },
  Lowest: { Icon: CaretDoubleDownIcon, color: "text-accent" },
};

function Priority({ name }: { name: string | null }) {
  if (!name) return <span className="text-ink-faint">None</span>;
  const p = PRIORITY[name];
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      {p && <p.Icon size={15} weight="bold" className={p.color} aria-hidden />}
      {name}
    </span>
  );
}

function Owners({ owners }: { owners: Ticket["owners"] }) {
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

function TicketTable({ tickets }: { tickets: LoadTicket[] }) {
  // Phones drop the status, priority and owners columns and show them under the summary instead.
  const wide = "hidden md:table-cell";
  return (
    <div className={card}>
      {/* Fixed widths from md up only: phones show two columns, and a hidden <col> still takes a share. */}
      <table className="w-full text-sm md:table-fixed">
        {/* Column widths live here: the first row is a group header spanning every column. */}
        <colgroup>
          <col className="w-24 md:w-28" />
          <col />
          <col className="hidden w-40 md:table-column" />
          <col className="hidden w-28 md:table-column" />
          <col className="hidden w-60 md:table-column" />
        </colgroup>
        <thead className="sr-only md:not-sr-only">
          <tr className="border-b border-line text-left text-xs text-ink-faint">
            <th scope="col" className="w-24 py-2.5 pr-2 pl-4 font-medium md:w-28 md:pl-5">
              Key
            </th>
            <th scope="col" className="py-2.5 pr-4 pl-2 font-medium">
              Summary
            </th>
            <th scope="col" className={`${wide} w-40 px-4 py-2.5 font-medium`}>
              Status
            </th>
            <th scope="col" className={`${wide} w-28 px-4 py-2.5 font-medium`}>
              Priority
            </th>
            <th scope="col" className={`${wide} w-60 py-2.5 pr-5 pl-4 font-medium`}>
              Owners
            </th>
          </tr>
        </thead>
        {GROUPS.map(({ category, label }) => {
          const rows = tickets.filter((t) => t.statusCategory === category);
          if (!rows.length) return null;
          return (
            <tbody key={category} className="divide-y divide-line border-b border-line last:border-b-0">
              <tr className="bg-fill/60">
                <th scope="colgroup" colSpan={5} className="py-2 pl-4 text-left text-xs font-medium md:pl-5">
                  <span className="flex items-center gap-2">
                    <StatusIcon category={category} size={14} />
                    {label}
                    <span className="font-normal text-ink-faint tabular-nums">{rows.length}</span>
                  </span>
                </th>
              </tr>
              {rows.map((t) => (
                <tr key={t.key} className="align-top transition-colors hover:bg-fill/50">
                  <td className="py-3 pr-2 pl-4 md:pl-5">
                    <a
                      href={t.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-center gap-1 font-mono text-xs leading-5 whitespace-nowrap text-ink-muted hover:text-accent"
                    >
                      {t.key}
                      {t.url && (
                        <>
                          <ArrowSquareOutIcon
                            size={12}
                            aria-hidden
                            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                          />
                          <span className="sr-only">(opens Jira)</span>
                        </>
                      )}
                    </a>
                  </td>
                  <td className="py-3 pr-4 pl-2">
                    <p className="leading-5 font-medium">{t.summary}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                      <span>{t.type}</span>
                      {t.epic && (
                        <a
                          href={t.epic.url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-line px-1.5 py-px text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                        >
                          Epic: {t.epic.summary}
                        </a>
                      )}
                      {t.readyForProductionDate && (
                        <span>Ready for prod {day(new Date(t.readyForProductionDate))}</span>
                      )}
                      <SkillDays days={t.estimates} empty="Not estimated" />
                      <CrossPod owners={t.crossPod} />
                      <NoOwner ticket={t} />
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs md:hidden">
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <StatusIcon category={t.statusCategory} size={14} />
                        {t.status}
                      </span>
                      <Priority name={t.priority} />
                      <span className="flex basis-full">
                        <Owners owners={t.owners} />
                      </span>
                    </div>
                  </td>
                  <td className={`${wide} px-4 py-3`}>
                    <span className="flex items-center gap-2 leading-5">
                      <StatusIcon category={t.statusCategory} size={15} />
                      <span className="truncate">{t.status}</span>
                    </span>
                  </td>
                  <td className={`${wide} px-4 py-3 leading-5`}>
                    <Priority name={t.priority} />
                  </td>
                  <td className={`${wide} py-3 pr-5 pl-4 leading-5`}>
                    <Owners owners={t.owners} />
                  </td>
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

// ---- Capacity ----

const days = (n: number) => plural(n, "day");

function Capacity({ sheet, sprintId, canEdit }: { sheet: CapacitySheet; sprintId: number; canEdit: boolean }) {
  const max = Math.max(1, ...sheet.skills.map((k) => k.capacity));
  const holidays = sheet.holidays.length ? ` - ${plural(sheet.holidays.length, "holiday")}` : "";
  const formula = `(${days(sheet.workingDays)} - leave${holidays}) x ${sheet.focusPercent}%`;

  return (
    <section aria-label="Capacity" className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="by-skill" className={`${card} p-5`}>
        <h3 id="by-skill" className={cardTitle}>
          Capacity by skill
        </h3>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{sheet.total}</span>
          <span className="text-sm text-ink-muted">plannable days across the pod</span>
        </p>
        <ul className="mt-5 space-y-1">
          {sheet.skills.map((k, i) => {
            const { gap } = k;
            return (
              <li key={k.skill} className={`-mx-2 rounded-lg px-2 py-1.5 ${gap ? "bg-danger-soft" : ""}`}>
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                    <span className={`size-1.5 rounded-full ${SKILL_TONE[k.skill]}`} aria-hidden />
                    {k.skill}
                  </span>
                  <span className="h-1.5 rounded-full bg-fill" aria-hidden>
                    <span
                      className={`grow-x block h-full rounded-full ${SKILL_TONE[k.skill]}`}
                      style={{ width: `${(k.capacity / max) * 100}%`, "--i": i } as React.CSSProperties}
                    />
                  </span>
                  <span
                    className={`text-right tabular-nums ${gap ? "font-semibold text-danger" : k.people ? "font-medium" : "text-ink-faint"}`}
                  >
                    {k.people ? days(k.capacity) : "No one"}
                  </span>
                </div>
                {gap && (
                  <p className="mt-1 flex items-center gap-1.5 pl-[3.25rem] text-xs font-medium text-danger">
                    <WarningCircleIcon size={14} weight="fill" aria-hidden />
                    No {k.skill} capacity this sprint
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
          {[
            ["Working days", sheet.workingDays],
            ["Holidays", sheet.holidays.length],
            ["Focus factor", `${sheet.focusPercent}%`],
          ].map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className={`text-lg font-semibold tabular-nums ${value === 0 ? "text-ink-faint" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {sheet.workingDays === 0 && (
          <p className="mt-3 text-xs text-ink-muted">
            This sprint has no dates in Jira yet, so it has no working days to plan.
          </p>
        )}
        {sheet.holidays.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink-muted">
            {sheet.holidays.map((h) => (
              <li key={h.date} className="flex items-center gap-1.5">
                <CalendarBlankIcon size={14} className="text-ink-faint" aria-hidden />
                <span className="font-medium text-ink">{day(new Date(h.date))}</span>
                {h.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sheet" className={card}>
        <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
          <h3 id="sheet" className={cardTitle}>
            Capacity sheet
          </h3>
          <span className="text-xs text-ink-faint tabular-nums">{formula}</span>
        </div>
        {sheet.people.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-ink-muted">No one is in this pod yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-line text-xs text-ink-faint">
                <th scope="col" className="py-2 pl-4 text-left font-medium sm:pl-5">
                  Name
                </th>
                <th scope="col" className="w-20 py-2 pr-4.5 text-right font-medium">
                  Leave
                </th>
                <th scope="col" className="w-24 py-2 pr-4 text-right font-medium sm:pr-5">
                  Capacity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {sheet.people.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-fill/50">
                  <td className="py-2.5 pl-4 sm:pl-5">
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:contents">
                        <Avatar name={p.name} size="md" tone={p.isLead ? "accent" : "neutral"} />
                      </span>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="font-mono text-xs text-ink-faint">{p.mainSkill}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {canEdit ? (
                      <CellInput
                        action={setLeaveAction}
                        fields={{ personId: p.id, sprintId }}
                        name="days"
                        value={p.leave}
                        min={0}
                        max={sheet.workingDays}
                        step={0.5}
                        label={`Leave days for ${p.name}`}
                        unit="d"
                        className={`${skillCell} gap-1`}
                      />
                    ) : (
                      <span className={`${skillCell} border-transparent ${p.leave ? "" : "text-ink-faint"}`}>
                        {p.leave} d
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2.5 pr-4 text-right tabular-nums sm:pr-5 ${p.capacity === 0 ? "font-semibold text-danger" : "font-medium"}`}
                  >
                    {days(p.capacity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}

// ---- Committed vs capacity ----

type Commitment = CapacitySheet["commitment"];

function Committed({ commitment }: { commitment: Commitment }) {
  const max = Math.max(1, ...commitment.skills.flatMap((k) => [k.capacity, k.committed ?? 0]));
  const width = (n: number) => `${(n / max) * 100}%`;

  return (
    <section aria-labelledby="committed" className={`${card} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="committed" className={cardTitle}>
          Committed vs capacity
        </h3>
        <span className="text-xs text-ink-faint">Estimated skill-days</span>
      </div>
      <ul className="mt-4 space-y-1">
        {commitment.skills.map((k, i) => {
          const over = k.over > 0;
          const within = Math.min(k.committed ?? 0, k.capacity);
          return (
            <li
              key={k.skill}
              aria-label={`${k.skill} committed vs capacity`}
              className={`-mx-2 rounded-lg px-2 py-1.5 ${over ? "bg-danger-soft" : ""}`}
            >
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_7.5rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                  <span className={`size-1.5 rounded-full ${SKILL_TONE[k.skill]}`} aria-hidden />
                  {k.skill}
                </span>
                {/* The track is capacity; past it, committed days run on in red. */}
                <span className="relative flex h-1.5 rounded-full bg-fill" aria-hidden>
                  <span
                    className={`grow-x block h-full rounded-l-full ${over ? "" : "rounded-r-full"} ${SKILL_TONE[k.skill]}`}
                    style={{ width: width(within), "--i": i } as React.CSSProperties}
                  />
                  {over && (
                    <span
                      className="grow-x block h-full rounded-r-full bg-danger"
                      style={{ width: width(k.over), "--i": i } as React.CSSProperties}
                    />
                  )}
                  <span className="absolute -top-1 h-3.5 w-px bg-line-strong" style={{ left: width(k.capacity) }} />
                </span>
                <span className="text-right tabular-nums">
                  {k.committed === null ? (
                    <span className="text-ink-faint">Not estimated</span>
                  ) : (
                    <>
                      <span className={over ? "font-semibold text-danger" : "font-medium"}>{k.committed}</span>
                      <span className="text-ink-muted"> of {days(k.capacity)}</span>
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[3.25rem] text-xs">
                {over ? (
                  <span className="flex items-center gap-1.5 font-medium text-danger">
                    <WarningCircleIcon size={14} weight="fill" aria-hidden />
                    Over by {days(k.over)}
                  </span>
                ) : (
                  k.committed !== null && (
                    <span className="text-ink-muted">{days(round(k.capacity - k.committed))} free</span>
                  )
                )}
                {k.notEstimated > 0 && (
                  <span className="text-ink-faint">{plural(k.notEstimated, "ticket")} not estimated</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;

function Unestimated({ tickets }: { tickets: Commitment["unestimated"] }) {
  return (
    <section aria-labelledby="unestimated" className={card}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="unestimated" className={cardTitle}>
          No estimates
        </h3>
        <span className="text-xs text-ink-faint tabular-nums">{plural(tickets.length, "ticket")}</span>
      </div>
      {tickets.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pb-5 text-sm text-ink-muted sm:px-5">
          <CheckCircleIcon size={16} weight="fill" className="text-success" aria-hidden />
          Every ticket in this sprint has an estimate.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {tickets.map((t) => (
            <li key={t.key} className="flex items-baseline gap-3 px-4 py-2.5 text-sm sm:px-5">
              <TicketKey ticket={t} />
              <span className="min-w-0 truncate" title={t.summary}>
                {t.summary}
              </span>
              <span className="ml-auto shrink-0 text-xs text-ink-faint">{t.type}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- Who is working on what ----

type PersonLoad = CapacitySheet["load"]["people"][number];

/** A list of skill-days as chips, "FE 1.5d". */
function SkillDays({ days, empty }: { days: Ticket["estimates"]; empty: string }) {
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

function TicketKey({ ticket }: { ticket: { key: string; url: string | null } }) {
  return (
    <a
      href={ticket.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-ink-muted hover:text-accent"
    >
      {ticket.key}
      {ticket.url && (
        <>
          <ArrowSquareOutIcon size={12} aria-hidden />
          <span className="sr-only">(opens Jira)</span>
        </>
      )}
    </a>
  );
}

/** Each person's calendar days against capacity. Opening a person lists their tickets. */
function Workload({ load }: { load: CapacitySheet["load"] }) {
  const max = Math.max(1, ...load.people.flatMap((p) => [p.capacity, p.calendarDays]));
  const flagged = load.tickets.filter((t) => Object.keys(t.unassigned).length);

  return (
    <section aria-labelledby="load" className={card}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="load" className={cardTitle}>
          Who is working on what
        </h3>
        <span className="text-xs text-ink-faint">Calendar days of capacity</span>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {load.people.map((p, i) => (
          <PersonRow key={p.id} person={p} max={max} i={i} />
        ))}
      </ul>
      {flagged.length > 0 && (
        <section aria-labelledby="unassigned" className="border-t border-line bg-danger-soft/60 px-4 py-4 sm:px-5">
          <h4 id="unassigned" className="flex items-center gap-1.5 text-sm font-medium text-danger">
            <WarningCircleIcon size={16} weight="fill" aria-hidden />
            Unassigned work, {plural(load.unassigned, "skill-day")}
          </h4>
          <p className="mt-0.5 text-xs text-ink-muted">Counts against the pod, but no one here can do it.</p>
          <ul className="mt-3 space-y-2">
            {flagged.map((t) => (
              <li key={t.key} className="flex items-baseline gap-3 text-sm">
                <TicketKey ticket={t} />
                <span className="min-w-0 truncate" title={t.summary}>
                  {t.summary}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
                  <span className="text-ink-muted">{noOwner(t)}</span>
                  <SkillDays days={t.unassigned} empty="" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function PersonRow({ person: p, max, i }: { person: PersonLoad; max: number; i: number }) {
  const over = p.free < 0;
  const within = Math.min(p.calendarDays, p.capacity);
  const width = (n: number) => `${(n / max) * 100}%`;

  return (
    <li>
      <details className="group">
        <summary
          aria-label={`${p.name}'s load`}
          className="grid cursor-pointer list-none grid-cols-[1rem_minmax(0,1fr)_auto] sm:grid-cols-[1rem_minmax(0,11rem)_minmax(0,1fr)_7.5rem] items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-fill/50 sm:px-5 [&::-webkit-details-marker]:hidden"
        >
          <CaretRightIcon
            size={12}
            weight="bold"
            className="text-ink-faint transition-transform group-open:rotate-90"
            aria-hidden
          />
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{p.name}</span>
            <span className="font-mono text-xs text-ink-faint">{p.mainSkill}</span>
          </span>
          {/* The track is capacity; past it, calendar days run on in red. */}
          <span className="relative hidden h-1.5 sm:flex rounded-full bg-fill" aria-hidden>
            <span
              className={`grow-x block h-full rounded-l-full ${over ? "" : "rounded-r-full"} bg-accent/80`}
              style={{ width: width(within), "--i": i } as React.CSSProperties}
            />
            {over && (
              <span
                className="grow-x block h-full rounded-r-full bg-danger"
                style={{ width: width(-p.free), "--i": i } as React.CSSProperties}
              />
            )}
            <span className="absolute -top-1 h-3.5 w-px bg-line-strong" style={{ left: width(p.capacity) }} />
          </span>
          <span className="text-right tabular-nums">
            <span className={over ? "font-semibold text-danger" : "font-medium"}>{p.calendarDays}</span>
            <span className="text-ink-muted"> of {days(p.capacity)}</span>
          </span>
          <span className="col-start-2 -col-end-1 -mt-1.5 flex flex-wrap gap-x-3 text-xs">
            <span className="text-ink-muted">
              {plural(p.skillDays, "skill-day")} on {plural(p.tickets.length, "ticket")}
            </span>
            {over ? (
              <span className="flex items-center gap-1 font-medium text-danger">
                <WarningCircleIcon size={14} weight="fill" aria-hidden />
                Over by {days(-p.free)}
              </span>
            ) : (
              <span className="text-ink-muted">{days(p.free)} free</span>
            )}
          </span>
        </summary>
        {p.tickets.length === 0 ? (
          <p className="px-4 pb-3 pl-11 text-sm text-ink-faint sm:pl-12">No tickets in this sprint.</p>
        ) : (
          <ul aria-label={`${p.name}'s tickets`} className="space-y-2 px-4 pb-3.5 pl-11 sm:pr-5 sm:pl-12">
            {p.tickets.map((t) => (
              <li key={t.key} className="flex items-baseline gap-3 text-sm">
                <TicketKey ticket={t} />
                <span className="min-w-0 truncate" title={t.summary}>
                  {t.summary}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-ink-muted" title={t.status}>
                    <StatusIcon category={t.statusCategory} size={14} />
                    <span className="sr-only sm:not-sr-only">{t.status}</span>
                  </span>
                  <SkillDays days={t.attributed} empty="No skill-days" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

function CrossPod({ owners }: { owners: LoadTicket["crossPod"] }) {
  if (!owners.length) return null;
  return (
    <span className="rounded-md bg-accent-soft px-1.5 py-px text-accent">
      Cross-pod help: {owners.map((o) => `${o.displayName} (${o.pod})`).join(", ")}
    </span>
  );
}

/** Why a ticket has unassigned work, or null when it has none. */
function noOwner(ticket: LoadTicket) {
  const skills = SKILLS.filter((k) => ticket.unassigned[k] !== undefined);
  if (!skills.length) return null;
  return ticket.owners.length ? `No owner can do ${skills.join(", ")}` : "No owner";
}

function NoOwner({ ticket }: { ticket: LoadTicket }) {
  const reason = noOwner(ticket);
  if (!reason) return null;
  return (
    <span className="flex items-center gap-1 font-medium text-danger">
      <WarningCircleIcon size={14} weight="fill" aria-hidden />
      {reason}
    </span>
  );
}

// ---- Team ----

/** One step of the accent per skill, so team shape reads as a single scale, not four brands. */
const SKILL_TONE: Record<Skill, string> = {
  FE: "bg-accent",
  BE: "bg-accent/65",
  Data: "bg-accent/40",
  AI: "bg-accent/20",
};

function Team({ members, canEdit }: { members: PodData["members"]; canEdit: boolean }) {
  const bySkill = SKILLS.map((skill) => ({ skill, people: members.filter((m) => m.mainSkill === skill) }));

  return (
    <section aria-labelledby="team" className="space-y-4">
      <h2 id="team" className="text-base font-semibold tracking-tight">
        Team
      </h2>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="shape" className={`${card} p-5`}>
          <h3 id="shape" className={cardTitle}>
            Team shape
          </h3>
          <p className="mt-1 text-sm text-ink-muted">Main skill of each person.</p>
          {members.length > 0 && (
            <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {bySkill.map(
                ({ skill, people }, i) =>
                  people.length > 0 && (
                    <span
                      key={skill}
                      className={`grow-x h-full ${SKILL_TONE[skill]}`}
                      style={{ flexGrow: people.length, "--i": i } as React.CSSProperties}
                    />
                  ),
              )}
            </div>
          )}
          <ul className="mt-5 space-y-3.5">
            {bySkill.map(({ skill, people }) => (
              <li key={skill} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SKILL_TONE[skill]}`} aria-hidden />
                <span className="w-9 font-mono text-xs leading-5 text-ink-muted">{skill}</span>
                <span className={`w-4 font-semibold tabular-nums ${people.length ? "" : "text-ink-faint"}`}>
                  {people.length}
                </span>
                <span className={`min-w-0 ${people.length ? "text-ink-muted" : "text-ink-faint"}`}>
                  {people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : "No one yet"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Members members={members} canEdit={canEdit} />
      </div>
    </section>
  );
}

/** The box every proficiency value sits in, editable or not, so the column lines up. */
const skillCell = "inline-flex h-7 items-center justify-end rounded-md border px-1.5 tabular-nums";

function Members({ members, canEdit }: { members: PodData["members"]; canEdit: boolean }) {
  return (
    <section aria-labelledby="members" className={card}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="members" className={cardTitle}>
          Members
        </h3>
        <span className="text-xs text-ink-faint">
          {canEdit ? "Proficiency per skill, main skill fixed at 100%" : "Proficiency per skill"}
        </span>
      </div>
      {members.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-ink-muted">No one is in this pod yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-line text-xs text-ink-faint">
                <th scope="col" className="py-2 pl-4 text-left font-medium sm:pl-5">
                  Name
                </th>
                {SKILLS.map((skill) => (
                  <th
                    key={skill}
                    scope="col"
                    className="w-16 py-2 pr-3.5 text-right font-mono font-medium last:pr-4.5 sm:pr-4.5 sm:last:pr-6.5"
                  >
                    {skill}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {members.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-fill/50">
                  <td className="py-2.5 pl-4 sm:pl-5">
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:contents">
                        <Avatar name={m.name} size="md" tone={m.isLead ? "accent" : "neutral"} />
                      </span>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{m.name}</span>
                        {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                      </span>
                    </div>
                  </td>
                  {SKILLS.map((skill) => (
                    <td key={skill} className="py-2.5 pr-2 text-right last:pr-4 sm:pr-3 sm:last:pr-5">
                      {skill === m.mainSkill ? (
                        <span
                          title="Main skill"
                          className={`${skillCell} gap-1.5 border-transparent bg-fill font-medium`}
                        >
                          <span className={`hidden size-1.5 rounded-full sm:block ${SKILL_TONE[skill]}`} aria-hidden />
                          100%
                          <span className="sr-only">, main skill</span>
                        </span>
                      ) : canEdit ? (
                        <CellInput
                          action={setProficiencyAction}
                          fields={{ personId: m.id, skill }}
                          name="percent"
                          value={m.proficiency[skill]}
                          min={0}
                          max={100}
                          step={1}
                          label={`${skill} proficiency for ${m.name}`}
                          unit="%"
                          className={skillCell}
                        />
                      ) : (
                        <span
                          className={`${skillCell} border-transparent ${m.proficiency[skill] ? "" : "text-ink-faint"}`}
                        >
                          {m.proficiency[skill]}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-fill text-ink-muted">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p>}
    </div>
  );
}

function PodSkeleton() {
  const block = "rounded-lg border border-line bg-surface";
  return (
    <div aria-hidden className="animate-pulse space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="h-8 w-40 rounded-lg bg-fill" />
          <div className="h-4 w-72 rounded-lg bg-fill" />
        </div>
        <div className="hidden h-8 w-64 rounded-lg bg-fill sm:block" />
      </div>
      <div className="h-8 w-80 rounded-lg bg-fill" />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className={`${block} h-48`} />
        <div className={`${block} h-48`} />
      </div>
      <div className={`${block} h-96`} />
    </div>
  );
}
