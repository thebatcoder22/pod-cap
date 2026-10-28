import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";
import { day } from "@/lib/format";
import { GROUPS, type LoadTicket, Owners, Priority, SkillDays, StatusIcon, card } from "./pod-ui";
import { CrossPod, NoOwner } from "./workload";

export function TicketTable({ tickets }: { tickets: LoadTicket[] }) {
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
                      {t.effortSprints > 1 && <span>Per sprint, of {t.effortSprints} sprints</span>}
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
