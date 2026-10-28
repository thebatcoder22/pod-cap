import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import { db } from "@/db";
import { podMembers, pods, type JiraUser } from "@/db/schema";
import { getCapacitySheet, setLeave } from "./capacity";
import { addToPod, getPeopleAdmin, removePerson, setShare } from "./people";
import { ForbiddenError } from "./permissions";
import { getPodPage } from "./pods";
import { seedRoster } from "./roster";
import { saveJiraSettings, ValidationError } from "./settings";
import { getSprintView } from "./sprints";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const FE_DAYS = "customfield_11525";
const BE_DAYS = "customfield_11524";
const DEV_OWNERS = "customfield_10777";
const POD = "customfield_11457";
const OCT_SPRINT_2 = dtpSprints.values.find((s) => s.id === 432)!;
// Nanagoud is on no recorded ticket, so he gets a made-up account, linked by his Jira name.
const NANAGOUD: JiraUser = { accountId: "a-nanagoud", displayName: "nanagoud" };

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
});

/** Shadab's account as the recorded DTP tickets have it. */
const shadab = () =>
  jira.issues
    .flatMap((i) => [i.fields.assignee, ...((i.fields[DEV_OWNERS] ?? []) as JiraUser[])] as (JiraUser | null)[])
    .find((u) => u?.displayName === "Shadab Anjum")!;

/** Puts a DTP ticket in Oct Spint 2 under a POD option, owned by `owners`. */
function plan(key: string, pod: { value: string; id: string }, owners: JiraUser[], fields: Record<string, unknown>) {
  Object.assign(jira.issue(key).fields, {
    [POD]: pod,
    customfield_10020: [OCT_SPRINT_2],
    assignee: null,
    [DEV_OWNERS]: owners,
    ...fields,
  });
}
const VELOCITY = { value: "Velocity", id: "11230" };
const SUPPORT = { value: "Support", id: "11265" };

async function sheet(slug: string) {
  const page = (await getPodPage(slug))!;
  const view = await getSprintView(page.pod.jiraPodOptionId, String(OCT_SPRINT_2.id));
  return { page, view, sheet: await getCapacitySheet(page, view.sprint!, view.tickets) };
}
const member = async (slug: string, name: string) => (await getPodPage(slug))!.members.find((m) => m.name === name)!;
const shares = async (name: string) =>
  (await getPeopleAdmin(aman)).members.filter((m) => m.name === name).map((m) => [m.pod.name, m.share]);

describe("the Support pod", () => {
  it("is led by Shadab, with Nanagoud and Shashwat, and Shadab and Nanagoud stay in Velocity", async () => {
    const support = (await getPodPage("support"))!;
    expect(support.pod).toMatchObject({ name: "Support", jiraPodOptionId: "11265" });
    expect(support.members.map((m) => [m.name, m.mainSkill, m.share, m.isLead, m.alsoIn?.slug ?? null])).toEqual([
      ["Shadab Anjum", "FE", 50, true, "velocity"],
      ["Nanagoud", "BE", 50, false, "velocity"],
      ["Shashwat Mohite", "DevOps", 100, false, null],
    ]);
    expect(await member("velocity", "Shadab Anjum")).toMatchObject({
      share: 50,
      isLead: false,
      alsoIn: { name: "Support" },
    });
  });

  it("plans in DevOps only where someone's main skill is DevOps", async () => {
    expect((await getPodPage("support"))!.skills).toEqual(["FE", "BE", "Data", "AI", "DevOps"]);
    expect((await getPodPage("velocity"))!.skills).toEqual(["FE", "BE", "Data", "AI"]);
  });

  it("is added to a database seeded before it, leaving the other pods as they are", async () => {
    const support = (await getPodPage("support"))!.pod.id;
    await db.delete(podMembers).where(eq(podMembers.podId, support));
    await db.update(podMembers).set({ share: 100 });
    await db.delete(pods).where(eq(pods.id, support));
    const before = (await getPodPage("roadmap-2"))!.members;

    await seedRoster(db);
    await seedRoster(db);

    expect((await getPodPage("support"))!.members.map((m) => m.name)).toEqual([
      "Shadab Anjum",
      "Nanagoud",
      "Shashwat Mohite",
    ]);
    expect(await shares("Shadab Anjum")).toEqual([
      ["Velocity", 50],
      ["Support", 50],
    ]);
    expect((await getPodPage("roadmap-2"))!.members).toEqual(before);
  });
});

describe("someone in two pods", () => {
  it("brings each pod their share of their capacity, so the pods never count them twice", async () => {
    await runSync(jira.make);
    const velocity = (await sheet("velocity")).sheet;
    const support = (await sheet("support")).sheet;
    const capacity = (s: typeof velocity, name: string) => s.people.find((p) => p.name === name)!.capacity;

    for (const s of [velocity, support]) {
      expect(capacity(s, "Shadab Anjum")).toBe(3.5);
      expect(capacity(s, "Nanagoud")).toBe(3.5);
    }
    expect(capacity(support, "Shashwat Mohite")).toBe(7);
    // Rahul 7 and half of Nanagoud.
    expect(velocity.skills.find((k) => k.skill === "BE")).toMatchObject({ people: 2, capacity: 10.5 });
    expect(support.skills.find((k) => k.skill === "DevOps")).toMatchObject({ people: 1, capacity: 7 });
  });

  it("has their tickets counted in the pod the POD field names", async () => {
    plan("DTP-163", VELOCITY, [shadab()], { [FE_DAYS]: 2 });
    plan("DTP-1313", SUPPORT, [shadab(), NANAGOUD], { [FE_DAYS]: 1, [BE_DAYS]: 3 });
    await runSync(jira.make);

    const velocity = await sheet("velocity");
    const support = await sheet("support");
    expect(velocity.view.tickets.map((t) => t.key)).toContain("DTP-163");
    expect(velocity.view.tickets.map((t) => t.key)).not.toContain("DTP-1313");
    expect(support.view.tickets.map((t) => t.key)).toEqual(["DTP-1313"]);

    // Each pod sees only the load of its own tickets, against its share of them.
    const load = (s: typeof velocity) => s.sheet.load.people.find((p) => p.name === "Shadab Anjum")!;
    expect(load(velocity)).toMatchObject({ skillDays: 2, capacity: 3.5, free: 1.5 });
    expect(load(support)).toMatchObject({ skillDays: 1, capacity: 3.5, free: 2.5 });
    // Someone in both pods is no cross-pod help in either.
    expect(support.sheet.load.tickets[0].crossPod).toEqual([]);
  });

  it("has leave the lead of either pod sets, which counts in both", async () => {
    await runSync(jira.make);
    const rahul = (await viewerForEmail("rahul@delightree.com"))!;
    await setLeave(rahul, (await member("velocity", "Nanagoud")).id, OCT_SPRINT_2.id, 2);
    expect((await sheet("support")).sheet.people.find((p) => p.name === "Nanagoud")).toMatchObject({
      leave: 2,
      capacity: 2.8,
    });
    // Aman leads neither of Nanagoud's pods.
    await expect(setLeave(aman, (await member("velocity", "Nanagoud")).id, OCT_SPRINT_2.id, 1)).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("shared membership in settings", () => {
  it("adds someone to a second pod with half their time in each, then lets the admin set the split", async () => {
    const mayank = await member("roadmap-2", "Mayank Awasthi");
    const support = (await getPodPage("support"))!.pod.id;
    await addToPod(aman, mayank.id, support);
    expect(await shares("Mayank Awasthi")).toEqual([
      ["RoadMap 2", 50],
      ["Support", 50],
    ]);

    await setShare(aman, mayank.id, support, 30);
    expect(await shares("Mayank Awasthi")).toEqual([
      ["RoadMap 2", 70],
      ["Support", 30],
    ]);
    await expect(setShare(aman, mayank.id, support, 100)).rejects.toThrow(ValidationError);
    await expect(addToPod(aman, mayank.id, (await getPodPage("atlas"))!.pod.id)).rejects.toThrow("already in two pods");
  });

  it("gives the other pod all of their time when they leave one, and refuses a split for someone in one pod", async () => {
    const nanagoud = await member("support", "Nanagoud");
    await removePerson(aman, nanagoud.id, (await getPodPage("support"))!.pod.id);
    expect(await shares("Nanagoud")).toEqual([["Velocity", 100]]);
    await expect(setShare(aman, nanagoud.id, (await getPodPage("velocity"))!.pod.id, 50)).rejects.toThrow(
      ValidationError,
    );
  });

  it("keeps Shadab in the pod he leads, but not in Velocity", async () => {
    const shadab = await member("support", "Shadab Anjum");
    await expect(removePerson(aman, shadab.id, (await getPodPage("support"))!.pod.id)).rejects.toThrow("leads Support");
    await removePerson(aman, shadab.id, (await getPodPage("velocity"))!.pod.id);
    expect(await shares("Shadab Anjum")).toEqual([["Support", 100]]);
  });
});
