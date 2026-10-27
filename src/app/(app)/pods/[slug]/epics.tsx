import Link from "next/link";
import { TrayIcon } from "@phosphor-icons/react/dist/ssr";
import { PendingEpics, TicketKey } from "@/components/jira";
import { day } from "@/lib/format";
import type { PodPage as PodData } from "@/server/pods";
import type { EpicList } from "@/server/epics";
import { EpicSize } from "./epic-size";
import { Empty, SkillDays, StatusIcon, card, plural, skillCell } from "./pod-ui";

// ---- Pending in Jira ----

/** What only Jira can fill in on the pod's epics, for the lead to pass on to their PM. Hidden when nothing is. */
export function PendingInJira({ epics }: { epics: EpicList }) {
  const pending = epics.filter((e) => e.missing.length);
  if (!pending.length) return null;
  return (
    <section aria-labelledby="pending" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="pending" className="text-base font-semibold tracking-tight">
          Pending in Jira
        </h2>
        <p className="text-xs text-ink-faint">For the PM to fill in on each epic</p>
      </div>
      <PendingEpics epics={pending} />
    </section>
  );
}

// ---- Epics ----

export function Epics({ epics, pod, canEdit }: { epics: EpicList; pod: PodData["pod"]; canEdit: boolean }) {
  // Phones drop the skill-days and date columns and show them under the summary instead.
  const wide = "hidden md:table-cell";
  return (
    <section aria-labelledby="epics" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="epics" className="text-base font-semibold tracking-tight">
          Epics
        </h2>
        <p className="text-xs text-ink-faint">T-shirt size next to the skill-days estimated on its tickets</p>
      </div>
      {epics.length === 0 ? (
        <Empty icon={<TrayIcon size={20} aria-hidden />} title={`No ${pod.name} epics yet.`}>
          Epics show here when their POD field is {pod.name}, or when {pod.name} has tickets in them.
        </Empty>
      ) : (
        <div className={card}>
          <table className="w-full text-sm md:table-fixed">
            <colgroup>
              <col />
              <col className="w-32" />
              <col className="hidden w-64 md:table-column" />
              <col className="hidden w-36 md:table-column" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th scope="col" className="py-2.5 pr-4 pl-4 font-medium md:pl-5">
                  Epic
                </th>
                <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                  Size
                </th>
                <th scope="col" className={`${wide} px-4 py-2.5 font-medium`}>
                  Skill-days
                </th>
                <th scope="col" className={`${wide} py-2.5 pr-5 pl-4 font-medium`}>
                  Ready for prod
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {epics.map((e) => (
                <tr key={e.key} aria-label={e.summary} className="align-top transition-colors hover:bg-fill/50">
                  <td className="py-3 pr-4 pl-4 md:pl-5">
                    <p className="flex items-baseline gap-3">
                      <TicketKey ticket={e} />
                      <span className="leading-5 font-medium">{e.summary}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <StatusIcon category={e.statusCategory} size={14} />
                        {e.status}
                      </span>
                      <span>{plural(e.tickets, "ticket")}</span>
                      {!e.owner ? (
                        <span>No POD in Jira, shared by several pods</span>
                      ) : (
                        e.owner.id !== pod.id && (
                          <Link href={`/pods/${e.owner.slug}`} className="text-ink-muted hover:text-accent">
                            {e.owner.name}&apos;s epic
                          </Link>
                        )
                      )}
                    </p>
                    <div className="mt-2 space-y-1.5 text-xs md:hidden">
                      <EpicSkillDays epic={e} />
                      {e.readyForProductionDate && (
                        <p className="text-ink-muted">Ready for prod {day(new Date(e.readyForProductionDate))}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {canEdit && e.owner?.id === pod.id ? (
                      <EpicSize epicKey={e.key} size={e.size} className={`${skillCell} text-sm`} />
                    ) : (
                      <span className={`${skillCell} border-transparent ${e.size ? "font-medium" : "text-ink-faint"}`}>
                        {e.size ?? "Not sized"}
                      </span>
                    )}
                  </td>
                  <td className={`${wide} px-4 py-3 text-xs`}>
                    <EpicSkillDays epic={e} />
                  </td>
                  <td className={`${wide} py-3 pr-5 pl-4 leading-7`}>
                    {e.readyForProductionDate ? (
                      day(new Date(e.readyForProductionDate))
                    ) : (
                      <span className="text-ink-faint">Not set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EpicSkillDays({ epic: e }: { epic: EpicList[number] }) {
  if (!e.tickets) return <span className="leading-7 text-ink-faint">No tickets yet</span>;
  const estimated = Object.fromEntries(e.skills.flatMap((k) => (k.days === null ? [] : [[k.skill, k.days]])));
  return (
    <span className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
      <SkillDays days={estimated} empty="Not estimated" />
      {e.unestimated > 0 && e.unestimated < e.tickets && (
        <span className="text-ink-faint">
          {e.unestimated} of {plural(e.tickets, "ticket")} not estimated
        </span>
      )}
    </span>
  );
}
