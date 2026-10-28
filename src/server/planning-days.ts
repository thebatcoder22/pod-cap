import { isoDay } from "@/lib/format";

// Day math the planning engine shares: working days, rounding, and sums that keep "unknown" apart from 0.

type Sprint = { startDate: Date | null; endDate: Date | null };

export const DAY_MS = 86_400_000;

/** Weekdays from `start` to `end` inclusive, both YYYY-MM-DD. */
export function weekdays(start: string, end: string) {
  const days: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY_MS) {
    const d = new Date(t);
    if (d.getUTCDay() % 6 !== 0) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Rounds away float noise, so 9.5 x 0.7 shows as 6.65. */
export const round = (n: number) => Math.round(n * 100) / 100;

/** The sum of what is there; null when nothing is, so a missing number never reads as 0. */
export const sumKnown = (ns: (number | null | undefined)[]) => {
  const known = ns.filter((n) => n !== null && n !== undefined);
  return known.length ? round(known.reduce((sum, d) => sum + d, 0)) : null;
};

/** The sprint's weekdays, first and last day included. A sprint without dates has none. */
export function sprintDays({ startDate, endDate }: Sprint) {
  return startDate && endDate ? weekdays(isoDay(startDate), isoDay(endDate)) : [];
}

export const workingDays = (sprint: Sprint) => sprintDays(sprint).length;
