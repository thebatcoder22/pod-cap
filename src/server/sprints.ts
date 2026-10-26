import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jiraSettings, sprints, tickets, type Estimates, type JiraUser, type StatusCategory } from "@/db/schema";

type SprintRow = typeof sprints.$inferSelect;

export type SprintView = {
  /** Picker order: active, then future soonest first, then closed latest first. */
  sprints: SprintRow[];
  /** The requested sprint, else the default one; null before the first sync. */
  sprint: SprintRow | null;
  tickets: {
    key: string;
    /** Null when Jira is not connected, so there is no site to link to. */
    url: string | null;
    summary: string;
    type: string;
    status: string;
    statusCategory: StatusCategory;
    priority: string | null;
    assignee: JiraUser | null;
    devOwners: JiraUser[];
    /** Who does the work: the Dev Owners, else the assignee. */
    owners: JiraUser[];
    epic: { key: string; summary: string; url: string | null } | null;
    readyForProductionDate: string | null;
    /** Skill-days per skill; a missing skill is not estimated. */
    estimates: Estimates;
  }[];
};

/**
 * The Jira POD option id of the pod a ticket counts for: its assignee's pod, else Jira's POD field.
 * The assignee is always set on work someone took on, while the POD field gets missed, and a person's
 * work counts against their own pod's capacity whatever pod the ticket was filed under.
 */
// Spelled out with aliases: Drizzle drops table names from columns in single-table selects, which would leave
// the subquery's columns ambiguous.
export const ticketPodOptionId = sql<string | null>`coalesce(
  (select ticket_pod.jira_pod_option_id from people ticket_person join pods ticket_pod on ticket_pod.id = ticket_person.pod_id
   where ticket_person.active and ticket_person.jira_account_id = "tickets"."assignee"->>'accountId'),
  "tickets"."pod_option_id"
)`;

const STATE_ORDER = { active: 0, future: 1, closed: 2 };
const time = (d: Date | null) => d?.getTime() ?? Infinity;

/** A pod's plannable tickets in one sprint. `requested` is the sprint id from the URL, if any. */
export async function getSprintView(jiraPodOptionId: string, requested?: string): Promise<SprintView> {
  const [all, [settings]] = await Promise.all([
    db.select().from(sprints),
    db.select({ site: jiraSettings.site }).from(jiraSettings),
  ]);
  all.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      (a.state === "closed" ? time(b.startDate) - time(a.startDate) : time(a.startDate) - time(b.startDate)) ||
      a.id - b.id,
  );
  // The first in picker order is the active sprint when there is one, else the next to start.
  const sprint = all.find((s) => String(s.id) === requested) ?? all[0] ?? null;
  if (!sprint) return { sprints: all, sprint: null, tickets: [] };

  const rows = await db
    .select()
    .from(tickets)
    .where(and(eq(ticketPodOptionId, jiraPodOptionId), sql`${sprint.id} = any(${tickets.sprintIds})`))
    .orderBy(sql`split_part(${tickets.key}, '-', 2)::int`);

  const site = settings?.site ?? null;
  return { sprints: all, sprint, tickets: rows.map((t) => ticketView(t, site)) };
}

/** A synced ticket as the pod page shows it. `site` is null when Jira is not connected. */
export function ticketView(t: typeof tickets.$inferSelect, site: string | null): SprintView["tickets"][number] {
  const browse = (key: string) => (site ? `${site}/browse/${key}` : null);
  return {
    key: t.key,
    url: browse(t.key),
    summary: t.summary,
    type: t.type,
    status: t.status,
    statusCategory: t.statusCategory,
    priority: t.priority,
    assignee: t.assignee,
    devOwners: t.devOwners,
    // Jira can list a Dev Owner twice; each counts once.
    owners: [
      ...new Map(
        (t.devOwners.length ? t.devOwners : t.assignee ? [t.assignee] : []).map((u) => [u.accountId, u]),
      ).values(),
    ],
    epic: t.epicKey ? { key: t.epicKey, summary: t.epicSummary ?? t.epicKey, url: browse(t.epicKey) } : null,
    readyForProductionDate: t.readyForProductionDate,
    estimates: t.estimates,
  };
}
