import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { isoDay } from "@/lib/format";
import type { Calendar } from "@/server/calendar";
import { HOURS_PER_DAY } from "@/server/planning";

type Day = Calendar["weeks"][number][number];
type Row = Day["rows"][number];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const utc = (month: string) => new Date(`${month}-01T00:00:00Z`);
const monthLabel = (month: string) =>
  utc(month).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const shift = (month: string, by: number) => {
  const d = utc(month);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};
/** 3.2, 28, never 3.20. */
const hours = (h: number) => `${Number(h.toFixed(1))}h`;

/** Month navigation for a calendar page at `path`. */
export function MonthNav({ month, path }: { month: string; path: string }) {
  const button =
    "grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink-muted shadow-card transition hover:text-ink active:scale-[0.96]";
  const thisMonth = isoDay(new Date()).slice(0, 7);
  return (
    <div className="flex items-center gap-2">
      <Link href={`${path}?month=${shift(month, -1)}`} className={button}>
        <CaretLeftIcon size={14} aria-hidden />
        <span className="sr-only">Previous month</span>
      </Link>
      <h2 className="min-w-36 text-center text-sm font-medium tabular-nums">{monthLabel(month)}</h2>
      <Link href={`${path}?month=${shift(month, 1)}`} className={button}>
        <CaretRightIcon size={14} aria-hidden />
        <span className="sr-only">Next month</span>
      </Link>
      {month !== thisMonth && (
        <Link
          href={`${path}?month=${thisMonth}`}
          className="flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-ink-muted transition hover:bg-fill hover:text-ink"
        >
          This month
        </Link>
      )}
    </div>
  );
}

/** How the hours are worked out, under the grid. */
export function CalendarNote({ focusPercent }: { focusPercent: number }) {
  return (
    <p className="max-w-3xl text-xs text-ink-faint">
      Hours booked of plannable hours: an {HOURS_PER_DAY}h day, Monday to Friday, at the {focusPercent}% focus factor,
      so {hours((HOURS_PER_DAY * focusPercent) / 100)} per person. Jira tickets have no dates and leave is entered per
      sprint, so each sprint&apos;s work and leave spread evenly over its working days. Holidays book nothing.
    </p>
  );
}

/** A month of weekdays, each with a pill per row: a person in one pod's calendar, a pod in the all-pods one. */
export function CapacityCalendar({ calendar }: { calendar: Calendar }) {
  const today = isoDay(new Date());
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
      <div role="table" aria-label={`Capacity in ${monthLabel(calendar.month)}`} className="min-w-[52rem]">
        <div role="row" className="grid grid-cols-5 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="px-3 py-2 text-xs font-medium text-ink-faint">
              {d}
            </div>
          ))}
        </div>
        {calendar.weeks.map((week, w) => (
          <div key={week[0].date} role="row" className="grid grid-cols-5 border-b border-line last:border-b-0">
            {week.map((d, i) => (
              <DayCell
                key={d.date}
                day={d}
                today={d.date === today}
                // A sprint's name where it starts, and at the start of each week.
                labelSprint={i === 0 || week[i - 1].sprint?.id !== d.sprint?.id}
                first={w === 0 && i === 0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day: d,
  today,
  labelSprint,
  first,
}: {
  day: Day;
  today: boolean;
  labelSprint: boolean;
  first: boolean;
}) {
  const date = new Date(`${d.date}T00:00:00Z`);
  const n = date.getUTCDate();
  const label = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <div
      role="cell"
      aria-label={label}
      className={`min-h-28 space-y-1.5 border-r border-line p-2 last:border-r-0 ${d.inMonth ? "" : "bg-sidebar"}`}
    >
      <div className="flex h-5 items-center gap-2 px-0.5">
        <span
          className={`text-xs tabular-nums ${
            today
              ? "grid size-5 place-items-center rounded-full bg-accent font-semibold text-accent-ink"
              : d.inMonth
                ? "font-medium text-ink"
                : "text-ink-faint"
          }`}
        >
          {n === 1 || first ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : n}
        </span>
        {labelSprint && d.sprint && <span className="truncate text-xs text-ink-faint">{d.sprint.name}</span>}
      </div>
      {d.holiday ? (
        <p className="rounded-md bg-fill px-1.5 py-1 text-xs text-ink-muted">{d.holiday}</p>
      ) : d.rows.length ? (
        <ul className="space-y-1">
          {d.rows.map((r) => (
            <li key={r.key}>
              <Pill row={r} />
            </li>
          ))}
        </ul>
      ) : (
        d.inMonth && <p className="px-0.5 text-xs text-ink-faint">No sprint</p>
      )}
    </div>
  );
}

function Pill({ row: r }: { row: Row }) {
  const over = r.booked > r.capacity;
  const share = r.capacity ? Math.min(100, (r.booked / r.capacity) * 100) : 0;
  const what = `${r.name}: ${hours(r.booked)} booked of ${hours(r.capacity)}`;
  return (
    <Link
      href={r.href}
      aria-label={what}
      title={[what, ...r.tickets].join("\n")}
      style={
        over
          ? undefined
          : { backgroundImage: `linear-gradient(to right, var(--accent-soft) ${share}%, transparent ${share}%)` }
      }
      className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition hover:ring-1 ${
        over ? "bg-danger-soft text-danger hover:ring-danger/40" : "bg-fill text-ink hover:ring-line-strong"
      }`}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
      <span className={`shrink-0 tabular-nums ${over ? "" : "text-ink-muted"}`}>
        {Number(r.booked.toFixed(1))}/{hours(r.capacity)}
      </span>
    </Link>
  );
}
