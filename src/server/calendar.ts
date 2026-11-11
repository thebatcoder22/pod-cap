import { db } from "@/db";
import { sprints } from "@/db/schema";
import { isoDay } from "@/lib/format";
import { getCapacitySheet } from "./capacity";
import { planCalendar } from "./planning";
import { getPodPage } from "./pods";
import { getPlanningSettings } from "./settings";
import { getSprintView } from "./sprints";

export type Calendar = Awaited<ReturnType<typeof getCalendar>>;

/** The month to show: the one asked for when it is YYYY-MM, else this month in India. */
export const calendarMonth = (requested?: string) =>
  requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : isoDay(new Date()).slice(0, 7);

/**
 * A pod's capacity calendar for a month: a row per person, plus one for work nobody in the pod can take. Each row
 * is hours booked against plannable hours, day by day.
 */
export async function getCalendar(month: string, slug: string) {
  const [all, settings, page] = await Promise.all([db.select().from(sprints), getPlanningSettings(), getPodPage(slug)]);
  const pods = page ? [page] : [];

  // Sprints touching the month, with a week either side for the padded first and last weeks.
  const from = Date.parse(`${month}-01`) - 7 * 86_400_000;
  const to = Date.parse(`${month}-01`) + 38 * 86_400_000;
  const shown = all.filter((s) => s.startDate && s.endDate && s.startDate.getTime() < to && s.endDate.getTime() > from);

  const planned = await Promise.all(
    shown.map(async (sprint) => {
      const rows = await Promise.all(
        pods.map(async (page) => {
          const view = await getSprintView(page.pod.jiraPodOptionId, String(sprint.id));
          const { load } = await getCapacitySheet(page, sprint, view.tickets);
          const href = `/pods/${page.pod.slug}?sprint=${sprint.id}`;
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
    pod: page?.pod ?? null,
    focusPercent: settings.focusPercent,
    weeks: planCalendar(month, planned, settings.holidays),
  };
}
