import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { jiraSettings, pods, sprints, tickets, type Estimates, type JiraUser, type StatusCategory } from "@/db/schema";

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
    /** Who works on it: the assignee and the Dev Owners. */
    owners: JiraUser[];
    epic: { key: string; summary: string; url: string | null } | null;
    readyForProductionDate: string | null;
    /** Skill-days per skill; a missing skill is not estimated. */
    estimates: Estimates;
  }[];
};

/**
 * The Jira POD option id of the pod a ticket counts for: Jira's POD field when one of its owners is in that pod,
 * else the pod of its first owner in one (the assignee, then the Dev Owners in Jira's order), else the POD field.
 * Owners are set on work someone took on, while the POD field gets missed or names another pod, and a person's
 * work counts against their own pod's capacity. A ticket counts in one pod only, so pod totals never count it
 * twice; owners in other pods show on it as cross-pod help. Someone in two pods, like Shadab in Velocity and
 * Support, has their tickets counted by the POD field; one naming neither of their pods goes to the pod with the
 * larger share of them, then the older pod.
 */
// Spelled out with aliases: Drizzle drops table names from columns in single-table selects, which would leave
// the subquery's columns ambiguous. A null assignee becomes [null], which matches nobody.
export const ticketPodOptionId = sql<string | null>`coalesce(
  (select ticket_pod.jira_pod_option_id
   from jsonb_array_elements(jsonb_build_array("tickets"."assignee") || "tickets"."dev_owners") with ordinality ticket_owner(u, n)
   join people ticket_person on ticket_person.active and ticket_person.jira_account_id = ticket_owner.u->>'accountId'
   join pod_members ticket_member on ticket_member.person_id = ticket_person.id
   join pods ticket_pod on ticket_pod.id = ticket_member.pod_id
   order by ticket_pod.jira_pod_option_id = "tickets"."pod_option_id" desc, ticket_owner.n,
     ticket_member.share desc, ticket_pod.id limit 1),
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
    .where(and(eq(ticketPodOptionId, jiraPodOptionId), inSprint(sprint.id)))
    .orderBy(byKey);

  const site = settings?.site ?? null;
  return { sprints: all, sprint, tickets: rows.map((t) => ticketView(t, site)) };
}

// Logged already done, so no sprint's capacity went into it.
const inSprint = (sprintId: number) => and(sql`${sprintId} = any(${tickets.sprintIds})`, eq(tickets.loggedDone, false));
const byKey = sql`split_part(${tickets.key}, '-', 2)::int`;

/** The sprint's tickets that count in another pod, with that pod. A pod's people can be owners on them too. */
export async function getTicketsElsewhere(jiraPodOptionId: string, sprintId: number) {
  const [rows, [settings]] = await Promise.all([
    db
      .select({ ticket: tickets, pod: { name: pods.name, slug: pods.slug } })
      .from(tickets)
      .innerJoin(pods, eq(pods.jiraPodOptionId, ticketPodOptionId))
      .where(and(ne(ticketPodOptionId, jiraPodOptionId), inSprint(sprintId)))
      .orderBy(byKey),
    db.select({ site: jiraSettings.site }).from(jiraSettings),
  ]);
  return rows.map((r) => ({ ...ticketView(r.ticket, settings?.site ?? null), pod: r.pod }));
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
    // The assignee is often a Dev Owner too, and Jira can list a Dev Owner twice; each counts once.
    owners: [...new Map([...(t.assignee ? [t.assignee] : []), ...t.devOwners].map((u) => [u.accountId, u])).values()],
    epic: t.epicKey ? { key: t.epicKey, summary: t.epicSummary ?? t.epicKey, url: browse(t.epicKey) } : null,
    readyForProductionDate: t.readyForProductionDate,
    estimates: t.estimates,
  };
}
