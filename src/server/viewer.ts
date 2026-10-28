import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { people, podMembers, pods } from "@/db/schema";
import { checkAccess, normalizeEmail } from "./access";

export type Viewer = {
  email: string;
  name: string;
  /** On the allowlist: may edit their own pods. Everyone else at Delightree views only. */
  canEdit: boolean;
  isAdmin: boolean;
  /** The pods they are in: the one they lead first, then by share. Empty for someone in no pod. */
  pods: { id: number; slug: string; name: string }[];
};

/** Re-checks the allowlist so removing an address revokes edit rights on the next request. */
export async function viewerForEmail(rawEmail: string): Promise<Viewer | null> {
  const email = normalizeEmail(rawEmail);
  const access = await checkAccess(email);
  if (!access.allowed) return null;

  const rows = await db
    .select({ name: people.name, podId: pods.id, podSlug: pods.slug, podName: pods.name })
    .from(people)
    .leftJoin(podMembers, eq(podMembers.personId, people.id))
    .leftJoin(pods, eq(pods.id, podMembers.podId))
    .where(eq(people.email, email))
    .orderBy(desc(sql`${pods.leadPersonId} = ${people.id}`), desc(podMembers.share), asc(pods.id));

  return {
    email,
    name: rows[0]?.name ?? email,
    canEdit: access.canEdit,
    isAdmin: access.isAdmin,
    pods: rows.flatMap((r) => (r.podId ? [{ id: r.podId, slug: r.podSlug!, name: r.podName! }] : [])),
  };
}
