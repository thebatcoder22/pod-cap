import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { jiraSettings, sprints, tickets } from "@/db/schema";
import { getCapacitySheet, type CapacitySheet } from "./capacity";
import { planPickUp } from "./planning";
import { getPodPage, listPods, type PodPage } from "./pods";
import { getSprintView, ticketView } from "./sprints";

type Sprint = typeof sprints.$inferSelect;

export type PickUpPanel = Awaited<ReturnType<typeof getPickUp>>;

/**
 * Who in the pod has free days in the sprint and which backlog tickets they could pick up, and where an
 * overloaded skill's days could come from. Nothing here writes to Jira.
 */
export async function getPickUp(page: PodPage, sprint: Sprint, sheet: CapacitySheet) {
  const [[settings], backlog, others] = await Promise.all([
    db.select({ site: jiraSettings.site }).from(jiraSettings),
    // The pod's open tickets in no active or future sprint. Tickets carried out of a closed sprint are back here.
    db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.podOptionId, page.pod.jiraPodOptionId),
          ne(tickets.statusCategory, "done"),
          sql`not exists (select 1 from ${sprints} where ${sprints.id} = any(${tickets.sprintIds}) and ${sprints.state} <> 'closed')`,
        ),
      )
      .orderBy(sql`split_part(${tickets.key}, '-', 2)::int`),
    otherPods(page.pod.slug, sprint),
  ]);
  const site = settings?.site ?? null;
  return planPickUp(
    sheet.load.people,
    backlog.map((t) => ticketView(t, site)),
    sheet.commitment.skills,
    others,
  );
}

/** Every other pod's committed vs capacity per skill in the same sprint. */
// ponytail: builds each other pod's whole capacity sheet; fine for four pods.
async function otherPods(slug: string, sprint: Sprint) {
  const pods = (await listPods()).filter((p) => p.slug !== slug);
  return Promise.all(
    pods.map(async ({ slug }) => {
      const page = (await getPodPage(slug))!;
      const view = await getSprintView(page.pod.jiraPodOptionId, String(sprint.id));
      const sheet = await getCapacitySheet(page, sprint, view.tickets);
      return { pod: page.pod.name, slug, skills: sheet.commitment.skills };
    }),
  );
}
