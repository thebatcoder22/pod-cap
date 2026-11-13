import { db } from "@/db";
import { jiraSettings, sprints } from "@/db/schema";
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
  const [all, [settings], pages] = await Promise.all([
    db.select().from(sprints),
    db.select({ site: jiraSettings.site }).from(jiraSettings),
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
          return [sprint.id, new Map(load.people.map((p) => [p.id, cell(p, settings?.site ?? null)]))] as const;
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
      people: page.members
        .map((m) => ({
          id: m.id,
          name: m.name,
          // One per run of weeks; null where there is no sprint.
          sprints: runs.map((r) => (r.sprint ? (cells[i].get(r.sprint.id)?.get(m.id) ?? null) : null)),
        }))
        .map((m) => ({ ...m, spans: spansOf(m.sprints) })),
    })),
  };
}

type Person = Awaited<ReturnType<typeof getCapacitySheet>>["load"]["people"][number];

/** A person's sprint: their work grouped by epic, most tickets first, then manual items, and their days. */
function cell(p: Person, site: string | null) {
  const epics = new Map<string, Work>();
  const loose: Person["tickets"] = [];
  for (const t of p.tickets) {
    if (!t.epic) loose.push(t);
    else {
      const e = epics.get(t.epic.key) ?? { key: t.epic.key, label: t.epic.summary, url: t.epic.url, tickets: [] };
      e.tickets.push(`${t.key} ${t.summary}`);
      epics.set(t.epic.key, e);
    }
  }
  const work: Work[] = [
    ...[...epics.values()].sort((a, b) => b.tickets.length - a.tickets.length),
    ...(loose.length
      ? [
          {
            key: null,
            label: `${loose.length} ${loose.length === 1 ? "ticket" : "tickets"} without an epic`,
            // One ticket opens itself; several open a Jira search for just those.
            url:
              loose.length === 1
                ? loose[0].url
                : site && `${site}/issues/?jql=${encodeURIComponent(`key in (${loose.map((t) => t.key).join(", ")})`)}`,
            tickets: loose.map((t) => `${t.key} ${t.summary}`),
          },
        ]
      : []),
    ...p.items.map((i) => ({ key: null, label: i.title, url: null, tickets: [] })),
  ];
  return { work, booked: p.calendarDays, capacity: p.capacity };
}

/** An epic, the tickets without one, or a manual item. Only epics have a `key`: they are what runs across sprints. */
type Work = { key: string | null; label: string; url: string | null; tickets: string[] };
/** A piece of work over the sprints `from` to `to` (indexes into a person's sprints), in its `lane` from the top. */
export type Span = Work & { from: number; to: number; lane: number };

/**
 * A person's work as spans: an epic in back-to-back sprints is one span across them. Spans take the top-most lane
 * free when they start, in sprint order and then each sprint's own order, so a continuing epic keeps its lane.
 */
export function spansOf(sprints: ({ work: Work[] } | null)[]) {
  const spans: Span[] = [];
  const last = new Map<string, Span>();
  sprints.forEach((c, i) => {
    for (const w of c?.work ?? []) {
      const run = w.key === null ? undefined : last.get(w.key);
      if (run?.to === i - 1) {
        run.to = i;
        run.tickets = [...new Set([...run.tickets, ...w.tickets])];
        continue;
      }
      const span = { ...w, from: i, to: i, lane: 0 };
      spans.push(span);
      if (w.key !== null) last.set(w.key, span);
    }
  });
  const ends: number[] = [];
  for (const s of spans) {
    const free = ends.findIndex((end) => end < s.from);
    s.lane = free < 0 ? ends.length : free;
    ends[s.lane] = s.to;
  }
  return spans;
}

/** The Monday `weeks` weeks on from the Monday `from`. */
export const shiftWeeks = (from: string, weeks: number) => isoDay(new Date(Date.parse(from) + weeks * 7 * DAY_MS));
