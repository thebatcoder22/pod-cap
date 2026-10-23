import { boolean, pgEnum, pgTable, serial, text, integer, type AnyPgColumn } from "drizzle-orm/pg-core";

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
