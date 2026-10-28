import { and, asc, eq, inArray, isNotNull, isNull, notExists, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { people, podMembers, pods, proficiencies, SKILLS, tickets, type JiraUser, type Skill } from "@/db/schema";
import { assertAdmin, assertCanEditPod } from "./permissions";
import { ValidationError } from "./settings";
import type { Viewer } from "./viewer";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Person = typeof people.$inferSelect;
type SyncedUser = JiraUser & { tickets: number };

/** Everyone who is an assignee or Dev Owner on a synced DTP ticket, with how many tickets they are on. */
// ponytail: scans every synced ticket; give Jira users their own table if this shows up in page times.
async function jiraUsers(q: Db | Tx = db): Promise<Map<string, SyncedUser>> {
  const rows = await q.select({ assignee: tickets.assignee, devOwners: tickets.devOwners }).from(tickets);
  const users = new Map<string, SyncedUser>();
  for (const t of rows) {
    const onTicket = new Map([...(t.assignee ? [t.assignee] : []), ...t.devOwners].map((u) => [u.accountId, u]));
    for (const u of onTicket.values()) {
      const seen = users.get(u.accountId);
      users.set(u.accountId, {
        ...u,
        emailAddress: u.emailAddress ?? seen?.emailAddress,
        tickets: (seen?.tickets ?? 0) + 1,
      });
    }
  }
  return users;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const firstName = (s: string) => normalize(s).split(" ")[0];

/**
 * Matches active people who have no Jira account yet against the Jira users nobody is linked to.
 * Only an email match, or one exact name match, is sure enough to link. Anything looser
 * (the same first name) is a candidate for the admin to confirm, so the two Rahuls are never guessed.
 */
function matchPeople(all: Person[], users: JiraUser[]) {
  const taken = new Set(all.map((p) => p.jiraAccountId));
  const free = users.filter((u) => !taken.has(u.accountId));
  const unlinked = all.filter((p) => p.active && !p.jiraAccountId);

  const sure = new Map<number, string>();
  for (const p of unlinked) {
    const byEmail = free.filter((u) => p.email && u.emailAddress && normalize(u.emailAddress) === normalize(p.email));
    const byName = free.filter((u) => normalize(u.displayName) === normalize(p.name));
    const namesakes = all.filter((q) => normalize(q.name) === normalize(p.name)).length;
    const match = byEmail.length === 1 ? byEmail[0] : byName.length === 1 && namesakes === 1 ? byName[0] : null;
    if (match) sure.set(p.id, match.accountId);
  }
  // An account two people matched is a question for the admin, not a link.
  const claims = [...sure.values()];
  for (const [id, accountId] of sure) if (claims.indexOf(accountId) !== claims.lastIndexOf(accountId)) sure.delete(id);

  const linked = new Set(sure.values());
  // A sure match the next sync has yet to link is that person's only candidate.
  const candidates = new Map(
    unlinked.map((p) => [
      p.id,
      free.filter((u) =>
        sure.has(p.id)
          ? u.accountId === sure.get(p.id)
          : !linked.has(u.accountId) && firstName(u.displayName) === firstName(p.name),
      ),
    ]),
  );
  return { sure, candidates };
}

/** Run by every sync: links the people a Jira account can be matched to for sure. Never changes a link. */
export async function linkJiraAccounts(tx: Tx) {
  const { sure } = matchPeople(await tx.select().from(people), [...(await jiraUsers(tx)).values()]);
  for (const [id, jiraAccountId] of sure) {
    await tx
      .update(people)
      .set({ jiraAccountId })
      .where(and(eq(people.id, id), isNull(people.jiraAccountId)));
  }
}

const account = ({ accountId, displayName }: JiraUser): JiraUser => ({ accountId, displayName });

export type PeopleAdmin = {
  pods: { id: number; name: string }[];
  /** Active people with no Jira account yet, the ones with a suggestion first. */
  toConfirm: { id: number; name: string; pod: string; candidates: JiraUser[] }[];
  /** Jira users on DTP tickets who are no one in the platform, busiest first, including suggestions. */
  noPod: (JiraUser & { tickets: number })[];
  /** Active people, by pod, lead first. Someone in two pods is listed in each. */
  members: {
    id: number;
    name: string;
    mainSkill: Skill;
    /** Leads this pod. */
    isLead: boolean;
    pod: { id: number; name: string };
    /** The percent of their capacity this pod plans with. */
    share: number;
    /** Their other pod, when they are in two. */
    alsoIn: { id: number; name: string } | null;
    /** The display name is null when the account is on no synced ticket. */
    jira: { accountId: string; displayName: string | null } | null;
  }[];
};

export async function getPeopleAdmin(viewer: Viewer | null): Promise<PeopleAdmin> {
  assertAdmin(viewer);
  const [all, podRows, memberships, users] = await Promise.all([
    db.select().from(people).orderBy(asc(people.name)),
    db.select().from(pods).orderBy(asc(pods.id)),
    db.select().from(podMembers),
    jiraUsers(),
  ]);
  const { sure, candidates } = matchPeople(all, [...users.values()]);
  const podById = new Map(podRows.map((p) => [p.id, p]));
  const active = all.filter((p) => p.active);
  const podsOf = (p: Person) =>
    memberships
      .filter((m) => m.personId === p.id)
      .toSorted((a, b) => podRows.indexOf(podById.get(a.podId)!) - podRows.indexOf(podById.get(b.podId)!));

  // Sure matches the next sync links are not new people. Suggestions stay listed: they may be new hires.
  const linked = new Set([...all.map((p) => p.jiraAccountId), ...sure.values()]);

  return {
    pods: podRows.map(({ id, name }) => ({ id, name })),
    toConfirm: active
      .filter((p) => !p.jiraAccountId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        pod: podsOf(p)
          .map((m) => podById.get(m.podId)!.name)
          .join(" and "),
        candidates: candidates.get(p.id)!.map(account),
      }))
      .sort((a, b) => Number(!a.candidates.length) - Number(!b.candidates.length)),
    noPod: [...users.values()]
      .filter((u) => !linked.has(u.accountId))
      .map((u) => ({ ...account(u), tickets: u.tickets }))
      .sort(
        (a, b) => b.tickets - a.tickets || a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
      ),
    members: podRows.flatMap((pod) =>
      active
        .flatMap((p) => {
          const mine = podsOf(p);
          const here = mine.find((m) => m.podId === pod.id);
          if (!here) return [];
          const other = mine.find((m) => m.podId !== pod.id);
          return [
            {
              id: p.id,
              name: p.name,
              mainSkill: p.mainSkill,
              isLead: pod.leadPersonId === p.id,
              pod: { id: pod.id, name: pod.name },
              share: here.share,
              alsoIn: other ? { id: other.podId, name: podById.get(other.podId)!.name } : null,
              jira: p.jiraAccountId
                ? { accountId: p.jiraAccountId, displayName: users.get(p.jiraAccountId)?.displayName ?? null }
                : null,
            },
          ];
        })
        .toSorted((a, b) => Number(b.isLead) - Number(a.isLead)),
    ),
  };
}

/** Links a person to a Jira user on the synced tickets: confirms a suggestion, or corrects it. */
export async function confirmJiraAccount(viewer: Viewer | null, personId: number, accountId: string) {
  assertAdmin(viewer);
  const person = await activePerson(personId);
  const user = await unlinkedJiraUser(accountId, person.id);
  await db.update(people).set({ jiraAccountId: user.accountId }).where(eq(people.id, person.id));
  return { name: person.name, jira: user.displayName };
}

/** Adds someone from the "No pod yet" list to a pod. */
export async function addFromJira(
  viewer: Viewer | null,
  input: { accountId: string; podId: number; mainSkill: Skill },
) {
  assertAdmin(viewer);
  if (!SKILLS.includes(input.mainSkill)) throw new ValidationError("Pick a main skill.");
  const pod = await existingPod(input.podId);
  const user = await unlinkedJiraUser(input.accountId);
  await db.transaction(async (tx) => {
    const [person] = await tx
      .insert(people)
      .values({ name: user.displayName, jiraAccountId: user.accountId, mainSkill: input.mainSkill })
      .returning();
    await tx.insert(podMembers).values({ podId: pod.id, personId: person.id });
  });
  return { name: user.displayName, pod: pod.name };
}

/** Moves someone from one of their pods to another, keeping their share. */
export async function movePerson(viewer: Viewer | null, personId: number, fromPodId: number, toPodId: number) {
  assertAdmin(viewer);
  const { person, here, mine } = await membership(personId, fromPodId);
  await notALead(person, here, "moved");
  const pod = await existingPod(toPodId);
  if (mine.some((m) => m.podId === pod.id)) throw new ValidationError(`${person.name} is already in ${pod.name}.`);
  await db
    .update(podMembers)
    .set({ podId: pod.id })
    .where(and(eq(podMembers.personId, person.id), eq(podMembers.podId, here.podId)));
  return { name: person.name, pod: pod.name };
}

/** Adds someone to a second pod. Their capacity splits evenly until the admin sets the shares. */
export async function addToPod(viewer: Viewer | null, personId: number, podId: number) {
  assertAdmin(viewer);
  const person = await activePerson(personId);
  const pod = await existingPod(podId);
  const mine = await membershipsOf(person.id);
  if (mine.some((m) => m.podId === pod.id)) throw new ValidationError(`${person.name} is already in ${pod.name}.`);
  // ponytail: two pods at most, so one share sets the other; allow more when someone really is in three.
  if (mine.length > 1) throw new ValidationError(`${person.name} is already in two pods.`);
  await db.transaction(async (tx) => {
    await tx.update(podMembers).set({ share: 50 }).where(eq(podMembers.personId, person.id));
    await tx.insert(podMembers).values({ podId: pod.id, personId: person.id, share: 50 });
  });
  return { name: person.name, pod: pod.name };
}

/** Sets the share of their capacity one of someone's two pods plans with; the other pod gets the rest. */
export async function setShare(viewer: Viewer | null, personId: number, podId: number, share: number) {
  assertAdmin(viewer);
  const { person, here, mine } = await membership(personId, podId);
  const other = mine.find((m) => m.podId !== here.podId);
  if (!other) throw new ValidationError(`${person.name} is only in ${here.pod}, so it plans with all of their time.`);
  if (!Number.isInteger(share) || share < 1 || share > 99)
    throw new ValidationError("Enter a whole percent from 1 to 99.");
  await db.transaction(async (tx) => {
    await tx
      .update(podMembers)
      .set({ share })
      .where(and(eq(podMembers.personId, person.id), eq(podMembers.podId, here.podId)));
    await tx
      .update(podMembers)
      .set({ share: 100 - share })
      .where(and(eq(podMembers.personId, person.id), eq(podMembers.podId, other.podId)));
  });
  return { name: person.name, pod: here.pod, share, other: { pod: other.pod, share: 100 - share } };
}

/**
 * Takes someone out of one pod. Someone in two pods stays in the other, which gets all of their time. Out of their
 * only pod they have left: they stay linked, so their old tickets do not list them again.
 */
export async function removePerson(viewer: Viewer | null, personId: number, podId: number) {
  assertAdmin(viewer);
  const { person, here, mine } = await membership(personId, podId);
  await notALead(person, here, "removed");
  const other = mine.find((m) => m.podId !== here.podId);
  await db.transaction(async (tx) => {
    await tx.delete(podMembers).where(and(eq(podMembers.personId, person.id), eq(podMembers.podId, here.podId)));
    if (other) await tx.update(podMembers).set({ share: 100 }).where(eq(podMembers.personId, person.id));
    else await tx.update(people).set({ active: false }).where(eq(people.id, person.id));
  });
  return { name: person.name, pod: here.pod, stillIn: other?.pod ?? null };
}

/** Percent per skill: 100 in the main skill, 0 in any skill nobody has set. */
export type Proficiency = Record<Skill, number>;

/** The one place the proficiency rule lives, so every reader agrees. */
export async function withProficiency<P extends { id: number; mainSkill: Skill }>(
  persons: P[],
): Promise<(P & { proficiency: Proficiency })[]> {
  const saved = persons.length
    ? await db
        .select()
        .from(proficiencies)
        .where(
          inArray(
            proficiencies.personId,
            persons.map((p) => p.id),
          ),
        )
    : [];
  return persons.map((p) => {
    const proficiency = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Proficiency;
    for (const row of saved) if (row.personId === p.id) proficiency[row.skill] = row.percent;
    proficiency[p.mainSkill] = 100;
    return { ...p, proficiency };
  });
}

/** Active people outside a pod who have a Jira account, with their pods' names and proficiency. */
export async function linkedPeopleOutside(podId: number) {
  const rows = await db
    .select({
      id: people.id,
      mainSkill: people.mainSkill,
      jiraAccountId: people.jiraAccountId,
      pod: sql<string>`string_agg(${pods.name}, ' and ' order by ${pods.id})`,
    })
    .from(people)
    .innerJoin(podMembers, eq(podMembers.personId, people.id))
    .innerJoin(pods, eq(pods.id, podMembers.podId))
    .where(
      and(
        eq(people.active, true),
        isNotNull(people.jiraAccountId),
        notExists(
          db
            .select()
            .from(podMembers)
            .where(and(eq(podMembers.personId, people.id), eq(podMembers.podId, podId))),
        ),
      ),
    )
    .groupBy(people.id);
  return withProficiency(rows.map((r) => ({ ...r, jiraAccountId: r.jiraAccountId! })));
}

/** A lead sets how well one of their own people does a skill outside their main one. */
export async function setProficiency(viewer: Viewer | null, personId: number, skill: Skill, percent: number) {
  const person = await activePerson(personId);
  await assertCanEditPerson(viewer, person.id);
  if (!SKILLS.includes(skill)) throw new ValidationError("Pick a skill.");
  if (skill === person.mainSkill)
    throw new ValidationError(`${skill} is ${person.name}'s main skill, so it stays 100%.`);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100)
    throw new ValidationError("Enter a whole number from 0 to 100.");

  await db
    .insert(proficiencies)
    .values({ personId: person.id, skill, percent })
    .onConflictDoUpdate({ target: [proficiencies.personId, proficiencies.skill], set: { percent } });
}

export async function activePerson(id: number) {
  if (!Number.isInteger(id)) throw new ValidationError("Pick a person.");
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, id), eq(people.active, true)));
  if (!person) throw new ValidationError("That person is no longer in any pod.");
  return person;
}

/** The pods someone is in, oldest pod first. */
async function membershipsOf(personId: number) {
  return db
    .select({ podId: podMembers.podId, pod: pods.name, share: podMembers.share })
    .from(podMembers)
    .innerJoin(pods, eq(pods.id, podMembers.podId))
    .where(eq(podMembers.personId, personId))
    .orderBy(asc(pods.id));
}

/** An active person, their membership of one pod, and all of their memberships. */
async function membership(personId: number, podId: number) {
  const person = await activePerson(personId);
  const mine = await membershipsOf(person.id);
  const here = mine.find((m) => m.podId === podId);
  if (!here) throw new ValidationError(`${person.name} is no longer in that pod.`);
  return { person, here, mine };
}

/** Leave and proficiency belong to the person, so a lead of any of their pods sets them. */
export async function assertCanEditPerson(viewer: Viewer | null, personId: number) {
  assertCanEditPod(viewer, ...(await membershipsOf(personId)).map((m) => m.podId));
}

/** Leads stay in the pod they lead. */
async function notALead(person: Person, pod: { podId: number; pod: string }, change: string) {
  const [led] = await db
    .select({ id: pods.id })
    .from(pods)
    .where(and(eq(pods.id, pod.podId), eq(pods.leadPersonId, person.id)));
  if (led) throw new ValidationError(`${person.name} leads ${pod.pod}, so they cannot be ${change}.`);
}

async function existingPod(id: number) {
  if (!Number.isInteger(id)) throw new ValidationError("Pick a pod.");
  const [pod] = await db.select().from(pods).where(eq(pods.id, id));
  if (!pod) throw new ValidationError("Pick a pod.");
  return pod;
}

/** A Jira user from the synced tickets that no other person is linked to. */
async function unlinkedJiraUser(accountId: string, forPersonId?: number) {
  const user = (await jiraUsers()).get(accountId);
  if (!user) throw new ValidationError("That Jira user is not on any synced DTP ticket. Sync, then try again.");
  const [owner] = await db.select().from(people).where(eq(people.jiraAccountId, accountId));
  if (owner && owner.id !== forPersonId) {
    throw new ValidationError(
      `${user.displayName} in Jira is already ${owner.active ? owner.name : `${owner.name}, who has been removed`}.`,
    );
  }
  return user;
}
