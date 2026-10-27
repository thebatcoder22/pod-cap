import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowlist } from "@/db/schema";

/** Everyone at Delightree may sign in and view; the allowlist decides who may edit. */
export type Access = { allowed: false } | { allowed: true; canEdit: boolean; isAdmin: boolean };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isDelightreeEmail = (email: string) => /^[^\s@]+@delightree\.com$/.test(normalizeEmail(email));

export async function checkAccess(email: string): Promise<Access> {
  if (!isDelightreeEmail(email)) return { allowed: false };
  const [row] = await db
    .select()
    .from(allowlist)
    .where(eq(allowlist.email, normalizeEmail(email)));
  return { allowed: true, canEdit: !!row, isAdmin: row?.isAdmin ?? false };
}
