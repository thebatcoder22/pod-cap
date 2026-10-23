import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export default async function setup() {
  const db = drizzle(process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/podcap_test");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.$client.end();
}
