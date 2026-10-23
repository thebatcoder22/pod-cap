import { SKILLS, type Estimates, type JiraUser, type Skill } from "@/db/schema";
import { isoDay } from "@/lib/format";
import type { Proficiency } from "./people";

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

export type Commitment<T> = {
  skills: {
    skill: Skill;
    capacity: number;
    /** The sum of the estimates in this skill; null when no ticket has one, so it never reads as 0. */
    committed: number | null;
    /** Tickets with no estimate in this skill, counted apart from the committed days. */
    notEstimated: number;
    /** Committed days beyond capacity; 0 when the skill has room. */
    over: number;
  }[];
  /** Tickets with no estimate in any skill. */
  unestimated: T[];
};

/**
 * A placeholder stops counting once its ticket is in the sprint for a pod: the ticket's own estimate takes over,
 * wherever its POD puts it, so the work is never counted twice.
 */
export function planManualItems<M extends { ticketPod: string | null }>(items: M[]) {
  return items.map((i) => ({ ...i, counts: i.ticketPod === null }));
}

/** A manual item that counts: non-Jira work, or a placeholder whose ticket is not in a pod's sprint yet. */
type ManualItem = { personId: number | null; skill: Skill; days: number };

/**
 * Committed skill-days per skill = the sum of the sprint's ticket estimates and manual items, set against
 * capacity.
 */
export function planCommitment<T extends { estimates: Estimates }>(
  tickets: T[],
  items: ManualItem[],
  capacity: Capacity<unknown>["skills"],
): Commitment<T> {
  const skills = capacity.map(({ skill, capacity }) => {
    const estimated = tickets.flatMap((t) => t.estimates[skill] ?? []);
    const days = [...estimated, ...items.flatMap((i) => (i.skill === skill ? i.days : []))];
    const committed = days.length ? round(days.reduce((sum, d) => sum + d, 0)) : null;
    return {
      skill,
      capacity,
      committed,
      notEstimated: tickets.length - estimated.length,
      over: round(Math.max(0, (committed ?? 0) - capacity)),
    };
  });
  return { skills, unestimated: tickets.filter((t) => !SKILLS.some((k) => t.estimates[k] !== undefined)) };
}

type Owned = { key: string; owners: JiraUser[]; estimates: Estimates };

export type Load<P, T, M> = {
  people: (P & {
    /** Attributed skill-days, all skills together. */
    skillDays: number;
    /** What those skill-days take this person: skill-days / proficiency. */
    calendarDays: number;
    /** Capacity - calendar days; below zero means overloaded. */
    free: number;
    /** The sprint's tickets this person owns, with the skill-days attributed to them. */
    tickets: (T & { attributed: Estimates })[];
    /** Their manual items. */
    items: M[];
  })[];
  tickets: (T & {
    /** Owners who are in another pod. */
    crossPod: (JiraUser & { pod: string })[];
    /** Skill-days none of the owners can do, by skill. They count against the pod but nobody in it. */
    unassigned: Estimates;
  })[];
  /** Manual items. One whose person is not in the pod, or cannot do its skill, is unassigned work. */
  items: (M & { unassigned: Estimates })[];
  /** All unassigned skill-days together. */
  unassigned: number;
};

/**
 * Attribution: a ticket's skill-days for a skill go to its owners (Dev Owners, else the assignee) with
 * proficiency above zero in it, split evenly. Owners from other pods take their share, as cross-pod help.
 * A manual item goes to its person. One without a person counts against the pod, as the lead chose.
 */
export function planLoad<
  P extends { id: number; capacity: number; jiraAccountId: string | null; proficiency: Proficiency },
  T extends Owned,
  M extends ManualItem,
>(
  tickets: T[],
  items: M[],
  people: P[],
  /** Active people in other pods, by Jira account id. */
  others: Map<string, { pod: string; proficiency: Proficiency }>,
): Load<P, T, M> {
  const members = new Map(people.flatMap((p) => (p.jiraAccountId ? [[p.jiraAccountId, p]] : [])));
  const owned = new Map(people.map((p) => [p, [] as (T & { attributed: Estimates })[]]));

  const planned = tickets.map((t) => {
    const unassigned: Estimates = {};
    const shares = new Map<P, Estimates>();
    for (const skill of SKILLS) {
      const days = t.estimates[skill];
      if (!days) continue;
      const able = t.owners.filter((o) => {
        const known = members.get(o.accountId) ?? others.get(o.accountId);
        return known && known.proficiency[skill] > 0;
      });
      if (!able.length) unassigned[skill] = days;
      for (const o of able) {
        const p = members.get(o.accountId);
        if (p) shares.set(p, { ...shares.get(p), [skill]: days / able.length });
      }
    }
    for (const o of t.owners) {
      const p = members.get(o.accountId);
      if (p) owned.get(p)!.push({ ...t, attributed: shares.get(p) ?? {} });
    }
    const crossPod = t.owners.flatMap((o) => {
      const other = others.get(o.accountId);
      return other ? [{ ...o, pod: other.pod }] : [];
    });
    return { ...t, crossPod, unassigned };
  });

  const byId = new Map(people.map((p) => [p.id, p]));
  const doer = (i: M) => {
    const p = i.personId === null ? undefined : byId.get(i.personId);
    return p && p.proficiency[i.skill] > 0 ? p : undefined;
  };
  const manual = items.map((i) => ({
    ...i,
    unassigned: i.personId === null || doer(i) ? {} : { [i.skill]: i.days },
  }));

  const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
  return {
    people: people.map((p) => {
      const tickets = owned.get(p)!.map((t) => ({
        ...t,
        attributed: Object.fromEntries(Object.entries(t.attributed).map(([k, d]) => [k, round(d)])),
      }));
      const mine = items.filter((i) => doer(i) === p);
      const attributed = [
        ...owned.get(p)!.flatMap((t) => Object.entries(t.attributed) as [Skill, number][]),
        ...mine.map((i) => [i.skill, i.days] as [Skill, number]),
      ];
      const calendarDays = sum(attributed.map(([skill, d]) => d / (p.proficiency[skill] / 100)));
      return {
        ...p,
        skillDays: round(sum(attributed.map(([, d]) => d))),
        calendarDays: round(calendarDays),
        free: round(p.capacity - calendarDays),
        tickets,
        items: mine,
      };
    }),
    tickets: planned,
    items: manual,
    unassigned: round(sum([...planned, ...manual].flatMap((t) => Object.values(t.unassigned)))),
  };
}
