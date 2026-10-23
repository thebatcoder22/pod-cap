import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowlist } from "@/db/schema";

export type Access = { allowed: false } | { allowed: true; isAdmin: boolean };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function checkAccess(email: string): Promise<Access> {
  const [row] = await db
    .select()
    .from(allowlist)
    .where(eq(allowlist.email, normalizeEmail(email)));
  return row ? { allowed: true, isAdmin: row.isAdmin } : { allowed: false };
}
