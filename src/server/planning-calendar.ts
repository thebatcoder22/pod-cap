import { isoDay } from "@/lib/format";
import { DAY_MS, round, sprintDays, weekdays } from "./planning-days";

/** The working day: 8 hours, Monday to Friday. */
export const HOURS_PER_DAY = 8;

/** A row's capacity and booked work across a sprint, in days. */
type CalendarRow = { capacity: number; booked: number };

export type CalendarDay<R> = {
  date: string;
  /** Inside the month asked for; the rest pad out its first and last weeks. */
  inMonth: boolean;
  holiday: string | null;
  sprint: { id: number; name: string } | null;
  /** Per row, capacity and booked work as hours on this day. */
  rows: (R & CalendarRow)[];
};

/**
 * The capacity calendar for a month, YYYY-MM, as weeks of Monday to Friday. Jira tickets carry no dates and leave
 * is a number of days per sprint, so a sprint's capacity and booked work spread evenly over its working days that
 * are not holidays. Where two sprints overlap, the later one has the day.
 */
export function planCalendar<R extends CalendarRow>(
  month: string,
  sprints: { sprint: { id: number; name: string; startDate: Date | null; endDate: Date | null }; rows: R[] }[],
  holidays: { date: string; name: string }[],
): CalendarDay<R>[][] {
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  // From the Monday on or before the 1st to the Friday on or after the last day, less weeks with no weekday in it.
  const from = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY_MS);
  const to = new Date(last.getTime() + ((5 - last.getUTCDay() + 7) % 7) * DAY_MS);
  const off = new Map(holidays.map((h) => [h.date, h.name]));

  const byDay = new Map<string, { sprint: { id: number; name: string }; rows: (R & CalendarRow)[] }>();
  const latestFirst = sprints.toSorted(
    (a, b) => (b.sprint.startDate?.getTime() ?? 0) - (a.sprint.startDate?.getTime() ?? 0),
  );
  for (const { sprint, rows } of latestFirst) {
    const open = sprintDays(sprint).filter((d) => !off.has(d));
    const hours = (days: number) => round((days * HOURS_PER_DAY) / open.length);
    const daily = rows.map((r) => ({ ...r, capacity: hours(r.capacity), booked: hours(r.booked) }));
    for (const d of open)
      if (!byDay.has(d)) byDay.set(d, { sprint: { id: sprint.id, name: sprint.name }, rows: daily });
  }

  const weeks: CalendarDay<R>[][] = [];
  for (const d of weekdays(isoDay(from), isoDay(to))) {
    if (new Date(d).getUTCDay() === 1 || !weeks.length) weeks.push([]);
    const planned = byDay.get(d);
    weeks.at(-1)!.push({
      date: d,
      inMonth: d.startsWith(month),
      holiday: off.get(d) ?? null,
      sprint: planned?.sprint ?? null,
      rows: planned?.rows ?? [],
    });
  }
  return weeks.filter((w) => w.some((d) => d.inMonth));
}
