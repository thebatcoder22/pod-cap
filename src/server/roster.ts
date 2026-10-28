import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { allowlist, people, podMembers, pods, type Skill } from "@/db/schema";

// Day-one roster from the Engineering Rhythm deck and Slack roles (see spec/implementation-decisions.md "Seed data").
const ROSTER: {
  name: string;
  /** The pod's option in Jira's POD field: its id, and its label at seed time. */
  jiraPodOptionId: string;
  jiraPodValue: string;
  slug: string;
  /** One of the members. */
  lead: string;
  /** Someone already in another pod joins this one too, splitting their capacity: share here, the rest there. */
  members: [name: string, skill: Skill, share?: number][];
}[] = [
  {
    name: "RoadMap 1",
    jiraPodOptionId: "11231",
    jiraPodValue: "RoadMap 1-Shikar",
    slug: "roadmap-1",
    lead: "Shikhar Seth",
    members: [
      ["Shikhar Seth", "AI"],
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
    lead: "Aman Tyagi",
    members: [
      ["Aman Tyagi", "BE"],
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
    lead: "Rahul Saharan",
    members: [
      ["Rahul Saharan", "BE"],
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
    lead: "Abdullah Ghani",
    members: [
      ["Abdullah Ghani", "BE"],
      ["Rahul Lanjewar", "BE"],
      ["Abhay Sharma", "FE"],
      ["Akhilesh Mourya", "FE"],
    ],
  },
  {
    name: "Support",
    jiraPodOptionId: "11265",
    jiraPodValue: "Support",
    slug: "support",
    lead: "Shadab Anjum",
    members: [
      ["Shadab Anjum", "FE", 50],
      ["Nanagoud", "BE", 50],
      ["Shashwat Mohite", "DevOps"],
    ],
  },
];

// Leads who edit their pod. Shadab has no address here yet; the admin allowlists him in Settings.
const EMAILS: Record<string, string> = {
  "Shikhar Seth": "shikhar@delightree.com",
  "Aman Tyagi": "aman@delightree.com",
  "Rahul Saharan": "rahul@delightree.com",
  "Abdullah Ghani": "abdullah@delightree.com",
};

const ADMIN_EMAIL = "aman@delightree.com";

/** Seeds each roster pod that does not exist yet, with its people and the allowlist. Never changes a seeded pod. */
export async function seedRoster(db: Db) {
  await db.transaction(async (tx) => {
    const seeded = new Set((await tx.select({ id: pods.jiraPodOptionId }).from(pods)).map((p) => p.id));

    for (const p of ROSTER.filter((p) => !seeded.has(p.jiraPodOptionId))) {
      const [pod] = await tx
        .insert(pods)
        .values({ jiraPodOptionId: p.jiraPodOptionId, jiraPodValue: p.jiraPodValue, name: p.name, slug: p.slug })
        .returning();
      for (const [name, mainSkill, share = 100] of p.members) {
        let [person] = await tx
          .select()
          .from(people)
          .where(and(eq(people.name, name), eq(people.active, true)));
        person ??= (await tx.insert(people).values({ name, email: EMAILS[name], mainSkill }).returning())[0];
        await tx.insert(podMembers).values({ podId: pod.id, personId: person.id, share });
        // ponytail: assumes the other pod is the person's only one, true for everyone the roster shares.
        if (share < 100)
          await tx
            .update(podMembers)
            .set({ share: 100 - share })
            .where(and(eq(podMembers.personId, person.id), ne(podMembers.podId, pod.id)));
        if (name === p.lead) await tx.update(pods).set({ leadPersonId: person.id }).where(eq(pods.id, pod.id));
      }
      const email = EMAILS[p.lead];
      if (email)
        await tx
          .insert(allowlist)
          .values({ email, isAdmin: email === ADMIN_EMAIL })
          .onConflictDoNothing();
    }
  });
}
