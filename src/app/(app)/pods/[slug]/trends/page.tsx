import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRightIcon, ChartLineUpIcon } from "@phosphor-icons/react/dist/ssr";
import { SKILLS } from "@/db/schema";
import { day } from "@/lib/format";
import { getPodPage } from "@/server/pods";
import { requireViewer } from "@/server/session";
import { getTrends, snapshotableSprints, type Trend } from "@/server/snapshots";
import { TakeSnapshot } from "./take-snapshot";

export default function TrendsPage({ params }: PageProps<"/pods/[slug]/trends">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-lg bg-fill" />}>
      <Trends params={params} />
    </Suspense>
  );
}

const card = "overflow-hidden rounded-lg border border-line bg-surface shadow-card";
const badge = "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium";
const rise = (i: number) => ({ className: "rise", style: { "--i": i } as React.CSSProperties });
const STATE_LABEL = { active: "Active", future: "Upcoming", closed: "Closed" };

async function Trends({ params }: Pick<PageProps<"/pods/[slug]/trends">, "params">) {
  const [{ slug }, viewer] = await Promise.all([params, requireViewer()]);
  const page = await getPodPage(slug);
  if (!page) notFound();
  const { pod } = page;
  const [trends, sprints] = await Promise.all([getTrends(pod.id), viewer.isAdmin ? snapshotableSprints() : []]);

  // Skills the pod has neither people nor work in stay out of the way.
  const skills = SKILLS.filter((skill) =>
    trends.some((t) => {
      const k = t.skills.find((s) => s.skill === skill)!;
      return (k.capacity ?? 0) > 0 || k.committed !== null || k.completed !== null;
    }),
  );

  return (
    <div className="space-y-8">
      <header {...rise(0)} className="rise space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Link href={`/pods/${pod.slug}`} className="hover:text-accent">
            {pod.name}
          </Link>
          <CaretRightIcon size={12} className="text-ink-faint" aria-hidden />
          <span aria-current="page">Trends</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">{pod.name} trends</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Capacity and committed skill-days as they stood when each sprint started, and the skill-days of tickets Done
          in Jira when it closed. The Jira sync takes these snapshots when it sees a sprint start or close.
        </p>
      </header>

      {viewer.isAdmin && sprints.length > 0 && (
        <section {...rise(1)} aria-labelledby="take" className={`${card} rise space-y-3 p-5`}>
          <div>
            <h2 id="take" className="text-sm font-medium">
              Take a snapshot
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              For a sprint the sync did not see start or close. Retaking replaces {pod.name}&apos;s earlier snapshot
              with today&apos;s numbers.
            </p>
          </div>
          <TakeSnapshot podId={pod.id} sprints={sprints} />
        </section>
      )}

      <section {...rise(2)} aria-labelledby="by-sprint" className="rise">
        <h2 id="by-sprint" className="sr-only">
          By sprint
        </h2>
        {trends.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
            <span className="grid size-10 place-items-center rounded-lg bg-fill text-ink-muted">
              <ChartLineUpIcon size={20} aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium">No snapshots yet.</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              The first one is taken when the next sprint starts in Jira.
            </p>
          </div>
        ) : (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th scope="col" className="py-2.5 pr-4 pl-5 font-medium">
                    Sprint
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Skill
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Capacity
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Committed
                  </th>
                  <th scope="col" className="py-2.5 pr-5 pl-4 text-right font-medium">
                    Completed
                  </th>
                </tr>
              </thead>
              {trends.map((t) => (
                <SprintRows key={t.sprint.id} trend={t} skills={skills} slug={pod.slug} />
              ))}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SprintRows({ trend: t, skills, slug }: { trend: Trend; skills: (typeof SKILLS)[number][]; slug: string }) {
  const rows = [...t.skills.filter((k) => skills.includes(k.skill)), { skill: "Total", ...t.total }];
  const { sprint } = t;
  const cell = "px-4 py-2 text-right tabular-nums";

  return (
    <tbody aria-label={sprint.name} className="border-b border-line last:border-b-0">
      {rows.map((k, i) => {
        const isTotal = k.skill === "Total";
        return (
          <tr
            key={k.skill}
            aria-label={`${sprint.name} ${k.skill}`}
            className={isTotal ? "font-medium [&>td]:border-t [&>td]:border-line" : ""}
          >
            {i === 0 && (
              <th scope="rowgroup" rowSpan={rows.length} className="py-3 pr-4 pl-5 text-left align-top font-normal">
                <span className="flex flex-wrap items-center gap-2">
                  {sprint.state ? (
                    <Link href={`/pods/${slug}?sprint=${sprint.id}`} className="font-medium hover:text-accent">
                      {sprint.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{sprint.name}</span>
                  )}
                  <span
                    className={`${badge} ${sprint.state === "active" ? "bg-accent-soft text-accent" : "bg-fill text-ink-muted"}`}
                  >
                    {sprint.state ? STATE_LABEL[sprint.state] : "Off the board"}
                  </span>
                </span>
                {sprint.startDate && sprint.endDate && (
                  <span className="mt-1 block text-xs text-ink-muted">
                    {day(sprint.startDate)} to {day(sprint.endDate)}
                  </span>
                )}
                <span className="mt-2 block space-y-0.5 text-xs text-ink-faint">
                  <span className="block">
                    {t.startedAt ? `Start snapshot ${day(t.startedAt)}` : "No start snapshot"}
                  </span>
                  <span className="block">
                    {t.closedAt
                      ? `Close snapshot ${day(t.closedAt)}`
                      : sprint.state === "active"
                        ? "Not closed yet"
                        : "No close snapshot"}
                  </span>
                </span>
              </th>
            )}
            <td className={`px-4 py-2 ${isTotal ? "" : "font-mono text-xs text-ink-muted"}`}>{k.skill}</td>
            <td className={cell}>{k.capacity ?? <Missing />}</td>
            <td className={cell}>
              {k.committed === null ? (
                t.startedAt ? (
                  <span className="text-ink-faint">Not estimated</span>
                ) : (
                  <Missing />
                )
              ) : (
                <span className={k.over ? "font-semibold text-danger" : ""}>
                  {k.committed}
                  {k.over && <span className="ml-1.5 text-xs">+{k.over} over</span>}
                </span>
              )}
            </td>
            <td className={`${cell} pr-5`}>
              {k.completed === null ? (
                t.closedAt ? (
                  <span className="text-ink-faint">None</span>
                ) : (
                  <Missing />
                )
              ) : (
                <>
                  {k.completed}
                  {k.donePercent !== null && <span className="ml-1.5 text-xs text-ink-muted">{k.donePercent}%</span>}
                </>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

function Missing() {
  return (
    <span className="text-ink-faint" aria-label="No snapshot">
      -
    </span>
  );
}
