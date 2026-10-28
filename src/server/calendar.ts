import { db } from "@/db";
import { sprints } from "@/db/schema";
import { isoDay } from "@/lib/format";
import { getCapacitySheet } from "./capacity";
import { planCalendar } from "./planning";
import { getPodPage, listPods, type PodPage } from "./pods";
import { getPlanningSettings } from "./settings";
import { getSprintView } from "./sprints";

export type Calendar = Awaited<ReturnType<typeof getCalendar>>;

/** The month to show: the one asked for when it is YYYY-MM, else this month in India. */
export const calendarMonth = (requested?: string) =>
  requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : isoDay(new Date()).slice(0, 7);

/**
 * The capacity calendar for a month. For one pod there is a row per person, plus one for work nobody in the pod
 * can take; for every pod there is a row per pod. Each row is hours booked against plannable hours, day by day.
 */
export async function getCalendar(month: string, slug?: string) {
  const [all, settings, pages] = await Promise.all([
    db.select().from(sprints),
    getPlanningSettings(),
    Promise.all((slug ? [{ slug }] : await listPods()).map((p) => getPodPage(p.slug))),
  ]);
  const pods = pages.filter((p): p is PodPage => p !== null);

  // Sprints touching the month, with a week either side for the padded first and last weeks.
  const from = Date.parse(`${month}-01`) - 7 * 86_400_000;
  const to = Date.parse(`${month}-01`) + 38 * 86_400_000;
  const shown = all.filter((s) => s.startDate && s.endDate && s.startDate.getTime() < to && s.endDate.getTime() > from);

  const planned = await Promise.all(
    shown.map(async (sprint) => {
      const rows = await Promise.all(
        pods.map(async (page) => {
          const view = await getSprintView(page.pod.jiraPodOptionId, String(sprint.id));
          const { load, total } = await getCapacitySheet(page, sprint, view.tickets);
          const href = `/pods/${page.pod.slug}?sprint=${sprint.id}`;
          if (!slug) {
            // Work on other pods' tickets is booked in those pods, so no day is booked twice.
            const booked = load.people.reduce((sum, p) => sum + p.calendarDays - p.elsewhereDays, 0) + load.unassigned;
            const pod = `/pods/${page.pod.slug}/calendar?month=${month}`;
            return [{ key: page.pod.slug, name: page.pod.name, href: pod, tickets: [], capacity: total, booked }];
          }
          const people = load.people.map((p) => ({
            key: String(p.id),
            name: p.name,
            href,
            tickets: [...p.tickets.map((t) => `${t.key} ${t.summary}`), ...p.items.map((i) => i.title)],
            capacity: p.capacity,
            booked: p.calendarDays,
          }));
          return load.unassigned
            ? [
                ...people,
                { key: "unassigned", name: "Unassigned", href, tickets: [], capacity: 0, booked: load.unassigned },
              ]
            : people;
        }),
      );
      return { sprint, rows: rows.flat() };
    }),
  );

  return {
    month,
    pod: slug ? (pods[0]?.pod ?? null) : null,
    focusPercent: settings.focusPercent,
    weeks: planCalendar(month, planned, settings.holidays),
  };
}
