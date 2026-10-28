import { CalendarBlankIcon, TrayIcon } from "@phosphor-icons/react/dist/ssr";
import { day } from "@/lib/format";
import type { PodPage as PodData } from "@/server/pods";
import type { SprintView } from "@/server/sprints";
import { BOARD_ID } from "@/server/sync";
import type { CapacitySheet } from "@/server/capacity";
import type { PickUpPanel } from "@/server/pick-up";
import { ManualItems } from "./manual-items";
import { SprintPicker } from "./sprint-controls";
import {
  CATEGORY,
  type Category,
  Empty,
  GROUPS,
  StatusIcon,
  type Ticket,
  badge,
  card,
  cardTitle,
  plural,
} from "./pod-ui";
import { TicketTable } from "./ticket-table";
import { Committed, Sheet, Unestimated } from "./capacity";
import { Workload } from "./workload";
import { OverloadedSkills, PickUp } from "./pick-up-panel";

// ---- Sprint ----

const STATE_LABEL = { active: "Active", future: "Upcoming", closed: "Closed" };

export function Sprint({
  page,
  view,
  capacity,
  pickUp,
  canEdit,
}: {
  page: PodData;
  view: SprintView;
  capacity: CapacitySheet | null;
  pickUp: PickUpPanel | null;
  canEdit: boolean;
}) {
  const { sprint, tickets } = view;
  const podName = page.pod.name;

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

      {tickets.length > 0 ? (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Committed sheet={capacity} />
            <Unestimated tickets={capacity.commitment.unestimated} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Workload load={capacity.load} />
            <Progress tickets={tickets} />
          </div>
          <Sheet sheet={capacity} sprintId={sprint.id} canEdit={canEdit} />
        </>
      ) : (
        // No tickets to estimate or track, so the sheet takes the space beside capacity.
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Committed sheet={capacity} />
            <Sheet sheet={capacity} sprintId={sprint.id} canEdit={canEdit} />
          </div>
          {/* Its people can still be busy: on manual items, or on other pods' tickets. */}
          {capacity.load.people.some((p) => p.tickets.length + p.items.length > 0) && <Workload load={capacity.load} />}
        </>
      )}

      {/* Shown even with no tickets yet: filling an empty upcoming sprint is when it helps most. */}
      {pickUp && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PickUp pickUp={pickUp} />
          <OverloadedSkills short={pickUp.short} sprintId={sprint.id} />
        </div>
      )}

      {(canEdit || capacity.items.length > 0) && (
        <ManualItems
          items={capacity.items}
          people={page.members.map(({ id, name }) => ({ id, name }))}
          skills={page.skills}
          podId={page.pod.id}
          sprintId={sprint.id}
          canEdit={canEdit}
        />
      )}

      {tickets.length === 0 ? (
        <Empty icon={<TrayIcon size={20} aria-hidden />} title={`No ${podName} tickets in ${sprint.name}.`}>
          Tickets show here when their POD field is {podName} and they are in this sprint.
        </Empty>
      ) : (
        <TicketTable tickets={capacity.load.tickets} />
      )}
    </section>
  );
}

function Progress({ tickets }: { tickets: Ticket[] }) {
  const count = (c: Category) => tickets.filter((t) => t.statusCategory === c).length;
  const done = count("done");
  // Done first, so the bar fills from the left as the sprint completes. The counts below follow the bar's colors.
  const order = [GROUPS[2], GROUPS[0], GROUPS[1]];
  const segments = order.map((g) => ({ ...g, n: count(g.category) }));
  // Jira's own status names, in group order, so "Code Review" and "QA" are not lost inside "In progress".
  const statuses = order.flatMap(({ category }) => {
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
        {segments.map(({ n, ...g }) => {
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
