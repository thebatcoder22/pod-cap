import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { people, pods, type Skill } from "@/db/schema";
import { withProficiency, type Proficiency } from "./people";

export async function listPods(): Promise<{ slug: string; name: string }[]> {
  return db.select({ slug: pods.slug, name: pods.name }).from(pods).orderBy(asc(pods.id));
}

export type PodPage = {
  pod: { id: number; slug: string; name: string; jiraPodValue: string };
  members: {
    id: number;
    name: string;
    mainSkill: Skill;
    jiraAccountId: string | null;
    isLead: boolean;
    proficiency: Proficiency;
  }[];
};

export async function getPodPage(slug: string): Promise<PodPage | null> {
  const [pod] = await db.select().from(pods).where(eq(pods.slug, slug));
  if (!pod) return null;

  const rows = await db
    .select({ id: people.id, name: people.name, mainSkill: people.mainSkill, jiraAccountId: people.jiraAccountId })
    .from(people)
    .where(and(eq(people.podId, pod.id), eq(people.active, true)))
    .orderBy(desc(sql`${people.id} = ${pod.leadPersonId ?? 0}`), asc(people.name));

  const members = (await withProficiency(rows)).map((m) => ({ ...m, isLead: m.id === pod.leadPersonId }));

  return { pod: { id: pod.id, slug: pod.slug, name: pod.name, jiraPodValue: pod.jiraPodValue }, members };
}
