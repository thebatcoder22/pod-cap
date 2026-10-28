import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { people, podMembers, pods, type Skill } from "@/db/schema";
import { podSkills } from "./planning";
import { withProficiency, type Proficiency } from "./people";

export async function listPods(): Promise<{ slug: string; name: string; lead: string | null }[]> {
  return db
    .select({ slug: pods.slug, name: pods.name, lead: people.name })
    .from(pods)
    .leftJoin(people, eq(people.id, pods.leadPersonId))
    .orderBy(asc(pods.id));
}

export type PodPage = {
  pod: { id: number; slug: string; name: string; jiraPodOptionId: string; jiraPodValue: string };
  members: {
    id: number;
    name: string;
    mainSkill: Skill;
    jiraAccountId: string | null;
    isLead: boolean;
    proficiency: Proficiency;
    /** The percent of their capacity this pod plans with: under 100 when they are in another pod too. */
    share: number;
    /** Their other pod, when they are in two. */
    alsoIn: { name: string; slug: string } | null;
  }[];
  /** FE, BE, Data and AI, plus any other skill that is someone's main skill here. */
  skills: Skill[];
};

export async function getPodPage(slug: string): Promise<PodPage | null> {
  const [pod] = await db.select().from(pods).where(eq(pods.slug, slug));
  if (!pod) return null;

  const [rows, elsewhere] = await Promise.all([
    db
      .select({
        id: people.id,
        name: people.name,
        mainSkill: people.mainSkill,
        jiraAccountId: people.jiraAccountId,
        share: podMembers.share,
      })
      .from(podMembers)
      .innerJoin(people, eq(people.id, podMembers.personId))
      .where(and(eq(podMembers.podId, pod.id), eq(people.active, true)))
      .orderBy(desc(sql`${people.id} = ${pod.leadPersonId ?? 0}`), asc(people.name)),
    db
      .select({ personId: podMembers.personId, name: pods.name, slug: pods.slug })
      .from(podMembers)
      .innerJoin(pods, eq(pods.id, podMembers.podId))
      .where(ne(podMembers.podId, pod.id)),
  ]);
  const other = new Map(elsewhere.map(({ personId, ...p }) => [personId, p]));

  const members = (await withProficiency(rows)).map((m) => ({
    ...m,
    isLead: m.id === pod.leadPersonId,
    alsoIn: other.get(m.id) ?? null,
  }));

  return {
    pod: {
      id: pod.id,
      slug: pod.slug,
      name: pod.name,
      jiraPodOptionId: pod.jiraPodOptionId,
      jiraPodValue: pod.jiraPodValue,
    },
    members,
    skills: podSkills(members),
  };
}
