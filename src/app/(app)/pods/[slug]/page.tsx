import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowSquareOutIcon, CalendarBlankIcon, TrayIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { SKILLS } from "@/db/schema";
import { initials } from "@/components/brand";
import { dateTime, day } from "@/lib/format";
import { getPodPage, type PodPage as PodData } from "@/server/pods";
import { requireViewer } from "@/server/session";
import { getSprintView, type SprintView } from "@/server/sprints";
import { BOARD_ID, getSyncStatus } from "@/server/sync";
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

const card = "overflow-hidden rounded-lg border border-line bg-surface shadow-card";
const sectionTitle = "text-base font-semibold tracking-tight";
/** Sets the order a section rises in on load. */
const rise = (i: number) => ({ className: "rise", style: { "--i": i } as React.CSSProperties });

async function Pod({ params, searchParams }: PageProps<"/pods/[slug]">) {
  const [{ slug }, { sprint: requested }, viewer] = await Promise.all([params, searchParams, requireViewer()]);
  const page = await getPodPage(slug);
  if (!page) notFound();
  const [view, sync] = await Promise.all([
    getSprintView(page.pod.jiraPodValue, typeof requested === "string" ? requested : undefined),
    getSyncStatus(),
  ]);

  const { pod, members } = page;
  const lead = members.find((m) => m.isLead);
  const isOwn = viewer.pod?.id === pod.id;

  return (
    <div className="space-y-10">
      <header {...rise(0)}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{pod.name}</h1>
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                  isOwn ? "bg-accent-soft text-accent" : "border border-line text-ink-muted"
                }`}
              >
                {isOwn ? "Your pod" : "Read only"}
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              {lead ? <>Led by {lead.name}, </> : null}
              {members.length} {members.length === 1 ? "person" : "people"}. Jira POD{" "}
              <span className="font-medium text-ink">{pod.jiraPodValue}</span>
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
        </div>
      </header>

      {sync.failure && (
        <div
          role="alert"
          {...rise(1)}
          className="rise flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-sm"
        >
          <WarningCircleIcon size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
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
        <SprintTickets podName={pod.name} view={view} />
      </div>

      <div {...rise(3)} className="rise grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
        <TeamShape members={members} />
        <Members members={members} />
      </div>
    </div>
  );
}

const STATE_LABEL = { active: "Active", future: "Upcoming", closed: "Closed" };
const CATEGORIES = [
  ["new", "To do"],
  ["indeterminate", "In progress"],
  ["done", "Done"],
] as const;

function SprintTickets({ podName, view }: { podName: string; view: SprintView }) {
  const { sprint, tickets } = view;
  return (
    <section aria-labelledby="sprint" className="space-y-3">
      <h2 id="sprint" className={sectionTitle}>
        Sprint tickets
      </h2>

      {!sprint ? (
        <Empty icon={<TrayIcon size={20} aria-hidden />} title="No sprints yet">
          Press Sync now to pull the sprints on board {BOARD_ID} from Jira.
        </Empty>
      ) : (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line px-5 py-3.5">
            <SprintPicker
              sprints={view.sprints.map((s) => ({ id: s.id, name: s.name, state: s.state }))}
              selected={sprint.id}
            />
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
              <CalendarBlankIcon size={16} className="text-ink-faint" aria-hidden />
              {sprint.startDate && sprint.endDate
                ? `${day(sprint.startDate)} to ${day(sprint.endDate)}`
                : "No dates set"}
            </p>
            <span
              className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                sprint.state === "active" ? "bg-accent-soft text-accent" : "border border-line text-ink-muted"
              }`}
            >
              {STATE_LABEL[sprint.state]}
            </span>
            {tickets.length > 0 && (
              <p className="text-sm text-ink-faint sm:ml-auto">
                {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
              </p>
            )}
          </div>

          {tickets.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium">
                No {podName} tickets in {sprint.name}.
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Tickets show here when their POD field is {podName} and they are in this sprint.
              </p>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
                {CATEGORIES.map(([category, label]) => (
                  <Stat
                    key={category}
                    label={label}
                    value={tickets.filter((t) => t.statusCategory === category).length}
                  />
                ))}
              </dl>
              <TicketTable tickets={tickets} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${value === 0 ? "text-ink-faint" : ""}`}>{value}</dd>
    </div>
  );
}

const STATUS_STYLE = {
  new: "border border-line-strong text-ink-muted",
  indeterminate: "bg-accent-soft text-accent",
  done: "bg-line/70 text-ink-muted",
};

function TicketTable({ tickets }: { tickets: SprintView["tickets"] }) {
  // Phones drop the status, priority and owners columns and show them under the summary instead.
  const wide = "hidden sm:table-cell";
  return (
    <table className="w-full table-fixed text-sm sm:table-auto">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-faint">
          <th scope="col" className="w-28 py-2.5 pr-2 pl-4 font-medium sm:w-32 sm:px-5">
            Key
          </th>
          <th scope="col" className="py-2.5 pr-4 pl-2 font-medium sm:px-5">
            Summary
          </th>
          <th scope="col" className={`${wide} w-36 px-5 py-2.5 font-medium`}>
            Status
          </th>
          <th scope="col" className={`${wide} w-24 px-5 py-2.5 font-medium`}>
            Priority
          </th>
          <th scope="col" className={`${wide} w-52 px-5 py-2.5 font-medium`}>
            Owners
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {tickets.map((t) => {
          const status = (
            <span
              className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.statusCategory]}`}
            >
              {t.status}
            </span>
          );
          const owners = t.owners.map((o) => o.displayName).join(", ");
          return (
            <tr key={t.key} className="align-top transition-colors hover:bg-bg">
              <td className="py-3 pr-2 pl-4 sm:px-5">
                <a
                  href={t.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-xs leading-5 font-medium text-accent hover:underline"
                >
                  {t.key}
                  {t.url && (
                    <>
                      <ArrowSquareOutIcon size={12} aria-hidden />
                      <span className="sr-only">(opens Jira)</span>
                    </>
                  )}
                </a>
              </td>
              <td className="py-3 pr-4 pl-2 sm:px-5">
                <p className="font-medium">{t.summary}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
                  <span>{t.type}</span>
                  {t.epic && (
                    <a
                      href={t.epic.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-ink hover:underline"
                    >
                      Epic: {t.epic.summary}
                    </a>
                  )}
                  {t.readyForProductionDate && <span>Ready for prod {day(new Date(t.readyForProductionDate))}</span>}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted sm:hidden">
                  {status}
                  <span>{owners || "Unassigned"}</span>
                </p>
              </td>
              <td className={`${wide} px-5 py-3`}>{status}</td>
              <td className={`${wide} px-5 py-3 text-ink-muted`}>{t.priority ?? "None"}</td>
              <td className={`${wide} px-5 py-3`}>
                {owners ? (
                  <span className="flex items-start gap-2">
                    <span aria-hidden className="flex shrink-0 -space-x-1.5">
                      {t.owners.slice(0, 3).map((o) => (
                        <span
                          key={o.accountId}
                          className="grid size-5 place-items-center rounded-md bg-line text-[9px] font-semibold text-ink-muted ring-2 ring-surface"
                        >
                          {initials(o.displayName)}
                        </span>
                      ))}
                    </span>
                    <span>{owners}</span>
                  </span>
                ) : (
                  <span className="text-ink-faint">Unassigned</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TeamShape({ members }: { members: PodData["members"] }) {
  return (
    <section aria-labelledby="shape" className="space-y-3">
      <h2 id="shape" className={sectionTitle}>
        Team shape
      </h2>
      <ul className={`${card} divide-y divide-line`}>
        {SKILLS.map((skill) => {
          const people = members.filter((m) => m.mainSkill === skill);
          return (
            <li key={skill} className="flex min-h-14 items-center gap-4 px-5 py-3">
              <span className="w-10 font-mono text-xs text-ink-faint">{skill}</span>
              <span className={`w-6 text-lg font-semibold tabular-nums ${people.length ? "" : "text-ink-faint"}`}>
                {people.length}
              </span>
              <span className={`min-w-0 truncate text-sm ${people.length ? "text-ink-muted" : "text-ink-faint"}`}>
                {people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : "No one yet"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Members({ members }: { members: PodData["members"] }) {
  return (
    <section aria-labelledby="members" className="space-y-3">
      <h2 id="members" className={sectionTitle}>
        Members
      </h2>
      {members.length === 0 ? (
        <Empty icon={<TrayIcon size={20} aria-hidden />} title="No one is in this pod yet" />
      ) : (
        <div className={card}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Name
                </th>
                <th scope="col" className="w-28 px-5 py-2.5 font-medium sm:w-36">
                  Main skill
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-bg">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                          m.isLead ? "bg-accent-soft text-accent" : "bg-line/70 text-ink-muted"
                        }`}
                      >
                        {initials(m.name)}
                      </span>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{m.name}</span>
                        {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-lg border border-line px-2 py-0.5 font-mono text-xs">{m.mainSkill}</span>
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

function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-line/70 text-ink-muted">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p>}
    </div>
  );
}

function PodSkeleton() {
  const block = "rounded-lg border border-line bg-surface";
  return (
    <div aria-hidden className="animate-pulse space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="h-9 w-44 rounded-lg bg-line" />
          <div className="h-4 w-72 rounded-lg bg-line/70" />
        </div>
        <div className="hidden h-8 w-64 rounded-lg bg-line/70 sm:block" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-28 rounded-lg bg-line" />
        <div className={`${block} h-72`} />
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-8">
        <div className={`${block} h-60`} />
        <div className={`${block} h-60`} />
      </div>
    </div>
  );
}
