import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import { getCapacitySheet } from "./capacity";
import { addManualItem, deleteManualItem, updateManualItem, type ManualItemInput } from "./manual-items";
import { movePerson, setProficiency } from "./people";
import { getPodPage } from "./pods";
import { saveJiraSettings } from "./settings";
import { getSprintView } from "./sprints";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const FE_DAYS = "customfield_11525";
const OCT_SPRINT_2 = dtpSprints.values.find((s) => s.id === 432);

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
let rahul: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  rahul = (await viewerForEmail("rahul@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
  await runSync(jira.make);
});

// RoadMap 2 in Oct Spint 2, with no leave: 7 days of capacity each.
async function sheet(slug = "roadmap-2") {
  const page = (await getPodPage(slug))!;
  const view = await getSprintView(page.pod.jiraPodOptionId, "432");
  return getCapacitySheet(page, view.sprint!, view.tickets);
}

const personId = async (name: string, slug = "roadmap-2") =>
  (await getPodPage(slug))!.members.find((m) => m.name === name)!.id;
const roadmap2 = async () => (await getPodPage("roadmap-2"))!.pod.id;

async function item(input: Partial<ManualItemInput & { sprintId: number }> = {}) {
  return addManualItem(aman, {
    podId: await roadmap2(),
    sprintId: 432,
    kind: "work",
    title: "Support rotation",
    personId: null,
    skill: "FE",
    days: 2,
    jiraKey: null,
    ...input,
  });
}

const committed = (s: Awaited<ReturnType<typeof sheet>>, skill: string) =>
  s.commitment.skills.find((k) => k.skill === skill)!.committed;
const person = (s: Awaited<ReturnType<typeof sheet>>, name: string) => s.load.people.find((p) => p.name === name)!;

describe("manual items", () => {
  it("counts non-Jira work toward the pod's committed skill-days and the person's load", async () => {
    await item({ title: "Interviews", personId: await personId("Mayank Awasthi"), days: 1.5 });
    await item({ title: "Support rotation", skill: "BE", days: 2 });
    const s = await sheet();
    expect(committed(s, "FE")).toBe(1.5);
    expect(committed(s, "BE")).toBe(2);
    expect(person(s, "Mayank Awasthi")).toMatchObject({ skillDays: 1.5, calendarDays: 1.5, free: 5.5 });
    expect(person(s, "Mayank Awasthi").items.map((i) => i.title)).toEqual(["Interviews"]);
    // Work with no person counts against the pod but nobody in it, and is no flag: the lead chose that.
    expect(s.load.unassigned).toBe(0);
    expect(s.items.map((i) => [i.title, i.counts])).toEqual([
      ["Interviews", true],
      ["Support rotation", true],
    ]);
  });

  it("costs a person's item outside their main skill in calendar days", async () => {
    const kalpan = await personId("Kalpan Punamiya");
    await setProficiency(aman, kalpan, "FE", 45);
    await item({ personId: kalpan, skill: "FE", days: 4.5 });
    expect(person(await sheet(), "Kalpan Punamiya")).toMatchObject({ skillDays: 4.5, calendarDays: 10, free: -3 });
  });

  it("stops counting a placeholder once its linked ticket is synced into the sprint", async () => {
    const mayank = await personId("Mayank Awasthi");
    await item({ kind: "placeholder", title: "Onboarding flow", personId: mayank, days: 3, jiraKey: "dtp-163 " });
    let s = await sheet();
    expect(s.items[0]).toMatchObject({ jiraKey: "DTP-163", counts: true });
    expect(committed(s, "FE")).toBe(3);

    // The ticket exists now, in RoadMap 2's sprint, with its own estimate.
    Object.assign(jira.issue("DTP-163").fields, {
      customfield_11457: { value: "RoadMap 2-Aman", id: "11232" },
      customfield_10020: [OCT_SPRINT_2],
      [FE_DAYS]: 5,
    });
    await runSync(jira.make);
    s = await sheet();
    expect(s.items[0]).toMatchObject({ counts: false });
    expect(committed(s, "FE")).toBe(5);
    expect(person(s, "Mayank Awasthi").items).toEqual([]);
  });

  it("keeps counting a placeholder whose ticket is in the sprint but in no pod", async () => {
    Object.assign(jira.issue("DTP-163").fields, { customfield_10020: [OCT_SPRINT_2], [FE_DAYS]: 5 });
    await runSync(jira.make);
    await item({ kind: "placeholder", jiraKey: "DTP-163", days: 3 });
    const s = await sheet();
    expect(s.items[0]).toMatchObject({ counts: true });
    expect(committed(s, "FE")).toBe(3);
  });

  it("keeps counting a placeholder whose ticket is not in the sprint yet", async () => {
    // DTP-163 is synced, but in no sprint.
    await item({ kind: "placeholder", jiraKey: "DTP-163", days: 3 });
    expect((await sheet()).items[0]).toMatchObject({ counts: true });
  });

  it("lets a lead edit and delete their own pod's items", async () => {
    const { id } = await item();
    await updateManualItem(aman, id, {
      kind: "placeholder",
      title: "Billing revamp",
      personId: await personId("Aman Tyagi"),
      skill: "BE",
      days: 4,
      jiraKey: "DTP-9001",
    });
    let s = await sheet();
    expect(s.items).toMatchObject([{ title: "Billing revamp", kind: "placeholder", skill: "BE", jiraKey: "DTP-9001" }]);
    expect(person(s, "Aman Tyagi")).toMatchObject({ skillDays: 4 });

    await deleteManualItem(aman, id);
    s = await sheet();
    expect(s.items).toEqual([]);
    expect(committed(s, "BE")).toBeNull();
  });

  it("refuses another pod's lead on the server, for add, edit and delete", async () => {
    const { id } = await item();
    const input = { kind: "work", title: "x", personId: null, skill: "FE", days: 1, jiraKey: null } as const;
    await expect(addManualItem(rahul, { ...input, podId: await roadmap2(), sprintId: 432 })).rejects.toThrow(
      "You can only edit your own pod.",
    );
    await expect(updateManualItem(rahul, id, input)).rejects.toThrow("You can only edit your own pod.");
    await expect(deleteManualItem(rahul, id)).rejects.toThrow("You can only edit your own pod.");
    expect((await sheet()).items).toHaveLength(1);
  });

  it("only takes items that make sense", async () => {
    await expect(item({ title: "  " })).rejects.toThrow("Enter a title.");
    await expect(item({ days: 0 })).rejects.toThrow("Enter days in half days, from 0.5 to 99.5.");
    await expect(item({ days: 1.25 })).rejects.toThrow("Enter days in half days");
    await expect(item({ skill: "QA" as never })).rejects.toThrow("Pick a skill.");
    await expect(item({ kind: "meeting" as never })).rejects.toThrow("Pick non-Jira work or a placeholder.");
    await expect(item({ sprintId: 1 })).rejects.toThrow("That sprint is no longer on the board.");
    await expect(item({ jiraKey: "DTP-1" })).rejects.toThrow("Only a placeholder links to a Jira ticket.");
    await expect(item({ kind: "placeholder", jiraKey: "163" })).rejects.toThrow("Enter a DTP key, like DTP-163.");
    await expect(item({ personId: await personId("Manish Bisht", "velocity") })).rejects.toThrow(
      "Manish Bisht is not in RoadMap 2.",
    );
    // Aman has no FE.
    await expect(item({ personId: await personId("Aman Tyagi") })).rejects.toThrow("Aman Tyagi has 0% in FE.");
  });

  it("flags a person's item as unassigned once they leave the pod", async () => {
    const mayank = await personId("Mayank Awasthi");
    await item({ title: "Interviews", personId: mayank, days: 2 });
    await movePerson(aman, mayank, (await getPodPage("velocity"))!.pod.id);
    const s = await sheet();
    expect(s.load.unassigned).toBe(2);
    expect(s.load.items).toMatchObject([{ title: "Interviews", unassigned: { FE: 2 } }]);
    expect(committed(s, "FE")).toBe(2);
  });
});
