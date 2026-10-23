import "dotenv/config";
// Migrates and seeds the database in DATABASE_URL. Safe to run on every deploy.
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/db";
import { seedRoster } from "../src/server/roster";

await migrate(db, { migrationsFolder: "./drizzle" });
await seedRoster(db);
await db.$client.end();
console.log("Database migrated and seeded.");
