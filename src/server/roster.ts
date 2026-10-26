import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { allowlist, people, pods, type Skill } from "@/db/schema";

// Day-one roster from the Engineering Rhythm deck and Slack roles (see spec/implementation-decisions.md "Seed data").
const ROSTER: {
  name: string;
  /** The pod's option in Jira's POD field: its id, and its label at seed time. */
  jiraPodOptionId: string;
  jiraPodValue: string;
  slug: string;
  lead: { name: string; email: string; skill: Skill };
  members: [name: string, skill: Skill][];
}[] = [
  {
    name: "RoadMap 1",
    jiraPodOptionId: "11231",
    jiraPodValue: "RoadMap 1-Shikar",
    slug: "roadmap-1",
    lead: { name: "Shikhar Seth", email: "shikhar@delightree.com", skill: "AI" },
    members: [
      ["Hrishikesh Pujari", "BE"],
      ["Vaibhav Pal", "FE"],
      ["Divyanshu", "FE"],
      ["Shahid Khan", "FE"],
    ],
  },
  {
    name: "RoadMap 2",
    jiraPodOptionId: "11232",
    jiraPodValue: "RoadMap 2-Aman",
    slug: "roadmap-2",
    lead: { name: "Aman Tyagi", email: "aman@delightree.com", skill: "BE" },
    members: [
      ["Mayank Awasthi", "FE"],
      ["Muthaiyan Mani", "FE"],
      ["Kalpan Punamiya", "Data"],
      ["Akash Singh", "AI"],
    ],
  },
  {
    name: "Velocity",
    jiraPodOptionId: "11230",
    jiraPodValue: "Velocity",
    slug: "velocity",
    lead: { name: "Rahul Saharan", email: "rahul@delightree.com", skill: "BE" },
    members: [
      ["Manish Bisht", "FE"],
      ["Saikrishna Kotagiri", "FE"],
      ["Shadab Anjum", "FE"],
      ["Nanagoud", "BE"],
    ],
  },
  {
    name: "Atlas",
    jiraPodOptionId: "11229",
    jiraPodValue: "Atlas",
    slug: "atlas",
    lead: { name: "Abdullah Ghani", email: "abdullah@delightree.com", skill: "BE" },
    members: [
      ["Rahul Lanjewar", "BE"],
      ["Abhay Sharma", "FE"],
      ["Akhilesh Mourya", "FE"],
    ],
  },
];

const ADMIN_EMAIL = "aman@delightree.com";

/** Seeds pods, people and the allowlist. Does nothing once any pod exists. */
export async function seedRoster(db: Db) {
  await db.transaction(async (tx) => {
    if ((await tx.select({ id: pods.id }).from(pods).limit(1)).length) return;

    for (const p of ROSTER) {
      const [pod] = await tx
        .insert(pods)
        .values({ jiraPodOptionId: p.jiraPodOptionId, jiraPodValue: p.jiraPodValue, name: p.name, slug: p.slug })
        .returning();
      const [lead] = await tx
        .insert(people)
        .values({ name: p.lead.name, email: p.lead.email, podId: pod.id, mainSkill: p.lead.skill })
        .returning();
      await tx.insert(people).values(p.members.map(([name, mainSkill]) => ({ name, mainSkill, podId: pod.id })));
      await tx.update(pods).set({ leadPersonId: lead.id }).where(eq(pods.id, pod.id));
      await tx.insert(allowlist).values({ email: p.lead.email, isAdmin: p.lead.email === ADMIN_EMAIL });
    }
  });
}
