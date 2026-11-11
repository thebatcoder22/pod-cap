import { Suspense } from "react";
import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { CapacityBar, rise } from "@/app/(app)/pods/[slug]/pod-ui";
import { day, isoDay } from "@/lib/format";
import { bandwidthFrom, getBandwidth, shiftWeeks, BANDWIDTH_WEEKS, type Bandwidth } from "@/server/bandwidth";
import { mondayOf } from "@/server/planning";
import { DAY_MS } from "@/server/planning-days";
import { requireViewer } from "@/server/session";

type Cell = NonNullable<Bandwidth["pods"][number]["people"][number]["sprints"][number]>;

/** How far the arrows move: three sprints. */
const STEP = 6;
/** Epics shown per cell before the rest fold into "+N more". */
const SHOWN = 3;
const label = (d: string) => day(new Date(`${d}T00:00:00Z`));
/** 4.5, 7, never 4.50. */
const n = (d: number) => Number(d.toFixed(1));

export default function BandwidthPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bandwidth</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Who is working on what, sprint by sprint, across every pod: the epics of the tickets each person owns in Jira,
          and their days booked against the days they can plan.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden className="h-[36rem] animate-pulse rounded-lg bg-fill" />}>
        <Sheet searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Sheet({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  const [{ from }] = await Promise.all([searchParams, requireViewer()]);
  const sheet = await getBandwidth(bandwidthFrom(typeof from === "string" ? from : undefined));
  const thisWeek = mondayOf(isoDay(new Date()));
  // One scale for every bar on the sheet, so a long bar is a heavy sprint wherever it sits.
  const max = Math.max(
    1,
    ...sheet.pods.flatMap((p) => p.people.flatMap((m) => m.sprints.flatMap((c) => (c ? [c.capacity, c.booked] : [])))),
  );
  const columns = sheet.weeks.flatMap((r) => r.weeks).length + 1;

  return (
    <div {...rise(1)}>
      <div className="space-y-3">
        <WeekNav from={sheet.from} thisWeek={thisWeek} />
        {sheet.weeks.every((r) => !r.sprint) && (
          <p className="rounded-lg bg-fill px-3 py-2 text-sm text-ink-muted">
            No sprints in these weeks yet. A sprint shows here once it is on the DTP board in Jira, with its dates.
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
          <table className="w-full min-w-[131rem] table-fixed border-separate border-spacing-0 text-xs [&_tbody:last-child_tr:last-child>*]:border-b-0">
            <caption className="sr-only">
              Bandwidth for the {BANDWIDTH_WEEKS} weeks from {label(sheet.from)}
            </caption>
            <colgroup>
              <col className="w-44" />
              {sheet.weeks
                .flatMap((r) => r.weeks)
                .map((w) => (
                  <col key={w} />
                ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-10 border-r border-b border-line bg-surface px-3 text-left font-medium text-ink-faint"
                >
                  Person
                </th>
                {sheet.weeks.map((r) => (
                  <th
                    key={r.weeks[0]}
                    colSpan={r.weeks.length}
                    scope="colgroup"
                    className={`truncate border-r border-line px-3 pt-2.5 pb-1 text-left last:border-r-0 ${
                      r.sprint ? "font-medium text-ink" : "bg-sidebar font-normal text-ink-faint"
                    }`}
                  >
                    {r.sprint?.name ?? "No sprint"}
                  </th>
                ))}
              </tr>
              <tr>
                {sheet.weeks.map((r) =>
                  r.weeks.map((w, i) => (
                    <th
                      key={w}
                      scope="col"
                      className={`border-b border-line px-3 pb-2 text-left font-normal tabular-nums ${
                        i === r.weeks.length - 1 ? "border-r last:border-r-0" : ""
                      } ${r.sprint ? "" : "bg-sidebar"} ${w === thisWeek ? "text-accent" : "text-ink-faint"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {w === thisWeek && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
                        {w === thisWeek ? "This week" : `Week of ${label(w)}`}
                      </span>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            {sheet.pods.map((pod) => (
              <tbody key={pod.slug}>
                <tr>
                  <th
                    colSpan={columns}
                    scope="colgroup"
                    className="border-b border-line bg-sidebar px-0 py-0 text-left"
                  >
                    <span className="sticky left-0 inline-flex items-baseline gap-3 px-3 py-2">
                      <span className="text-sm font-semibold text-ink">{pod.name}</span>
                      <Link
                        href={`/pods/${pod.slug}/calendar`}
                        className="font-normal text-ink-faint transition-colors hover:text-accent"
                      >
                        Calendar
                      </Link>
                    </span>
                  </th>
                </tr>
                {pod.people.length === 0 && (
                  <tr>
                    <td colSpan={columns} className="border-b border-line px-3 py-3 text-ink-faint">
                      Nobody in this pod yet.
                    </td>
                  </tr>
                )}
                {pod.people.map((person) => (
                  <tr key={person.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 truncate border-r border-b border-line bg-surface px-3 py-2.5 text-left align-top text-sm font-medium text-ink"
                    >
                      {person.name}
                    </th>
                    {person.sprints.map((c, i) => (
                      <td
                        key={sheet.weeks[i].weeks[0]}
                        colSpan={sheet.weeks[i].weeks.length}
                        className={`border-r border-b border-line px-2 py-2 align-top last:border-r-0 ${
                          sheet.weeks[i].sprint ? "" : "bg-sidebar"
                        }`}
                      >
                        {c && <SprintCell cell={c} max={max} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="max-w-3xl text-xs text-ink-faint">
          Days booked of plannable days in each sprint, after leave, holidays and the focus factor. Someone in two pods
          shows in each, with that pod&apos;s share of their days and work. Hover an epic for its tickets.
        </p>
      </div>
    </div>
  );
}

/** One person's sprint: the epics they work on, then how full the sprint is. */
function SprintCell({ cell: c, max }: { cell: Cell; max: number }) {
  const over = c.booked > c.capacity;
  const rest = c.work.slice(SHOWN);
  const chip = "block truncate rounded-md bg-fill px-1.5 py-1 text-ink";
  return (
    <div className="flex h-full flex-col gap-2">
      {c.work.length ? (
        <ul className="space-y-1">
          {c.work.slice(0, SHOWN).map((w) => {
            const tip = [w.label, ...w.tickets].join("\n");
            return (
              <li key={w.label}>
                {w.url ? (
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noreferrer"
                    title={tip}
                    className={`${chip} transition hover:ring-1 hover:ring-line-strong`}
                  >
                    {w.label}
                  </a>
                ) : (
                  <span title={tip} className={chip}>
                    {w.label}
                  </span>
                )}
              </li>
            );
          })}
          {rest.length > 0 && (
            <li title={rest.map((w) => w.label).join("\n")} className="px-1.5 text-ink-faint">
              +{rest.length} more
            </li>
          )}
        </ul>
      ) : (
        // Free bandwidth is what product looks for, so an empty sprint says how much.
        <p className="px-1.5 py-1 whitespace-nowrap text-ink-faint tabular-nums">{n(c.capacity)}d free</p>
      )}
      {c.work.length > 0 && (
        <div
          className="mt-auto flex items-center gap-2 px-1.5"
          aria-label={`${n(c.booked)} of ${n(c.capacity)} days booked`}
        >
          <CapacityBar used={c.booked} capacity={c.capacity} max={max} tone="bg-accent" i={0} className="flex flex-1" />
          <span className={`shrink-0 tabular-nums ${over ? "font-medium text-danger" : "text-ink-muted"}`}>
            {n(c.booked)}/{n(c.capacity)}d
          </span>
        </div>
      )}
    </div>
  );
}

function WeekNav({ from, thisWeek }: { from: string; thisWeek: string }) {
  const button =
    "grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink-muted shadow-card transition hover:text-ink active:scale-[0.96]";
  const last = shiftWeeks(from, BANDWIDTH_WEEKS - 1);
  return (
    <div className="flex items-center gap-2">
      <Link href={`/calendar?from=${shiftWeeks(from, -STEP)}`} className={button}>
        <CaretLeftIcon size={14} aria-hidden />
        <span className="sr-only">Earlier weeks</span>
      </Link>
      <h2 className="min-w-40 text-center text-sm font-medium tabular-nums">
        {label(from)} - {label(isoDay(new Date(Date.parse(last) + 4 * DAY_MS)))}
      </h2>
      <Link href={`/calendar?from=${shiftWeeks(from, STEP)}`} className={button}>
        <CaretRightIcon size={14} aria-hidden />
        <span className="sr-only">Later weeks</span>
      </Link>
      {from !== thisWeek && (
        <Link
          href="/calendar"
          className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-ink-muted transition hover:bg-fill hover:text-ink"
        >
          This week
        </Link>
      )}
    </div>
  );
}
