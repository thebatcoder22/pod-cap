import Link from "next/link";
import { CaretRightIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { TicketKey } from "@/components/jira";
import type { PickUpPanel } from "@/server/pick-up";
import { Priority, SkillDays, badge, card, cardTitle, days, plural } from "./pod-ui";

// ---- Who can pick up more ----

/** Enough to choose from, of exact matches and of stretch options each, so stretches are never crowded out. */
const SHOWN_SUGGESTIONS = 5;

const shown = <T extends { stretch: boolean }>(suggestions: T[]) => [
  ...suggestions.filter((t) => !t.stretch).slice(0, SHOWN_SUGGESTIONS),
  ...suggestions.filter((t) => t.stretch).slice(0, SHOWN_SUGGESTIONS),
];

/** People with free days, and the backlog tickets that fit them. Suggestions only: assigning happens in Jira. */
export function PickUp({ pickUp }: { pickUp: PickUpPanel }) {
  return (
    <section aria-labelledby="pick-up" className={card}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="pick-up" className={cardTitle}>
          Who can pick up more
        </h3>
        <span className="text-xs text-ink-faint">Assign in Jira</span>
      </div>
      {pickUp.people.length === 0 ? (
        <p className="border-t border-line px-4 py-4 text-sm text-ink-muted sm:px-5">
          No one has free days in this sprint.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {pickUp.people.map((p) => (
            <li key={p.id}>
              <details className="group">
                <summary
                  aria-label={`What ${p.name} could pick up`}
                  className="grid cursor-pointer list-none grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-fill/50 sm:px-5 [&::-webkit-details-marker]:hidden"
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
                  <span className="text-right text-xs">
                    <span className="font-medium text-ink tabular-nums">{days(p.free)} free</span>
                    <span className="text-ink-muted">, {plural(p.suggestions.length, "ticket")} fit</span>
                  </span>
                </summary>
                {p.suggestions.length === 0 ? (
                  <p className="px-4 pb-3 pl-11 text-sm text-ink-faint sm:pl-12">
                    No estimated backlog ticket fits these days.
                  </p>
                ) : (
                  <ul aria-label={`${p.name}'s suggestions`} className="space-y-2 px-4 pb-3.5 pl-11 sm:pr-5 sm:pl-12">
                    {shown(p.suggestions).map((t) => (
                      // Phones put the chips on their own line, so the summary keeps its width.
                      <li key={t.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                        <TicketKey ticket={t} />
                        <span className="min-w-0 flex-1 truncate" title={t.summary}>
                          {t.summary}
                        </span>
                        <span className="flex w-full shrink-0 items-center gap-3 text-xs sm:w-auto">
                          <span className="sr-only sm:not-sr-only">
                            <Priority name={t.priority} />
                          </span>
                          <SkillDays days={{ [t.skill]: t.days }} empty="" />
                          {t.stretch && (
                            <span
                              className={`${badge} bg-accent-soft text-accent`}
                              title={`${p.proficiency[t.skill]}% in ${t.skill}`}
                            >
                              Stretch, {days(t.cost)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                    {p.suggestions.length > shown(p.suggestions).length && (
                      <li className="text-xs text-ink-faint">
                        And {plural(p.suggestions.length - shown(p.suggestions).length, "more ticket")} that fit
                      </li>
                    )}
                  </ul>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Each overloaded skill, who in the pod could cover it as a stretch, and which pods have the skill free. */
export function OverloadedSkills({ short, sprintId }: { short: PickUpPanel["short"]; sprintId: number }) {
  return (
    <section aria-labelledby="short" className={card}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-3 sm:px-5">
        <h3 id="short" className={cardTitle}>
          Covering overloaded skills
        </h3>
      </div>
      {short.length === 0 ? (
        <p className="flex items-center gap-2 border-t border-line px-4 py-4 text-sm text-ink-muted sm:px-5">
          <CheckCircleIcon size={16} weight="fill" className="text-success" aria-hidden />
          No skill is over capacity.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {short.map((k) => (
            <li key={k.skill} aria-label={`Covering ${k.skill}`} className="space-y-2.5 px-4 py-3.5 text-sm sm:px-5">
              <p className="flex items-center gap-1.5 font-medium text-danger">
                <WarningCircleIcon size={16} weight="fill" aria-hidden />
                {k.skill} over by {days(k.over)}
              </p>
              <div>
                <h4 className="text-xs text-ink-muted">In this pod, as a stretch</h4>
                {k.cover.length === 0 ? (
                  <p className="mt-1 text-ink-faint">No one here with free days has {k.skill} proficiency.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {k.cover.map((p) => (
                      <li key={p.id} className="flex items-baseline gap-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-ink-faint">{p.proficiency[k.skill]}%</span>
                        <span className="ml-auto text-ink-muted tabular-nums">{plural(p.absorb, "skill-day")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-xs text-ink-muted">Free {k.skill} in other pods</h4>
                {k.elsewhere.length === 0 ? (
                  <p className="mt-1 text-ink-faint">No other pod has {k.skill} days free.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {k.elsewhere.map((o) => (
                      <li key={o.slug} className="flex items-baseline gap-2">
                        <Link href={`/pods/${o.slug}?sprint=${sprintId}`} className="font-medium hover:text-accent">
                          {o.pod}
                        </Link>
                        <span className="ml-auto text-ink-muted tabular-nums">{days(o.free)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
