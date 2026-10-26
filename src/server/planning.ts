import { SKILLS, type Estimates, type JiraUser, type Skill, type SnapshotKind } from "@/db/schema";
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

/** The sum of what is there; null when nothing is, so a missing number never reads as 0. */
const sumKnown = (ns: (number | null | undefined)[]) => {
  const known = ns.filter((n) => n !== null && n !== undefined);
  return known.length ? round(known.reduce((sum, d) => sum + d, 0)) : null;
};

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
    const committed = sumKnown(days);
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

/**
 * What a snapshot freezes per skill: capacity and committed skill-days, and at close the skill-days of tickets
 * Done in Jira. Completed is null when no Done ticket has an estimate in the skill, so it never reads as 0.
 */
export function planSnapshot(
  kind: SnapshotKind,
  skills: Commitment<unknown>["skills"],
  tickets: { statusCategory: string; estimates: Estimates }[],
) {
  return skills.map(({ skill, capacity, committed }) => {
    const done = tickets.map((t) => (t.statusCategory === "done" ? t.estimates[skill] : undefined));
    return { skill, capacity, committed, completed: kind === "close" ? sumKnown(done) : null };
  });
}

type SnapshotRow = { skill: Skill; capacity: number | null; committed: number | null; completed: number | null };

/**
 * A sprint's trend: capacity and committed as frozen at the start, completed as recorded at the close, per skill
 * and in total. Missing numbers stay null. Over and done share are only there when both their numbers are.
 */
export function planTrend(start: SnapshotRow[], close: SnapshotRow[]) {
  const rows = SKILLS.map((skill) => {
    const s = start.find((r) => r.skill === skill);
    return {
      skill,
      capacity: s?.capacity ?? null,
      committed: s?.committed ?? null,
      completed: close.find((r) => r.skill === skill)?.completed ?? null,
    };
  });
  const withRatios = (r: Omit<SnapshotRow, "skill">) => ({
    ...r,
    /** Committed beyond capacity; null when within it or unknown. */
    over:
      r.capacity !== null && r.committed !== null && r.committed > r.capacity ? round(r.committed - r.capacity) : null,
    /** Completed as a whole percent of committed. */
    donePercent: r.completed !== null && r.committed ? Math.round((r.completed / r.committed) * 100) : null,
  });
  return {
    skills: rows.map((r) => ({ skill: r.skill, ...withRatios(r) })),
    total: withRatios({
      capacity: sumKnown(rows.map((r) => r.capacity)),
      committed: sumKnown(rows.map((r) => r.committed)),
      completed: sumKnown(rows.map((r) => r.completed)),
    }),
  };
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

/** Jira's priorities, highest first. A ticket with none, or an unknown one, comes after them all. */
const PRIORITIES = ["Highest", "High", "Medium", "Low", "Lowest"];
const rank = (p: string | null) => (p && PRIORITIES.includes(p) ? PRIORITIES.indexOf(p) : PRIORITIES.length);

export type PickUp<P, T> = {
  /** People with free days, each with the backlog tickets that fit them. */
  people: (P & {
    /** Exact matches, then stretch options; each by Jira priority, then smallest cost. */
    suggestions: (T & {
      skill: Skill;
      /** The ticket's skill-days. */
      days: number;
      /** What it takes this person in calendar days: skill-days / proficiency. */
      cost: number;
      /** Outside their main skill. */
      stretch: boolean;
    })[];
  })[];
  /** The pod's overloaded skills, and where the missing days could come from. */
  short: {
    skill: Skill;
    over: number;
    /** People in the pod outside their main skill, with the skill-days of the gap their free days could absorb. */
    cover: (P & { absorb: number })[];
    /** Other pods' free main-skill capacity in it, most first. */
    elsewhere: { pod: string; slug: string; free: number }[];
  }[];
};

/**
 * Suggestions only: the pod lead decides and assigns in Jira. A backlog ticket fits a person when all its
 * skill-days are in one skill they have proficiency in, costing no more than their free days.
 */
export function planPickUp<
  P extends { mainSkill: Skill; proficiency: Proficiency; free: number },
  T extends { priority: string | null; estimates: Estimates },
>(
  people: P[],
  backlog: T[],
  skills: Commitment<unknown>["skills"],
  others: { pod: string; slug: string; skills: Commitment<unknown>["skills"] }[],
): PickUp<P, T> {
  const withRoom = people.filter((p) => p.free > 0);
  // A skill with no estimate is no work in it: most tickets only ever get FE Days or BE Days.
  const oneSkill = backlog.flatMap((t) => {
    const worked = SKILLS.filter((k) => (t.estimates[k] ?? 0) > 0);
    return worked.length === 1 ? [{ ...t, skill: worked[0], days: t.estimates[worked[0]]! }] : [];
  });

  return {
    people: withRoom.map((p) => ({
      ...p,
      suggestions: oneSkill
        .flatMap((t) => {
          const cost = t.days / (p.proficiency[t.skill] / 100);
          return p.proficiency[t.skill] > 0 && cost <= p.free
            ? [{ ...t, cost: round(cost), stretch: t.skill !== p.mainSkill }]
            : [];
        })
        .sort(
          (a, b) => Number(a.stretch) - Number(b.stretch) || rank(a.priority) - rank(b.priority) || a.cost - b.cost,
        ),
    })),
    short: skills
      .filter((k) => k.over > 0)
      .map(({ skill, over }) => ({
        skill,
        over,
        // ponytail: each skill counts a person's whole free days; split them if two skills are short at once.
        cover: withRoom
          .filter((p) => p.mainSkill !== skill && p.proficiency[skill] > 0)
          .map((p) => ({ ...p, absorb: round(Math.min(over, (p.free * p.proficiency[skill]) / 100)) }))
          .sort((a, b) => b.absorb - a.absorb),
        elsewhere: others
          .flatMap(({ pod, slug, skills }) => {
            const k = skills.find((s) => s.skill === skill)!;
            const room = round(k.capacity - (k.committed ?? 0));
            return room > 0 ? [{ pod, slug, free: room }] : [];
          })
          .sort((a, b) => b.free - a.free),
      })),
  };
}

export type EpicPlan<E, P> = E & {
  /** The pod whose lead sizes it; null when no single pod can be told from Jira. */
  owner: P | null;
  /** Pods with child tickets in it. */
  pods: P[];
  /** Plannable child tickets. */
  tickets: number;
  /** Child skill-days per skill: null when no child has an estimate in it, so it never reads as 0. */
  skills: { skill: Skill; days: number | null; notEstimated: number }[];
  /** Child tickets with no estimate in any skill. */
  unestimated: number;
};

/**
 * An epic belongs to the pod its POD names. Most epics have no POD: then it belongs to the one pod its tickets
 * are in, and with tickets in several pods to none, so no lead sizes work another pod shares.
 */
export function planEpics<E extends { key: string; podOptionId: string | null }, P extends { jiraPodOptionId: string }>(
  epics: E[],
  tickets: { epicKey: string | null; podOptionId: string | null; estimates: Estimates }[],
  pods: P[],
): EpicPlan<E, P>[] {
  const children = Map.groupBy(tickets, (t) => t.epicKey);
  return epics.map((e) => {
    const mine = children.get(e.key) ?? [];
    const worked = pods.filter((p) => mine.some((t) => t.podOptionId === p.jiraPodOptionId));
    const owner = e.podOptionId
      ? (pods.find((p) => p.jiraPodOptionId === e.podOptionId) ?? null)
      : worked.length === 1
        ? worked[0]
        : null;
    const skills = SKILLS.map((skill) => {
      const estimated = mine.flatMap((t) => t.estimates[skill] ?? []);
      return {
        skill,
        days: sumKnown(estimated),
        notEstimated: mine.length - estimated.length,
      };
    });
    const unestimated = mine.filter((t) => !SKILLS.some((k) => t.estimates[k] !== undefined)).length;
    return { ...e, owner, pods: worked, tickets: mine.length, skills, unestimated };
  });
}
