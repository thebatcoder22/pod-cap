import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDotsIcon, ChartLineUpIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/brand";
import { dateTime } from "@/lib/format";
import { getPodPage } from "@/server/pods";
import { requireViewer } from "@/server/session";
import { getSprintView } from "@/server/sprints";
import { getSyncStatus } from "@/server/sync";
import { getCapacitySheet } from "@/server/capacity";
import { getPickUp } from "@/server/pick-up";
import { getEpicList } from "@/server/epics";
import { SyncNowButton } from "./sprint-controls";
import { badge, plural, rise } from "./pod-ui";
import { Sprint } from "./sprint";
import { Epics, PendingInJira } from "./epics";
import { Team } from "./team";

// Covers the "Sync now" server action on this page.
export const maxDuration = 300;

export default function PodPage({ params, searchParams }: PageProps<"/pods/[slug]">) {
  return (
    <Suspense fallback={<PodSkeleton />}>
      <Pod params={params} searchParams={searchParams} />
    </Suspense>
  );
}
async function Pod({ params, searchParams }: PageProps<"/pods/[slug]">) {
  const [{ slug }, { sprint: requested }, viewer] = await Promise.all([params, searchParams, requireViewer()]);
  const page = await getPodPage(slug);
  if (!page) notFound();
  const [view, sync, epics] = await Promise.all([
    getSprintView(page.pod.jiraPodOptionId, typeof requested === "string" ? requested : undefined),
    getSyncStatus(),
    getEpicList(page.pod),
  ]);

  const capacity = view.sprint && (await getCapacitySheet(page, view.sprint, view.tickets));
  // A closed sprint has nothing left to pick up.
  const pickUp =
    view.sprint && view.sprint.state !== "closed" && capacity ? await getPickUp(page, view.sprint, capacity) : null;
  const { pod, members } = page;
  const lead = members.find((m) => m.isLead);
  const canEdit = viewer.canEdit && viewer.pod?.id === pod.id;

  return (
    <div className="space-y-8">
      <header {...rise(0)} className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{pod.name}</h1>
            <span className={`${badge} ${canEdit ? "bg-accent-soft text-accent" : "bg-fill text-ink-muted"}`}>
              {canEdit ? "Your pod" : "Read only"}
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
          <Link
            href={`/pods/${pod.slug}/calendar`}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-muted transition hover:bg-fill hover:text-ink"
          >
            <CalendarDotsIcon size={16} aria-hidden />
            Calendar
          </Link>
          <Link
            href={`/pods/${pod.slug}/trends`}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-muted transition hover:bg-fill hover:text-ink"
          >
            <ChartLineUpIcon size={16} aria-hidden />
            Trends
          </Link>
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
        <Sprint page={page} view={view} capacity={capacity} pickUp={pickUp} canEdit={canEdit} />
      </div>

      <div {...rise(3)}>
        <PendingInJira epics={epics} />
      </div>

      <div {...rise(4)}>
        <Epics epics={epics} pod={pod} canEdit={canEdit} />
      </div>

      <div {...rise(5)}>
        <Team members={members} canEdit={canEdit} />
      </div>
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
