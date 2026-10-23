import { sql } from "drizzle-orm";
import type { Db } from "../src/db";
import { seedRoster } from "../src/server/roster";

/** Empties every table and reseeds the day-one roster. Shared by Vitest and Playwright setup. */
export async function resetToRoster(db: Db) {
  await db.execute(
    sql`truncate pods, people, allowlist, jira_settings, sprints, tickets, sync_runs restart identity cascade`,
  );
  await seedRoster(db);
}
