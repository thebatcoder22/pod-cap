import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jiraSettings, sprints, tickets, type JiraUser } from "@/db/schema";

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
    statusCategory: "new" | "indeterminate" | "done";
    priority: string | null;
    assignee: JiraUser | null;
    devOwners: JiraUser[];
    /** Who does the work: the Dev Owners, else the assignee. */
    owners: JiraUser[];
    epic: { key: string; summary: string; url: string | null } | null;
    readyForProductionDate: string | null;
  }[];
};

const STATE_ORDER = { active: 0, future: 1, closed: 2 };
const time = (d: Date | null) => d?.getTime() ?? Infinity;

/** A pod's plannable tickets in one sprint. `requested` is the sprint id from the URL, if any. */
export async function getSprintView(jiraPodValue: string, requested?: string): Promise<SprintView> {
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
    .where(and(eq(tickets.pod, jiraPodValue), sql`${sprint.id} = any(${tickets.sprintIds})`))
    .orderBy(sql`split_part(${tickets.key}, '-', 2)::int`);

  const browse = (key: string) => (settings ? `${settings.site}/browse/${key}` : null);
  return {
    sprints: all,
    sprint,
    tickets: rows.map((t) => ({
      key: t.key,
      url: browse(t.key),
      summary: t.summary,
      type: t.type,
      status: t.status,
      statusCategory: t.statusCategory,
      priority: t.priority,
      assignee: t.assignee,
      devOwners: t.devOwners,
      owners: t.devOwners.length ? t.devOwners : t.assignee ? [t.assignee] : [],
      epic: t.epicKey ? { key: t.epicKey, summary: t.epicSummary ?? t.epicKey, url: browse(t.epicKey) } : null,
      readyForProductionDate: t.readyForProductionDate,
    })),
  };
}
