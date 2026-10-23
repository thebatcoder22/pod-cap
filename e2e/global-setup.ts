import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema";
import { resetToRoster } from "../tests/reset";
import { E2E_DATABASE_URL } from "../playwright.config";
import { seedSyncedJira } from "./seed-jira";

export default async function setup() {
  const db = drizzle(E2E_DATABASE_URL, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await resetToRoster(db);
  await seedSyncedJira(db);
  await db.$client.end();
}
