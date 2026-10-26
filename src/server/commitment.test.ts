import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import { getCapacitySheet } from "./capacity";
import { getPodPage } from "./pods";
import { saveJiraSettings } from "./settings";
import { getSprintView } from "./sprints";
import { runSync } from "./sync";
import { viewerForEmail } from "./viewer";

const site = "https://delightree.atlassian.net";
const FE_DAYS = "customfield_11525";
const BE_DAYS = "customfield_11524";
const OCT_SPRINT_2 = dtpSprints.values.find((s) => s.id === 432);

let jira: ReturnType<typeof fakeJira>;
beforeEach(async () => {
  await resetDb();
  const aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
});

/** Puts a DTP ticket in RoadMap 2's Oct Spint 2 with the given Jira fields. */
function plan(key: string, fields: Record<string, unknown> = {}) {
  Object.assign(jira.issue(key).fields, {
    customfield_11457: { value: "RoadMap 2-Aman", id: "11232" },
    customfield_10020: [OCT_SPRINT_2],
    ...fields,
  });
}

// RoadMap 2 in Oct Spint 2, with no leave: FE 14, BE 7, Data 7, AI 7 days.
async function commitment() {
  await runSync(jira.make);
  const page = (await getPodPage("roadmap-2"))!;
  const view = await getSprintView(page.pod.jiraPodOptionId, "432");
  return (await getCapacitySheet(page, view.sprint!, view.tickets)).commitment;
}

const skill = (c: Awaited<ReturnType<typeof commitment>>, name: string) => c.skills.find((k) => k.skill === name)!;

describe("committed vs capacity", () => {
  it("sums the FE Days and BE Days of the pod's plannable tickets in the sprint", async () => {
    plan("DTP-163", { [FE_DAYS]: 3, [BE_DAYS]: 2.5 });
    plan("DTP-1313", { [FE_DAYS]: 4 });
    // Another pod's ticket, a ticket in no sprint and a sub-task do not count.
    jira.issue("DTP-4625").fields[FE_DAYS] = 20;
    jira.issue("DTP-4841").fields[FE_DAYS] = 20;
    plan("DTP-4824", { [FE_DAYS]: 20 });

    const c = await commitment();
    expect(skill(c, "FE")).toEqual({ skill: "FE", capacity: 14, committed: 7, notEstimated: 0, over: 0 });
    expect(skill(c, "BE")).toEqual({ skill: "BE", capacity: 7, committed: 2.5, notEstimated: 1, over: 0 });
  });

  it("shows the gap in days for an overloaded skill", async () => {
    plan("DTP-163", { [BE_DAYS]: 6 });
    plan("DTP-1313", { [BE_DAYS]: 3.5 });
    expect(skill(await commitment(), "BE")).toMatchObject({ capacity: 7, committed: 9.5, over: 2.5 });
  });

  it("shows a skill as not estimated, never zero, when its field is empty or not in Jira yet", async () => {
    plan("DTP-163", { [FE_DAYS]: 3 });
    plan("DTP-1313");
    const c = await commitment();
    // DTP-1313 has no FE Days; there is no Data Days field at all.
    expect(skill(c, "FE")).toMatchObject({ committed: 3, notEstimated: 1 });
    expect(skill(c, "Data")).toMatchObject({ committed: null, notEstimated: 2, over: 0 });
  });

  it("counts an estimate of 0 as estimated", async () => {
    plan("DTP-163", { [FE_DAYS]: 0 });
    const c = await commitment();
    expect(skill(c, "FE")).toMatchObject({ committed: 0, notEstimated: 0 });
    expect(c.unestimated).toEqual([]);
  });

  it("finds estimate fields by name, so Data Days and AI Days count once the Jira admin adds them", async () => {
    jira.fields.push(
      { id: "customfield_11600", name: "Data Days", custom: true, schema: { type: "number" } },
      // A field with the right name but the wrong type is not an estimate.
      { id: "customfield_11601", name: "AI Days", custom: true, schema: { type: "string" } },
    );
    plan("DTP-163", { customfield_11600: 8, customfield_11601: "5" });
    const c = await commitment();
    expect(skill(c, "Data")).toMatchObject({ capacity: 7, committed: 8, over: 1 });
    expect(skill(c, "AI")).toMatchObject({ committed: null, notEstimated: 1 });
  });

  it("counts bugs like stories", async () => {
    plan("DTP-163", { [FE_DAYS]: 2, issuetype: { id: "10004", name: "Bug", subtask: false } });
    plan("DTP-1313", { [FE_DAYS]: 1, issuetype: { id: "10120", name: "Prod Bug", subtask: false } });
    expect(skill(await commitment(), "FE")).toMatchObject({ committed: 3, notEstimated: 0 });
  });

  it("lists the sprint's tickets with no estimates at all, linked to Jira", async () => {
    plan("DTP-163", { [BE_DAYS]: 1 });
    plan("DTP-1313");
    plan("DTP-4841");
    const c = await commitment();
    expect(c.unestimated.map((t) => [t.key, t.url])).toEqual([
      ["DTP-1313", `${site}/browse/DTP-1313`],
      ["DTP-4841", `${site}/browse/DTP-4841`],
    ]);
  });
});
