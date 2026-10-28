import { CaretRightIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { SKILLS } from "@/db/schema";
import { TicketKey } from "@/components/jira";
import type { CapacitySheet } from "@/server/capacity";
import { CapacityBar, type LoadTicket, SkillDays, StatusIcon, card, cardTitle, days, plural } from "./pod-ui";

// ---- Who is working on what ----

type PersonLoad = CapacitySheet["load"]["people"][number];

/** Each person's calendar days against capacity. Opening a person lists their tickets. */
export function Workload({ load }: { load: CapacitySheet["load"] }) {
  const max = Math.max(1, ...load.people.flatMap((p) => [p.capacity, p.calendarDays]));
  const flagged = load.tickets.filter((t) => Object.keys(t.unassigned).length);
  const flaggedItems = load.items.filter((i) => Object.keys(i.unassigned).length);

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
      {flagged.length + flaggedItems.length > 0 && (
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
            {flaggedItems.map((i) => (
              <ManualLine key={`item-${i.id}`} item={i}>
                <span className="text-ink-muted">
                  {i.person ? `${i.person} cannot take it here` : "No one can do it"}
                </span>
                <SkillDays days={i.unassigned} empty="" />
              </ManualLine>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function PersonRow({ person: p, max, i }: { person: PersonLoad; max: number; i: number }) {
  const over = p.free < 0;

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
          <CapacityBar
            used={p.calendarDays}
            capacity={p.capacity}
            max={max}
            tone="bg-accent/80"
            i={i}
            className="hidden sm:flex"
          />
          <span className="text-right tabular-nums">
            <span className={over ? "font-semibold text-danger" : "font-medium"}>{p.calendarDays}</span>
            <span className="text-ink-muted"> of {days(p.capacity)}</span>
          </span>
          <span className="col-start-2 -col-end-1 -mt-1.5 flex flex-wrap gap-x-3 text-xs">
            <span className="text-ink-muted">
              {plural(p.skillDays, "skill-day")} on{" "}
              {[
                (p.tickets.length > 0 || !p.items.length) && plural(p.tickets.length, "ticket"),
                p.items.length > 0 && plural(p.items.length, "manual item"),
              ]
                .filter(Boolean)
                .join(" and ")}
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
        {p.tickets.length + p.items.length === 0 ? (
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
            {p.items.map((i) => (
              <ManualLine key={`item-${i.id}`} item={i}>
                <SkillDays days={{ [i.skill]: i.days }} empty="" />
              </ManualLine>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

/** A manual item in a list of tickets, where its title stands in for the ticket key and summary. */
function ManualLine({ item, children }: { item: { title: string }; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3 text-sm">
      <span className="shrink-0 text-xs text-ink-faint">Manual</span>
      <span className="min-w-0 truncate" title={item.title}>
        {item.title}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">{children}</span>
    </li>
  );
}

export function CrossPod({ owners }: { owners: LoadTicket["crossPod"] }) {
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

export function NoOwner({ ticket }: { ticket: LoadTicket }) {
  const reason = noOwner(ticket);
  if (!reason) return null;
  return (
    <span className="flex items-center gap-1 font-medium text-danger">
      <WarningCircleIcon size={14} weight="fill" aria-hidden />
      {reason}
    </span>
  );
}
