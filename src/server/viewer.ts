import { eq } from "drizzle-orm";
import { db } from "@/db";
import { people, pods } from "@/db/schema";
import { checkAccess, normalizeEmail } from "./access";

export type Viewer = {
  email: string;
  name: string;
  /** On the allowlist: may edit their own pod. Everyone else at Delightree views only. */
  canEdit: boolean;
  isAdmin: boolean;
  pod: { id: number; slug: string; name: string } | null;
};

/** Re-checks the allowlist so removing an address revokes edit rights on the next request. */
export async function viewerForEmail(rawEmail: string): Promise<Viewer | null> {
  const email = normalizeEmail(rawEmail);
  const access = await checkAccess(email);
  if (!access.allowed) return null;

  const [row] = await db
    .select({ name: people.name, podId: pods.id, podSlug: pods.slug, podName: pods.name })
    .from(people)
    .leftJoin(pods, eq(pods.id, people.podId))
    .where(eq(people.email, email));

  return {
    email,
    name: row?.name ?? email,
    canEdit: access.canEdit,
    isAdmin: access.isAdmin,
    pod: row?.podId ? { id: row.podId, slug: row.podSlug!, name: row.podName! } : null,
  };
}
