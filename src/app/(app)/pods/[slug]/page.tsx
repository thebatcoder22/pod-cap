import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowSquareOutIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { SKILLS } from "@/db/schema";
import { getPodPage } from "@/server/pods";
import { requireViewer } from "@/server/session";
import { getSprintView, type SprintView } from "@/server/sprints";
import { BOARD_ID, getSyncStatus, type SyncStatus } from "@/server/sync";
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

const when = (d: Date, style: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("en-GB", { ...style, timeZone: "Asia/Kolkata" });
const dateTime = (d: Date) => when(d, { dateStyle: "medium", timeStyle: "short" });
const day = (d: Date) => when(d, { day: "numeric", month: "short" });

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
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{pod.name}</h1>
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
              isOwn ? "bg-accent-soft text-accent" : "border border-line text-ink-muted"
            }`}
          >
            {isOwn ? "Your pod" : "Read only"}
          </span>
        </div>
        <p className="text-sm text-ink-muted">
          {lead ? <>Led by {lead.name}. </> : null}
          Jira POD <span className="font-medium text-ink">{pod.jiraPodValue}</span>
        </p>
      </section>

      {sync.failure && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-sm"
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

      <section aria-labelledby="shape" className="space-y-3">
        <h2 id="shape" className="text-sm font-medium text-ink-muted">
          Team shape
        </h2>
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4">
          {SKILLS.map((skill, i) => {
            const n = members.filter((m) => m.mainSkill === skill).length;
            return (
              <div
                key={skill}
                className={`border-line px-5 py-4 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}
              >
                <dt className="font-mono text-xs text-ink-faint">{skill}</dt>
                <dd className={`mt-1 text-xl font-semibold tabular-nums ${n === 0 ? "text-ink-faint" : ""}`}>
                  {n}
                  <span className="ml-1.5 text-sm font-normal text-ink-muted">{n === 1 ? "person" : "people"}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="members" className="space-y-3">
        <h2 id="members" className="text-sm font-medium text-ink-muted">
          Members
        </h2>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-sm text-ink-muted">
            No one is in this pod yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="w-28 px-5 py-2.5 font-medium sm:w-40">
                    Main skill
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="grid size-8 shrink-0 place-items-center rounded-lg bg-line/70 text-xs font-medium text-ink-muted"
                        >
                          {initials(m.name)}
                        </span>
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{m.name}</span>
                          {m.isLead && <span className="text-xs text-ink-faint">Lead</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-lg border border-line px-2 py-0.5 font-mono text-xs">{m.mainSkill}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SprintTickets podName={pod.name} view={view} sync={sync} />
    </div>
  );
}

function SprintTickets({ podName, view, sync }: { podName: string; view: SprintView; sync: SyncStatus }) {
  const { sprint, tickets } = view;
  return (
    <section aria-labelledby="sprint" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sprint" className="text-sm font-medium text-ink-muted">
          Sprint tickets
        </h2>
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

      {!sprint ? (
        <p className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-sm text-ink-muted">
          No sprints yet. Sync with Jira to pull the sprints on board {BOARD_ID}.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
            <SprintPicker
              sprints={view.sprints.map((s) => ({ id: s.id, name: s.name, state: s.state }))}
              selected={sprint.id}
            />
            <p className="text-sm text-ink-muted">
              {sprint.startDate && sprint.endDate
                ? `${day(sprint.startDate)} to ${day(sprint.endDate)}`
                : "No dates set"}
              <span className="text-ink-faint"> · {sprint.state === "future" ? "upcoming" : sprint.state}</span>
            </p>
            <p className="text-sm text-ink-faint sm:ml-auto">
              {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
            </p>
          </div>
          {tickets.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              No {podName} tickets in {sprint.name}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th scope="col" className="w-28 px-5 py-2.5 font-medium">
                      Key
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Summary
                    </th>
                    <th scope="col" className="w-32 px-5 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="w-24 px-5 py-2.5 font-medium">
                      Priority
                    </th>
                    <th scope="col" className="w-48 px-5 py-2.5 font-medium">
                      Owners
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tickets.map((t) => {
                    return (
                      <tr key={t.key} className="align-top">
                        <td className="px-5 py-3">
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
                        <td className="px-5 py-3">
                          <p className="font-medium">{t.summary}</p>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
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
                            {t.readyForProductionDate && (
                              <span>Ready for prod {day(new Date(t.readyForProductionDate))}</span>
                            )}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${
                              t.statusCategory === "done"
                                ? "bg-line/70 text-ink-muted"
                                : t.statusCategory === "indeterminate"
                                  ? "bg-accent-soft text-accent"
                                  : "border border-line text-ink-muted"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{t.priority ?? "None"}</td>
                        <td className="px-5 py-3">
                          {t.owners.length ? (
                            t.owners.map((o) => o.displayName).join(", ")
                          ) : (
                            <span className="text-ink-faint">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function initials(name: string) {
  const parts = name.split(" ");
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function PodSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-10">
      <div className="space-y-3">
        <div className="h-7 w-40 rounded-lg bg-line" />
        <div className="h-4 w-64 rounded-lg bg-line/70" />
      </div>
      <div className="h-[86px] rounded-lg border border-line bg-surface" />
      <div className="h-72 rounded-lg border border-line bg-surface" />
      <div className="h-56 rounded-lg border border-line bg-surface" />
    </div>
  );
}
