import { SKILLS, type Skill } from "@/db/schema";
import { isoDay } from "@/lib/format";

// The planning engine: every capacity rule, and no I/O. See SPEC.md "Rules the planning engine encodes".

export type PlanningInput<P extends { id: number; mainSkill: Skill }> = {
  sprint: { startDate: Date | null; endDate: Date | null };
  people: P[];
  /** Leave days by person id, in half-day steps. */
  leave: Map<number, number>;
  /** Every company holiday, as YYYY-MM-DD. */
  holidays: { date: string; name: string }[];
  /** 0.7 for 70%. */
  focusFactor: number;
};

export type Capacity<P> = {
  /** Weekdays from the sprint's first day to its last, holidays included. */
  workingDays: number;
  /** Holidays on those working days, in date order. */
  holidays: { date: string; name: string }[];
  people: (P & { leave: number; capacity: number })[];
  /** Each skill's capacity is the sum over the people whose main skill it is. */
  skills: {
    skill: Skill;
    people: number;
    capacity: number;
    /** The pod has people for this skill, but none of them has a day to plan. */
    gap: boolean;
  }[];
  /** Every member's capacity together. */
  total: number;
};

const DAY_MS = 86_400_000;

/** Weekdays from `start` to `end` inclusive, both YYYY-MM-DD. */
function weekdays(start: string, end: string) {
  const days: string[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY_MS) {
    const d = new Date(t);
    if (d.getUTCDay() % 6 !== 0) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Rounds away float noise, so 9.5 x 0.7 shows as 6.65. */
const round = (n: number) => Math.round(n * 100) / 100;

/** The sprint's weekdays, first and last day included. A sprint without dates has none. */
function sprintDays({ startDate, endDate }: PlanningInput<never>["sprint"]) {
  return startDate && endDate ? weekdays(isoDay(startDate), isoDay(endDate)) : [];
}

export const workingDays = (sprint: PlanningInput<never>["sprint"]) => sprintDays(sprint).length;

/** Capacity = (working days - leave - holidays) x focus factor, never below zero. */
export function planCapacity<P extends { id: number; mainSkill: Skill }>(input: PlanningInput<P>): Capacity<P> {
  const days = sprintDays(input.sprint);
  const holidays = input.holidays.filter((h) => days.includes(h.date)).toSorted((a, b) => a.date.localeCompare(b.date));
  const available = days.length - holidays.length;

  const people = input.people.map((p) => {
    const leave = input.leave.get(p.id) ?? 0;
    return { ...p, leave, capacity: round(Math.max(0, available - leave) * input.focusFactor) };
  });
  const skills = SKILLS.map((skill) => {
    const of = people.filter((p) => p.mainSkill === skill);
    const capacity = round(of.reduce((sum, p) => sum + p.capacity, 0));
    return { skill, people: of.length, capacity, gap: of.length > 0 && capacity === 0 && days.length > 0 };
  });
  const total = round(people.reduce((sum, p) => sum + p.capacity, 0));
  return { workingDays: days.length, holidays, people, skills, total };
}
