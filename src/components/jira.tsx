import { ArrowSquareOutIcon, CircleDashedIcon } from "@phosphor-icons/react/dist/ssr";
import type { EpicList } from "@/server/epics";

/** A Jira key, linked to the issue when Jira is connected. */
export function TicketKey({ ticket }: { ticket: { key: string; url: string | null } }) {
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

/** Where an epic's tickets are, most first: "7 tickets in RoadMap 2, 1 in RoadMap 1". */
function ticketPods(pods: EpicList[number]["pods"]) {
  if (!pods.length) return "None of its tickets is in a pod yet";
  return pods
    .toSorted((a, b) => b.tickets - a.tickets)
    .map((p, i) => `${i ? p.tickets : `${p.tickets} ${p.tickets === 1 ? "ticket" : "tickets"}`} in ${p.name}`)
    .join(", ");
}

/** Epics with something only Jira can fill in, each with what to set. */
export function PendingEpics({ epics }: { epics: EpicList }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {epics.map((e) => (
        <li
          key={e.key}
          aria-label={e.summary}
          className="flex flex-col gap-2 px-4 py-3 text-sm sm:px-5 md:flex-row md:items-baseline md:gap-6"
        >
          <p className="flex min-w-0 items-baseline gap-3 md:flex-1">
            <TicketKey ticket={e} />
            <span className="truncate leading-5 font-medium" title={e.summary}>
              {e.summary}
            </span>
          </p>
          <ul className="space-y-1.5 md:w-[28rem] md:shrink-0">
            {e.missing.map((gap) => (
              <li key={gap} className="flex items-baseline gap-2 leading-5">
                <CircleDashedIcon
                  size={14}
                  weight="bold"
                  className="shrink-0 translate-y-0.5 text-ink-faint"
                  aria-hidden
                />
                <span>
                  Set its {gap}
                  {gap === "POD" && <span className="block text-xs text-ink-faint">{ticketPods(e.pods)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
