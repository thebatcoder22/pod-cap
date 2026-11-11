import { db } from "@/db";
import { sprints } from "@/db/schema";
import { isoDay } from "@/lib/format";
import { getCapacitySheet } from "./capacity";
import { mondayOf, planWeeks } from "./planning";
import { DAY_MS } from "./planning-days";
import { getPodPage, listPods, type PodPage } from "./pods";
import { getSprintView } from "./sprints";

export type Bandwidth = Awaited<ReturnType<typeof getBandwidth>>;

/** Weeks the bandwidth sheet shows: six sprints. */
export const BANDWIDTH_WEEKS = 12;

/** The Monday to start from: the week of the day asked for when it is YYYY-MM-DD, else this week in India. */
export const bandwidthFrom = (requested?: string) =>
  mondayOf(
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !isNaN(Date.parse(requested))
      ? requested
      : isoDay(new Date()),
  );

/**
 * Who works on what, week by week, for product: every pod's people against the sprints over `BANDWIDTH_WEEKS`
 * weeks from the Monday `from`. Each person's sprint is the epics of the tickets they own in it, and their days
 * booked against their plannable days.
 */
export async function getBandwidth(from: string) {
  const [all, pages] = await Promise.all([
    db.select().from(sprints),
    Promise.all((await listPods()).map((p) => getPodPage(p.slug))),
  ]);
  const pods = pages.filter((p): p is PodPage => p !== null);
  const runs = planWeeks(from, BANDWIDTH_WEEKS, all);
  const shown = all.filter((s) => runs.some((r) => r.sprint?.id === s.id));

  // Per pod, per sprint id, per person id: what they work on.
  const cells = await Promise.all(
    pods.map(async (page) => {
      const bySprint = await Promise.all(
        shown.map(async (sprint) => {
          const view = await getSprintView(page.pod.jiraPodOptionId, String(sprint.id));
          const { load } = await getCapacitySheet(page, sprint, view.tickets);
          return [sprint.id, new Map(load.people.map((p) => [p.id, cell(p)]))] as const;
        }),
      );
      return new Map(bySprint);
    }),
  );

  return {
    from,
    weeks: runs,
    pods: pods.map((page, i) => ({
      name: page.pod.name,
      slug: page.pod.slug,
      people: page.members.map((m) => ({
        id: m.id,
        name: m.name,
        // One per run of weeks; null where there is no sprint.
        sprints: runs.map((r) => (r.sprint ? (cells[i].get(r.sprint.id)?.get(m.id) ?? null) : null)),
      })),
    })),
  };
}

type Person = Awaited<ReturnType<typeof getCapacitySheet>>["load"]["people"][number];

/** A person's sprint: their work grouped by epic, most tickets first, then manual items, and their days. */
function cell(p: Person) {
  const epics = new Map<string, { label: string; url: string | null; tickets: string[] }>();
  const loose: string[] = [];
  for (const t of p.tickets) {
    const line = `${t.key} ${t.summary}`;
    if (!t.epic) loose.push(line);
    else {
      const e = epics.get(t.epic.key) ?? { label: t.epic.summary, url: t.epic.url, tickets: [] };
      e.tickets.push(line);
      epics.set(t.epic.key, e);
    }
  }
  const work = [
    ...[...epics.values()].sort((a, b) => b.tickets.length - a.tickets.length),
    ...(loose.length
      ? [
          {
            label: `${loose.length} ${loose.length === 1 ? "ticket" : "tickets"} without an epic`,
            url: null,
            tickets: loose,
          },
        ]
      : []),
    ...p.items.map((i) => ({ label: i.title, url: null, tickets: [] })),
  ];
  return { work, booked: p.calendarDays, capacity: p.capacity };
}

/** The Monday `weeks` weeks on from the Monday `from`. */
export const shiftWeeks = (from: string, weeks: number) => isoDay(new Date(Date.parse(from) + weeks * 7 * DAY_MS));
