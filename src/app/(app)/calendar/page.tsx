import { Suspense } from "react";
import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { CapacityBar, rise } from "@/app/(app)/pods/[slug]/pod-ui";
import { day, isoDay } from "@/lib/format";
import {
  bandwidthFrom,
  getBandwidth,
  shiftWeeks,
  BANDWIDTH_WEEKS,
  type Bandwidth,
  type Span,
} from "@/server/bandwidth";
import { mondayOf } from "@/server/planning";
import { DAY_MS } from "@/server/planning-days";
import { requireViewer } from "@/server/session";

type Person = Bandwidth["pods"][number]["people"][number];

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
        {/* Scrolls both ways in itself, so the sprint header can stick to its top while the names stick to its left. */}
        <div className="max-h-[calc(100dvh-5rem)] overflow-auto rounded-lg border border-line bg-surface shadow-card">
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
            <thead className="sticky top-0 z-20">
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
                      r.sprint ? "bg-surface font-medium text-ink" : "bg-sidebar font-normal text-ink-faint"
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
                      aria-label={`${w === thisWeek ? "This week, week" : "Week"} of ${label(w)}`}
                      className={`border-b border-line px-3 pb-2 text-left font-normal tabular-nums ${
                        i === r.weeks.length - 1 ? "border-r last:border-r-0" : ""
                      } ${r.sprint ? "bg-surface" : "bg-sidebar"} ${w === thisWeek ? "font-medium text-accent" : "text-ink-faint"}`}
                    >
                      {/* A tick where each week after a sprint's first begins, so the dates read as columns. */}
                      <span
                        className={`-ml-3 flex h-4 items-center gap-1.5 pl-3 ${i > 0 ? "border-l border-line-strong" : ""}`}
                      >
                        {w === thisWeek && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
                        {label(w)}
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
                    <td colSpan={columns - 1} className="border-b border-line p-0 align-top">
                      <Timeline person={person} runs={sheet.weeks} max={max} />
                    </td>
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

/**
 * One person's sprints as one grid of week columns: each epic is a chip across the back-to-back sprints it runs
 * through, in the same lane all the way, then how full each sprint is.
 */
function Timeline({ person, runs, max }: { person: Person; runs: Bandwidth["weeks"]; max: number }) {
  const starts = runs.map((_, i) => runs.slice(0, i).reduce((n, r) => n + r.weeks.length, 1));
  const across = (from: number, to: number) => `${starts[from]} / ${starts[to] + runs[to].weeks.length}`;
  const hidden = person.sprints.map((_, i) => person.spans.filter((s) => s.lane >= SHOWN && s.from <= i && i <= s.to));
  const lanes = Math.min(SHOWN, Math.max(1, ...person.spans.map((s) => s.lane + 1)));
  const more = hidden.some((h) => h.length > 0);
  // A padding row each end, so the sprint backgrounds and borders run the full height.
  const bars = lanes + (more ? 3 : 2);
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${starts.at(-1)! + runs.at(-1)!.weeks.length - 1}, minmax(0, 1fr))`,
        gridTemplateRows: `0.5rem repeat(${bars - 1}, auto) 0.5rem`,
      }}
    >
      {runs.map((r, i) => (
        <div
          key={r.weeks[0]}
          aria-hidden
          style={{ gridColumn: across(i, i), gridRow: "1 / -1" }}
          className={`${i < runs.length - 1 ? "border-r border-line" : ""} ${r.sprint ? "" : "bg-sidebar"}`}
        />
      ))}
      {person.spans
        .filter((s) => s.lane < SHOWN)
        .map((s) => (
          <Epic
            key={`${s.from}-${s.lane}`}
            work={s}
            className="mx-2 mb-1"
            style={{ gridColumn: across(s.from, s.to), gridRow: s.lane + 2 }}
          />
        ))}
      {hidden.map(
        (h, i) =>
          h.length > 0 && (
            <details
              key={i}
              className="group mx-2 mb-1 flex min-w-0 flex-col gap-1"
              style={{ gridColumn: across(i, i), gridRow: lanes + 2 }}
            >
              <summary className="order-last cursor-pointer list-none rounded-md px-1.5 text-ink-faint transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">+{h.length} more</span>
                <span className="hidden group-open:inline">Show less</span>
              </summary>
              <div className="space-y-1">
                {h.map((w) => (
                  <Epic key={w.label} work={w} />
                ))}
              </div>
            </details>
          ),
      )}
      {person.sprints.map((c, i) => {
        if (!c) return null;
        const style = { gridColumn: across(i, i), gridRow: c.work.length ? bars : 2 };
        // Free bandwidth is what product looks for, so an empty sprint says how much.
        if (!c.work.length)
          return (
            <p key={i} style={style} className="mx-2 px-1.5 py-1 whitespace-nowrap text-ink-faint tabular-nums">
              {n(c.capacity)}d free
            </p>
          );
        const over = c.booked > c.capacity;
        return (
          <div
            key={i}
            style={style}
            className="mx-2 mt-1 flex items-center gap-2 px-1.5"
            aria-label={`${n(c.booked)} of ${n(c.capacity)} days booked`}
          >
            <CapacityBar
              used={c.booked}
              capacity={c.capacity}
              max={max}
              tone="bg-accent"
              i={0}
              className="flex flex-1"
            />
            <span className={`shrink-0 tabular-nums ${over ? "font-medium text-danger" : "text-ink-muted"}`}>
              {n(c.booked)}/{n(c.capacity)}d
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** One epic chip: links to Jira when it can, hover lists its tickets. */
function Epic({ work: w, className = "", style }: { work: Span; className?: string; style?: React.CSSProperties }) {
  const tip = [w.label, ...w.tickets].join("\n");
  const chip = `${className} block min-w-0 truncate rounded-md bg-fill px-1.5 py-1 text-ink`;
  return w.url ? (
    <a
      href={w.url}
      target="_blank"
      rel="noreferrer"
      title={tip}
      style={style}
      className={`${chip} transition hover:ring-1 hover:ring-line-strong`}
    >
      {w.label}
    </a>
  ) : (
    <span title={tip} style={style} className={chip}>
      {w.label}
    </span>
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
