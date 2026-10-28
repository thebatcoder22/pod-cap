import { CalendarBlankIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/brand";
import { TicketKey } from "@/components/jira";
import { day } from "@/lib/format";
import type { CapacitySheet } from "@/server/capacity";
import { setLeaveAction } from "./actions";
import { CellInput } from "./cell-input";
import { FitList } from "./fit-list";
import { CapacityBar, SKILL_TONE, card, cardTitle, days, plural, skillCell } from "./pod-ui";

// ---- Committed vs capacity ----

/** The pod's plannable days per skill, what is committed against them, and what they are computed from. */
export function Committed({ sheet }: { sheet: CapacitySheet }) {
  const { commitment } = sheet;
  const max = Math.max(1, ...commitment.skills.flatMap((k) => [k.capacity, k.committed ?? 0]));
  const gaps = new Set(sheet.skills.filter((k) => k.gap).map((k) => k.skill));
  const nobody = new Set(sheet.skills.filter((k) => !k.people).map((k) => k.skill));

  return (
    <section aria-labelledby="committed" className={`${card} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="committed" className={cardTitle}>
          Committed vs capacity
        </h3>
        <span className="text-xs text-ink-faint">Estimated skill-days</span>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{sheet.total}</span>
        <span className="text-sm text-ink-muted">plannable days across the pod</span>
      </p>
      <ul className="mt-4 space-y-1">
        {commitment.skills.map((k, i) => {
          const over = k.over > 0;
          const gap = gaps.has(k.skill);
          return (
            <li
              key={k.skill}
              aria-label={`${k.skill} committed vs capacity`}
              className={`-mx-2 rounded-lg px-2 py-1.5 ${over || gap ? "bg-danger-soft" : ""}`}
            >
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                  <span className={`size-1.5 rounded-full ${SKILL_TONE[k.skill]}`} aria-hidden />
                  {k.skill}
                </span>
                <CapacityBar
                  used={k.committed ?? 0}
                  capacity={k.capacity}
                  max={max}
                  tone="bg-accent"
                  i={i}
                  label={k.committed === null ? null : <span className="font-medium">{k.committed}</span>}
                />
                <span
                  className={`flex self-stretch items-center justify-end border-l border-line pl-3 tabular-nums ${gap ? "font-semibold text-danger" : "text-ink-muted"}`}
                >
                  {k.committed !== null && <span className="sr-only">{" of "}</span>}
                  {nobody.has(k.skill) ? "No one" : days(k.capacity)}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[3.25rem] text-xs">
                {gap && (
                  <span className="flex items-center gap-1.5 font-medium text-danger">
                    <WarningCircleIcon size={14} weight="fill" aria-hidden />
                    No {k.skill} capacity this sprint
                  </span>
                )}
                {over ? (
                  <span className="flex items-center gap-1.5 font-medium text-danger">
                    {!gap && <WarningCircleIcon size={14} weight="fill" aria-hidden />}
                    Over by {days(k.over)}
                  </span>
                ) : k.committed !== null ? (
                  <span className="text-ink-muted">{days(round(k.capacity - k.committed))} free</span>
                ) : (
                  // The ticket count below says it when there are tickets.
                  !k.notEstimated && <span className="text-ink-muted">Not estimated</span>
                )}
                {k.notEstimated > 0 && (
                  <span className="text-ink-faint">{plural(k.notEstimated, "ticket")} not estimated</span>
                )}
              </p>
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
  );
}

// ---- Capacity sheet ----

export function Sheet({ sheet, sprintId, canEdit }: { sheet: CapacitySheet; sprintId: number; canEdit: boolean }) {
  const holidays = sheet.holidays.length ? ` - ${plural(sheet.holidays.length, "holiday")}` : "";
  const formula = `(${days(sheet.workingDays)} - leave${holidays}) x ${sheet.focusPercent}%`;

  return (
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
  );
}

type Commitment = CapacitySheet["commitment"];

const round = (n: number) => Math.round(n * 100) / 100;

export function Unestimated({ tickets }: { tickets: Commitment["unestimated"] }) {
  return (
    // Beside Committed, the card takes that card's height (size containment) and fits its rows into it, until opened.
    <section
      aria-labelledby="unestimated"
      className={`${card} flex flex-col lg:self-stretch lg:[contain:size] lg:has-data-open:[contain:none]`}
    >
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
        <FitList className="divide-y divide-line border-t border-line">
          {tickets.map((t) => (
            <li key={t.key} className="flex items-baseline gap-3 px-4 py-2.5 text-sm sm:px-5">
              <TicketKey ticket={t} />
              <span className="min-w-0 truncate" title={t.summary}>
                {t.summary}
              </span>
              <span className="ml-auto shrink-0 text-xs text-ink-faint">{t.type}</span>
            </li>
          ))}
        </FitList>
      )}
    </section>
  );
}
