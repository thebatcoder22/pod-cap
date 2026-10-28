import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const SKILLS = ["FE", "BE", "Data", "AI"] as const;
export type Skill = (typeof SKILLS)[number];
export const skill = pgEnum("skill", SKILLS);

export const pods = pgTable("pods", {
  id: serial("id").primaryKey(),
  // The id of the pod's option in Jira's POD field. Ids survive the option being renamed; labels do not.
  jiraPodOptionId: text("jira_pod_option_id").notNull().unique(),
  // The option's label in Jira, refreshed by each sync. Shown to leads only, never matched on.
  jiraPodValue: text("jira_pod_value").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  leadPersonId: integer("lead_person_id").references((): AnyPgColumn => people.id),
});

export const people = pgTable(
  "people",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").unique(),
    jiraAccountId: text("jira_account_id").unique(),
    // A single column, so a person is in one pod at a time. Null once removed.
    podId: integer("pod_id").references(() => pods.id),
    mainSkill: skill("main_skill").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [check("people_active_in_a_pod", sql`not ${t.active} or ${t.podId} is not null`)],
);

// Skills outside a person's main skill. No row means 0%; the main skill is always 100% and never stored.
export const proficiencies = pgTable(
  "proficiencies",
  {
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    skill: skill("skill").notNull(),
    percent: integer("percent").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.skill] }),
    check("proficiencies_percent_range", sql`${t.percent} between 0 and 100`),
  ],
);

export const allowlist = pgTable("allowlist", {
  // Stored lowercase.
  email: text("email").primaryKey(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

// One row: the platform's Jira connection.
export const jiraSettings = pgTable(
  "jira_settings",
  {
    id: integer("id").primaryKey().default(1),
    site: text("site").notNull(),
    email: text("email").notNull(),
    // AES-256-GCM, see src/server/secrets.ts. Never leaves the server.
    tokenCiphertext: text("token_ciphertext").notNull(),
    tokenUpdatedAt: timestamp("token_updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [check("jira_settings_single_row", sql`${t.id} = 1`)],
);

// One row, absent until the admin first changes it: see getPlanningSettings.
export const planningSettings = pgTable(
  "planning_settings",
  {
    id: integer("id").primaryKey().default(1),
    // The share of available days that is plannable, as a whole percent.
    focusPercent: integer("focus_percent").notNull(),
  },
  (t) => [
    check("planning_settings_single_row", sql`${t.id} = 1`),
    check("planning_settings_focus_range", sql`${t.focusPercent} between 1 and 100`),
  ],
);

// Company-wide non-working days, maintained by the admin.
export const holidays = pgTable("holidays", {
  date: date("date").primaryKey(),
  name: text("name").notNull(),
});

// ---- Synced from Jira, replaced on each sync ----

export const sprintState = pgEnum("sprint_state", ["future", "active", "closed"]);

// Sprints on DTP board 267. The id is Jira's sprint id.
export const sprints = pgTable("sprints", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  state: sprintState("state").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  completeDate: timestamp("complete_date", { withTimezone: true }),
});

// Jira only shares the email when the user's profile allows it.
export type JiraUser = { accountId: string; displayName: string; emailAddress?: string };

export type StatusCategory = "new" | "indeterminate" | "done";

// Plannable DTP tickets. Sub-tasks and epics are not stored here.
export const tickets = pgTable("tickets", {
  key: text("key").primaryKey(),
  summary: text("summary").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  // Jira's status category: new, indeterminate or done.
  statusCategory: text("status_category").$type<StatusCategory>().notNull(),
  priority: text("priority"),
  // Jira POD option id, matched against pods.jira_pod_option_id.
  podOptionId: text("pod_option_id"),
  // Every sprint the ticket has been in; a carried-over ticket keeps its closed sprints.
  sprintIds: integer("sprint_ids")
    .array()
    .notNull()
    .default(sql`'{}'`),
  assignee: jsonb("assignee").$type<JiraUser>(),
  devOwners: jsonb("dev_owners").$type<JiraUser[]>().notNull(),
  epicKey: text("epic_key"),
  epicSummary: text("epic_summary"),
  readyForProductionDate: date("ready_for_production_date"),
  // Skill-days per skill. A skill without a key is not estimated, which is not the same as 0.
  estimates: jsonb("estimates").$type<Estimates>().notNull().default({}),
  // Created already done: finished work logged in Jira after the fact, which no sprint's capacity went into.
  loggedDone: boolean("logged_done").notNull().default(false),
});

export type Estimates = Partial<Record<Skill, number>>;

export const syncStatus = pgEnum("sync_status", ["running", "succeeded", "failed"]);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: syncStatus("status").notNull().default("running"),
  error: text("error"),
});

// ---- Platform-owned, per sprint ----

// Days a person is away in a sprint, in half-day steps. No row means no leave.
export const leave = pgTable(
  "leave",
  {
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    // Goes with the sprint when Jira deletes it.
    sprintId: integer("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    days: numeric("days", { precision: 3, scale: 1, mode: "number" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.sprintId] }),
    check("leave_half_days", sql`${t.days} > 0 and ${t.days} * 2 = trunc(${t.days} * 2)`),
  ],
);

export const manualItemKind = pgEnum("manual_item_kind", ["work", "placeholder"]);

// Work Jira does not hold (support, interviews) and placeholders for work not ticketed yet.
// No status, comments or sub-items: the platform is not a Jira clone.
export const manualItems = pgTable(
  "manual_items",
  {
    id: serial("id").primaryKey(),
    podId: integer("pod_id")
      .notNull()
      .references(() => pods.id),
    sprintId: integer("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    // Optional: a placeholder can reserve the pod's capacity before anyone is picked.
    personId: integer("person_id").references(() => people.id),
    kind: manualItemKind("kind").notNull(),
    title: text("title").notNull(),
    skill: skill("skill").notNull(),
    days: numeric("days", { precision: 4, scale: 1, mode: "number" }).notNull(),
    // A placeholder's ticket, once it exists. It stops counting when that ticket is synced into the sprint.
    jiraKey: text("jira_key"),
  },
  (t) => [
    check("manual_items_half_days", sql`${t.days} > 0 and ${t.days} * 2 = trunc(${t.days} * 2)`),
    check("manual_items_key_on_placeholders", sql`${t.jiraKey} is null or ${t.kind} = 'placeholder'`),
  ],
);

// DTP epics, synced with the tickets and replaced on each sync. Their child tickets point here by epic_key.
export const epics = pgTable("epics", {
  key: text("key").primaryKey(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  statusCategory: text("status_category").$type<StatusCategory>().notNull(),
  // Jira POD option id. Most epics have none; then their tickets decide, see planEpics.
  podOptionId: text("pod_option_id"),
  readyForProductionDate: date("ready_for_production_date"),
});

export const TSHIRT_SIZES = ["S", "M", "L", "XL"] as const;
export type TshirtSize = (typeof TSHIRT_SIZES)[number];
export const tshirtSize = pgEnum("tshirt_size", TSHIRT_SIZES);

// A lead's first guess at an epic's size. Keyed by Jira key, not a foreign key, so it outlives each sync's replace.
export const epicSizes = pgTable("epic_sizes", {
  epicKey: text("epic_key").primaryKey(),
  size: tshirtSize("size").notNull(),
});

export const SNAPSHOT_KINDS = ["start", "close"] as const;
export type SnapshotKind = (typeof SNAPSHOT_KINDS)[number];
export const snapshotKind = pgEnum("snapshot_kind", SNAPSHOT_KINDS);

// A pod's capacity and commitment frozen when a sprint starts, and what got done when it closes.
// Taken by the sync on each state change, or by the admin; a retake overwrites.
// History outlives the sprint: no foreign key to sprints, and the sprint's name and dates are kept here.
export const snapshots = pgTable(
  "snapshots",
  {
    podId: integer("pod_id")
      .notNull()
      .references(() => pods.id),
    sprintId: integer("sprint_id").notNull(),
    sprintName: text("sprint_name").notNull(),
    sprintStartDate: timestamp("sprint_start_date", { withTimezone: true }),
    sprintEndDate: timestamp("sprint_end_date", { withTimezone: true }),
    kind: snapshotKind("kind").notNull(),
    skill: skill("skill").notNull(),
    capacity: numeric("capacity", { precision: 6, scale: 2, mode: "number" }).notNull(),
    // Null when nothing in the skill was estimated, so it never reads as 0.
    committed: numeric("committed", { precision: 6, scale: 2, mode: "number" }),
    // Close snapshots only: the estimates of the sprint's tickets in status category Done.
    completed: numeric("completed", { precision: 6, scale: 2, mode: "number" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.podId, t.sprintId, t.kind, t.skill] })],
);
