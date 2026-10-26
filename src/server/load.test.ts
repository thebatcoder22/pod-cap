import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import type { JiraUser } from "@/db/schema";
import { getCapacitySheet } from "./capacity";
import { setProficiency } from "./people";
import { getPodPage } from "./pods";
import { saveJiraSettings } from "./settings";
import { getSprintView } from "./sprints";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const FE_DAYS = "customfield_11525";
const BE_DAYS = "customfield_11524";
const DEV_OWNERS = "customfield_10777";
const OCT_SPRINT_2 = dtpSprints.values.find((s) => s.id === 432);

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
});

/** A Jira user as DTP serves them. People the fixtures do not know get a made-up account, matched by name. */
function user(name: string): JiraUser {
  const known = jira.issues.flatMap((i) => [i.fields.assignee, ...((i.fields[DEV_OWNERS] ?? []) as JiraUser[])]);
  return (
    (known as (JiraUser | null)[]).find((u) => u?.displayName === name) ?? { accountId: `a-${name}`, displayName: name }
  );
}

/** Puts a DTP ticket in RoadMap 2's Oct Spint 2 with the given owners and Jira fields. */
function plan(key: string, devOwners: string[], fields: Record<string, unknown> = {}) {
  Object.assign(jira.issue(key).fields, {
    customfield_11457: { value: "RoadMap 2-Aman", id: "11232" },
    customfield_10020: [OCT_SPRINT_2],
    assignee: null,
    [DEV_OWNERS]: devOwners.map(user),
    ...fields,
  });
}

// RoadMap 2 in Oct Spint 2, with no leave: 7 days of capacity each.
async function load() {
  await runSync(jira.make);
  const page = (await getPodPage("roadmap-2"))!;
  const view = await getSprintView(page.pod.jiraPodOptionId, "432");
  return (await getCapacitySheet(page, view.sprint!, view.tickets)).load;
}

type Load = Awaited<ReturnType<typeof load>>;
const person = (l: Load, name: string) => l.people.find((p) => p.name === name)!;
const ticket = (l: Load, key: string) => l.tickets.find((t) => t.key === key)!;
const personId = async (name: string) => (await getPodPage("roadmap-2"))!.members.find((m) => m.name === name)!.id;

describe("who is working on what", () => {
  it("splits a ticket's skill-days evenly between the Dev Owners who have the skill", async () => {
    plan("DTP-163", ["Mayank Awasthi", "Muthaiyan Mani", "Aman Tyagi"], { [FE_DAYS]: 4, [BE_DAYS]: 3 });
    const l = await load();
    expect(person(l, "Mayank Awasthi")).toMatchObject({ skillDays: 2, calendarDays: 2, capacity: 7, free: 5 });
    expect(person(l, "Muthaiyan Mani")).toMatchObject({ skillDays: 2, calendarDays: 2, free: 5 });
    // Aman has no FE, so only the BE days are his.
    expect(person(l, "Aman Tyagi")).toMatchObject({ skillDays: 3, calendarDays: 3, free: 4 });
    expect(person(l, "Akash Singh")).toMatchObject({ skillDays: 0, calendarDays: 0, free: 7, tickets: [] });
    expect(l.unassigned).toBe(0);
  });

  it("counts an owner Jira lists twice once", async () => {
    plan("DTP-163", ["Mayank Awasthi", "Mayank Awasthi", "Muthaiyan Mani"], { [FE_DAYS]: 3 });
    const l = await load();
    expect(person(l, "Mayank Awasthi")).toMatchObject({ skillDays: 1.5 });
    expect(person(l, "Mayank Awasthi").tickets).toHaveLength(1);
    expect(person(l, "Muthaiyan Mani")).toMatchObject({ skillDays: 1.5 });
  });

  it("uses the assignee when Dev Owners is empty", async () => {
    plan("DTP-163", [], { [FE_DAYS]: 2, assignee: user("Mayank Awasthi") });
    expect(person(await load(), "Mayank Awasthi")).toMatchObject({ skillDays: 2 });
  });

  it("ignores the assignee when there are Dev Owners", async () => {
    plan("DTP-163", ["Muthaiyan Mani"], { [FE_DAYS]: 2, assignee: user("Mayank Awasthi") });
    const l = await load();
    expect(person(l, "Muthaiyan Mani")).toMatchObject({ skillDays: 2 });
    expect(person(l, "Mayank Awasthi")).toMatchObject({ skillDays: 0, tickets: [] });
  });

  it("counts work nobody can do against the pod as unassigned, and flags it", async () => {
    // No owner at all, and AI days with only an FE owner.
    plan("DTP-163", [], { [FE_DAYS]: 2, [BE_DAYS]: 1 });
    plan("DTP-1313", ["Mayank Awasthi"], { [FE_DAYS]: 3, customfield_11601: 4 });
    jira.fields.push({ id: "customfield_11601", name: "AI Days", custom: true, schema: { type: "number" } });
    const l = await load();
    expect(ticket(l, "DTP-163").unassigned).toEqual({ FE: 2, BE: 1 });
    expect(ticket(l, "DTP-1313").unassigned).toEqual({ AI: 4 });
    expect(person(l, "Mayank Awasthi")).toMatchObject({ skillDays: 3 });
    expect(l.unassigned).toBe(7);
  });

  it("does not attribute skill-days to an owner who is in no pod", async () => {
    // Praveen Singh has left; he is in no pod, so nobody has his proficiency.
    plan("DTP-163", ["Praveen Singh"], { [FE_DAYS]: 2 });
    expect(ticket(await load(), "DTP-163").unassigned).toEqual({ FE: 2 });
  });

  it("costs work outside the main skill in calendar days, and lets free days go negative", async () => {
    await setProficiency(aman, await personId("Kalpan Punamiya"), "FE", 45);
    plan("DTP-163", ["Kalpan Punamiya"], { [FE_DAYS]: 4.5 });
    expect(person(await load(), "Kalpan Punamiya")).toMatchObject({
      skillDays: 4.5,
      calendarDays: 10,
      capacity: 7,
      free: -3,
    });
  });

  it("lists a person's sprint tickets with status and the skill-days attributed to them", async () => {
    plan("DTP-163", ["Mayank Awasthi", "Muthaiyan Mani"], { [FE_DAYS]: 3 });
    // An owner of a ticket with no estimate still has it on their list.
    plan("DTP-1313", ["Mayank Awasthi"]);
    const tickets = person(await load(), "Mayank Awasthi").tickets;
    expect(tickets.map((t) => [t.key, t.status, t.attributed])).toEqual([
      ["DTP-163", "Done", { FE: 1.5 }],
      ["DTP-1313", "Done", {}],
    ]);
  });

  it("shows Dev Owners from other pods as cross-pod help, sharing the work", async () => {
    plan("DTP-163", ["Mayank Awasthi", "Manish Bisht", "Praveen Singh"], { [FE_DAYS]: 4 });
    const l = await load();
    expect(ticket(l, "DTP-163").crossPod.map((o) => [o.displayName, o.pod])).toEqual([["Manish Bisht", "Velocity"]]);
    expect(ticket(l, "DTP-163").unassigned).toEqual({});
    expect(person(l, "Mayank Awasthi")).toMatchObject({ skillDays: 2 });
    expect(l.people.map((p) => p.name)).not.toContain("Manish Bisht");
  });
});
