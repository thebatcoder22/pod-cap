import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import type { JiraUser } from "@/db/schema";
import type { JiraIssue } from "./jira-client";
import { getCapacitySheet } from "./capacity";
import { setProficiency } from "./people";
import { getPickUp } from "./pick-up";
import { getPodPage } from "./pods";
import { saveJiraSettings } from "./settings";
import { getSprintView } from "./sprints";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const FE_DAYS = "customfield_11525";
const BE_DAYS = "customfield_11524";
const DATA_DAYS = "customfield_11602";
const POD = "customfield_11457";
const SPRINT = "customfield_10020";
const DEV_OWNERS = "customfield_10777";
const OCT_SPRINT_2 = dtpSprints.values.find((s) => s.id === 432);
const ABC_SPRINT = dtpSprints.values.find((s) => s.id === 332);

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
  jira.fields.push({ id: DATA_DAYS, name: "Data Eng Days", custom: true, schema: { type: "number" } });
});

/** A new DTP ticket, in RoadMap 2's backlog unless the fields say otherwise. */
function ticket(key: string, fields: Record<string, unknown>) {
  const issue = structuredClone(jira.issue("DTP-4841")) as JiraIssue;
  issue.key = key;
  Object.assign(issue.fields, { summary: `Work for ${key}`, ...fields });
  jira.issues.push(issue);
}

const priority = (name: string) => ({ priority: { name } });
const status = (name: string, key: string) => ({ status: { name, statusCategory: { key } } });
/** A Jira user as DTP serves them. People the fixtures do not know get a made-up account, matched by name. */
function user(name: string): JiraUser {
  const known = jira.issues.flatMap((i) => [i.fields.assignee, ...((i.fields[DEV_OWNERS] ?? []) as JiraUser[])]);
  return (
    (known as (JiraUser | null)[]).find((u) => u?.displayName === name) ?? { accountId: `a-${name}`, displayName: name }
  );
}

/** Puts a ticket in Oct Spint 2, for the given owner. */
const inSprint = (owner: string) => ({ [SPRINT]: [OCT_SPRINT_2], [DEV_OWNERS]: [user(owner)] });

// RoadMap 2 in Oct Spint 2, with no leave: 7 days of capacity each.
async function pickUp(slug = "roadmap-2") {
  await runSync(jira.make);
  const page = (await getPodPage(slug))!;
  const view = await getSprintView(page.pod.jiraPodOptionId, "432");
  const sheet = await getCapacitySheet(page, view.sprint!, view.tickets);
  return getPickUp(page, view.sprint!, sheet);
}

type PickUp = Awaited<ReturnType<typeof pickUp>>;
const person = (p: PickUp, name: string) => p.people.find((x) => x.name === name);
const keys = (p: PickUp, name: string) => person(p, name)!.suggestions.map((s) => s.key);
const personId = async (name: string) => (await getPodPage("roadmap-2"))!.members.find((m) => m.name === name)!.id;

describe("pick-up panel", () => {
  it("lists people with free days, and backlog tickets in their main skill that fit, by Jira priority", async () => {
    ticket("DTP-5001", { [FE_DAYS]: 3, ...priority("High") });
    ticket("DTP-5002", { [FE_DAYS]: 2, ...priority("Medium") });
    ticket("DTP-5003", { [FE_DAYS]: 1, ...priority("Highest"), issuetype: { name: "Bug", subtask: false } });
    ticket("DTP-5004", { [FE_DAYS]: 1, ...priority("Low") });
    // Too big for anyone's 7 days, and work in two skills, are never a natural fit for one person.
    ticket("DTP-5005", { [FE_DAYS]: 8 });
    ticket("DTP-5006", { [FE_DAYS]: 1, [BE_DAYS]: 1 });
    // Not backlog: in a future sprint, done, or another pod's. Not estimated: nothing to fit.
    ticket("DTP-5007", { [FE_DAYS]: 1, [SPRINT]: [OCT_SPRINT_2] });
    ticket("DTP-5008", { [FE_DAYS]: 1, ...status("Done", "done") });
    ticket("DTP-5009", { [FE_DAYS]: 1, [POD]: { value: "Velocity", id: "11230" } });
    ticket("DTP-5010", {});
    // Carried out of a closed sprint, so it is back in the backlog.
    ticket("DTP-5011", { [FE_DAYS]: 1.5, [SPRINT]: [ABC_SPRINT] });

    const p = await pickUp();
    expect(person(p, "Mayank Awasthi")).toMatchObject({ free: 7, mainSkill: "FE" });
    expect(keys(p, "Mayank Awasthi")).toEqual(["DTP-5003", "DTP-5001", "DTP-5011", "DTP-5002", "DTP-5004"]);
    expect(person(p, "Mayank Awasthi")!.suggestions[1]).toMatchObject({
      key: "DTP-5001",
      url: "https://delightree.atlassian.net/browse/DTP-5001",
      skill: "FE",
      days: 3,
      cost: 3,
      stretch: false,
    });
    expect(keys(p, "Aman Tyagi")).toEqual([]);
  });

  it("only suggests what fits a person's free days, and leaves out people with none", async () => {
    ticket("DTP-5001", { [FE_DAYS]: 3 });
    ticket("DTP-5002", { [FE_DAYS]: 2 });
    ticket("DTP-5003", { [FE_DAYS]: 5, ...inSprint("Mayank Awasthi") });
    ticket("DTP-5004", { [FE_DAYS]: 7, ...inSprint("Muthaiyan Mani") });
    const p = await pickUp();
    expect(person(p, "Mayank Awasthi")).toMatchObject({ free: 2 });
    expect(keys(p, "Mayank Awasthi")).toEqual(["DTP-5002"]);
    expect(person(p, "Muthaiyan Mani")).toBeUndefined();
  });

  it("offers clearly labeled stretch options after exact matches, costed through proficiency", async () => {
    await setProficiency(aman, await personId("Kalpan Punamiya"), "FE", 45);
    ticket("DTP-5001", { [FE_DAYS]: 3, ...priority("Highest") });
    ticket("DTP-5002", { [FE_DAYS]: 4 });
    ticket("DTP-5003", { [DATA_DAYS]: 2, ...priority("Low") });
    ticket("DTP-5004", { [BE_DAYS]: 1 });

    const p = await pickUp();
    // 4 FE days at 45% take 8.89 calendar days, more than Kalpan's 7.
    expect(person(p, "Kalpan Punamiya")!.suggestions).toMatchObject([
      { key: "DTP-5003", skill: "Data", cost: 2, stretch: false },
      { key: "DTP-5001", skill: "FE", days: 3, cost: 6.67, stretch: true },
    ]);
    // Mayank has 0% in BE and Data.
    expect(keys(p, "Mayank Awasthi")).toEqual(["DTP-5001", "DTP-5002"]);
  });

  it("orders by smallest cost when priorities tie", async () => {
    await setProficiency(aman, await personId("Mayank Awasthi"), "BE", 50);
    ticket("DTP-5001", { [FE_DAYS]: 3 });
    ticket("DTP-5002", { [BE_DAYS]: 1 });
    ticket("DTP-5003", { [FE_DAYS]: 1 });
    ticket("DTP-5004", { [FE_DAYS]: 2, priority: null });
    const p = await pickUp();
    expect(keys(p, "Mayank Awasthi")).toEqual(["DTP-5003", "DTP-5001", "DTP-5004", "DTP-5002"]);
  });

  it("shows who in the pod could cover an overloaded skill as a stretch, and how much", async () => {
    await setProficiency(aman, await personId("Mayank Awasthi"), "BE", 50);
    await setProficiency(aman, await personId("Kalpan Punamiya"), "BE", 20);
    ticket("DTP-5001", { [BE_DAYS]: 10, ...inSprint("Aman Tyagi") });
    ticket("DTP-5002", { [FE_DAYS]: 5, ...inSprint("Mayank Awasthi") });

    const p = await pickUp();
    expect(p.short.map((s) => [s.skill, s.over])).toEqual([["BE", 3]]);
    expect(p.short[0].cover.map((c) => [c.name, c.absorb])).toEqual([
      ["Kalpan Punamiya", 1.4],
      ["Mayank Awasthi", 1],
    ]);
  });

  it("caps what someone could absorb at the gap", async () => {
    await setProficiency(aman, await personId("Mayank Awasthi"), "BE", 50);
    ticket("DTP-5001", { [BE_DAYS]: 8, ...inSprint("Aman Tyagi") });
    expect((await pickUp()).short[0].cover).toMatchObject([{ name: "Mayank Awasthi", absorb: 1 }]);
  });

  it("hints at other pods' free main-skill capacity for the skills this pod is short on", async () => {
    ticket("DTP-5001", { [BE_DAYS]: 10, ...inSprint("Aman Tyagi") });
    // Velocity's BE: 14 days, 10 committed.
    ticket("DTP-5002", { [BE_DAYS]: 10, [POD]: { value: "Velocity", id: "11230" }, [SPRINT]: [OCT_SPRINT_2] });

    const p = await pickUp();
    expect(p.short[0].elsewhere).toEqual([
      { pod: "Atlas", slug: "atlas", free: 14 },
      { pod: "RoadMap 1", slug: "roadmap-1", free: 7 },
      // Nanagoud's 7 BE days split between his two pods.
      { pod: "Support", slug: "support", free: 3.5 },
      { pod: "Velocity", slug: "velocity", free: 0.5 },
    ]);
  });
});
