import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Neon's URL says sslmode=require, which pg already treats as verify-full (and warns about). Say it outright.
const url = process.env.DATABASE_URL!.replace("sslmode=require", "sslmode=verify-full");

export const db = drizzle(url, { schema });
export type Db = typeof db;
