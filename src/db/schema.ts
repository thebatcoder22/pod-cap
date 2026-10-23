import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const SKILLS = ["FE", "BE", "Data", "AI"] as const;
export type Skill = (typeof SKILLS)[number];
export const skill = pgEnum("skill", SKILLS);

export const pods = pgTable("pods", {
  id: serial("id").primaryKey(),
  jiraPodValue: text("jira_pod_value").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  leadPersonId: integer("lead_person_id").references((): AnyPgColumn => people.id),
});

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  jiraAccountId: text("jira_account_id").unique(),
  // Null only for the "No pod yet" list.
  podId: integer("pod_id").references(() => pods.id),
  mainSkill: skill("main_skill").notNull(),
  active: boolean("active").notNull().default(true),
});

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

export type JiraUser = { accountId: string; displayName: string };

// Plannable DTP tickets. Sub-tasks and epics are not stored here.
export const tickets = pgTable("tickets", {
  key: text("key").primaryKey(),
  summary: text("summary").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  // Jira's status category: new, indeterminate or done.
  statusCategory: text("status_category").$type<"new" | "indeterminate" | "done">().notNull(),
  priority: text("priority"),
  // Jira POD value, matched against pods.jira_pod_value.
  pod: text("pod"),
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
});

export const syncStatus = pgEnum("sync_status", ["running", "succeeded", "failed"]);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: syncStatus("status").notNull().default("running"),
  error: text("error"),
});
