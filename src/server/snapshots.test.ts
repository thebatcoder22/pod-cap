import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import { setLeave } from "./capacity";
import { ForbiddenError } from "./permissions";
import { getPodPage } from "./pods";
import { saveJiraSettings, ValidationError } from "./settings";
import { getTrends, takeSnapshot } from "./snapshots";
import { getSyncStatus, runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const FE_DAYS = "customfield_11525";
const BE_DAYS = "customfield_11524";
const OCT_SPRINT_2 = 432;
const ABC_SPRINT = dtpSprints.values.find((s) => s.name === "ABC sprint")!.id;

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
let rahul: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  rahul = (await viewerForEmail("rahul@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
});

/** Puts a DTP ticket in RoadMap 2's Oct Spint 2 with the given Jira fields. */
function plan(key: string, fields: Record<string, unknown> = {}) {
  Object.assign(jira.issue(key).fields, {
    customfield_11457: { value: "RoadMap 2", id: "11232" },
    customfield_10020: [jira.sprints.find((s) => s.id === OCT_SPRINT_2)],
    ...fields,
  });
}

const done = { name: "Done", statusCategory: { key: "done" } };
const inDev = { name: "In-Dev", statusCategory: { key: "indeterminate" } };

/** Moves a sprint to a new state in Jira. */
const setState = (id: number, state: "active" | "closed") => (jira.sprints.find((s) => s.id === id)!.state = state);

const trend = async (slug: string, sprintId: number) =>
  (await getTrends((await getPodPage(slug))!.pod.id)).find((t) => t.sprint.id === sprintId);
const skill = (t: Awaited<ReturnType<typeof trend>>, name: string) => t!.skills.find((k) => k.skill === name)!;

describe("snapshots", () => {
  it("writes a start snapshot per pod and skill when Oct Spint 2 goes active", async () => {
    plan("DTP-163", { [FE_DAYS]: 3, [BE_DAYS]: 2.5 });
    plan("DTP-1313", { [FE_DAYS]: 4 });
    await runSync(jira.make);
    expect(await trend("roadmap-2", OCT_SPRINT_2)).toBeUndefined();

    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);

    const t = await trend("roadmap-2", OCT_SPRINT_2);
    expect(t).toMatchObject({ sprint: { name: "Oct Spint 2", state: "active" }, startedAt: expect.any(Date) });
    expect(t!.closedAt).toBeNull();
    // RoadMap 2 with no leave: FE 14, BE 7, Data 7, AI 7 days.
    expect(t!.skills).toMatchObject([
      { skill: "FE", capacity: 14, committed: 7, completed: null },
      { skill: "BE", capacity: 7, committed: 2.5, completed: null },
      // Nothing estimated reads as not estimated, never 0.
      { skill: "Data", capacity: 7, committed: null, completed: null },
      { skill: "AI", capacity: 7, committed: null, completed: null },
    ]);
    // Every pod gets one, not only the pods with tickets.
    expect(skill(await trend("velocity", OCT_SPRINT_2), "BE")).toMatchObject({ capacity: 14 });
  });

  it("keeps the commitment frozen when Jira changes after the sprint started", async () => {
    plan("DTP-163", { [FE_DAYS]: 3 });
    await runSync(jira.make);
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);

    jira.issue("DTP-163").fields[FE_DAYS] = 10;
    await runSync(jira.make);
    expect(skill(await trend("roadmap-2", OCT_SPRINT_2), "FE")).toMatchObject({ committed: 3 });
  });

  it("writes a start snapshot for a sprint created and started between two syncs", async () => {
    await runSync(jira.make);
    jira.sprints.push({
      ...jira.sprints.find((s) => s.id === OCT_SPRINT_2)!,
      id: 500,
      name: "Nov Sprint 1",
      state: "active",
    });
    await runSync(jira.make);
    expect(await trend("roadmap-2", 500)).toMatchObject({ sprint: { name: "Nov Sprint 1", state: "active" } });
  });

  it("keeps a sprint's history after Jira removes it from the board", async () => {
    await runSync(jira.make);
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);
    jira.sprints = jira.sprints.filter((s) => s.id !== OCT_SPRINT_2);
    await runSync(jira.make);
    const t = await trend("roadmap-2", OCT_SPRINT_2);
    expect(t).toMatchObject({ sprint: { name: "Oct Spint 2", state: null, startDate: expect.any(Date) } });
    expect(skill(t, "FE")).toMatchObject({ capacity: 14 });
  });

  it("totals the skills and flags over-commitment", async () => {
    plan("DTP-163", { [BE_DAYS]: 9 });
    await runSync(jira.make);
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);
    const t = await trend("roadmap-2", OCT_SPRINT_2);
    expect(skill(t, "BE")).toMatchObject({ committed: 9, over: 2 });
    expect(skill(t, "FE")).toMatchObject({ committed: null, over: null });
    expect(t!.total).toEqual({ capacity: 35, committed: 9, completed: null, over: null, donePercent: null });
  });

  it("writes nothing on the first sync, which has no earlier state to compare against", async () => {
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);
    expect(await getTrends((await getPodPage("roadmap-2"))!.pod.id)).toEqual([]);
  });

  it("records completed skill-days, from tickets Done in Jira, when the sprint closes", async () => {
    plan("DTP-163", { [FE_DAYS]: 3, [BE_DAYS]: 2.5, status: inDev });
    plan("DTP-1313", { [FE_DAYS]: 4, status: inDev });
    await runSync(jira.make);
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);

    jira.issue("DTP-163").fields.status = done;
    setState(OCT_SPRINT_2, "closed");
    await runSync(jira.make);

    const t = await trend("roadmap-2", OCT_SPRINT_2);
    expect(t).toMatchObject({ sprint: { state: "closed" }, startedAt: expect.any(Date), closedAt: expect.any(Date) });
    expect(t!.skills.slice(0, 3)).toMatchObject([
      // Capacity and committed stay as they were at the start.
      { skill: "FE", capacity: 14, committed: 7, completed: 3, donePercent: 43 },
      { skill: "BE", capacity: 7, committed: 2.5, completed: 2.5, donePercent: 100 },
      { skill: "Data", capacity: 7, committed: null, completed: null },
    ]);
  });

  it("lets the admin take or retake a snapshot, overwriting the earlier one", async () => {
    plan("DTP-163", { [FE_DAYS]: 3 });
    await runSync(jira.make);
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);
    const roadmap2 = (await getPodPage("roadmap-2"))!;

    // Mayank takes 2 days off, and the estimate grows.
    await setLeave(aman, roadmap2.members.find((m) => m.name === "Mayank Awasthi")!.id, OCT_SPRINT_2, 2);
    jira.issue("DTP-163").fields[FE_DAYS] = 5;
    await runSync(jira.make);
    await takeSnapshot(aman, roadmap2.pod.id, OCT_SPRINT_2, "start");
    expect(skill(await trend("roadmap-2", OCT_SPRINT_2), "FE")).toMatchObject({ capacity: 12.6, committed: 5 });
    // Only that pod's snapshot is retaken.
    expect(skill(await trend("velocity", OCT_SPRINT_2), "FE")).toMatchObject({ capacity: 21 });
  });

  it("lets the admin take a close snapshot of a sprint a missed sync never saw close", async () => {
    // ABC sprint closed before the platform's first sync.
    await runSync(jira.make);
    const roadmap2 = (await getPodPage("roadmap-2"))!.pod.id;
    await takeSnapshot(aman, roadmap2, ABC_SPRINT, "close");
    expect(await trend("roadmap-2", ABC_SPRINT)).toMatchObject({ startedAt: null, closedAt: expect.any(Date) });
  });

  it("refuses snapshots from anyone but the admin, and ones that do not fit the sprint's state", async () => {
    await runSync(jira.make);
    const roadmap2 = (await getPodPage("roadmap-2"))!.pod.id;
    await expect(takeSnapshot(rahul, roadmap2, ABC_SPRINT, "start")).rejects.toThrow(ForbiddenError);
    await expect(takeSnapshot(null, roadmap2, ABC_SPRINT, "start")).rejects.toThrow(ForbiddenError);
    // Oct Spint 2 has not started yet, so it has neither.
    await expect(takeSnapshot(aman, roadmap2, OCT_SPRINT_2, "start")).rejects.toThrow(ValidationError);
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);
    await expect(takeSnapshot(aman, roadmap2, OCT_SPRINT_2, "close")).rejects.toThrow(ValidationError);
    await expect(takeSnapshot(aman, roadmap2, 999, "start")).rejects.toThrow(ValidationError);
    await expect(takeSnapshot(aman, 999, ABC_SPRINT, "start")).rejects.toThrow(ValidationError);
  });

  it("lists a pod's sprints with snapshots, latest first", async () => {
    await runSync(jira.make);
    const roadmap2 = (await getPodPage("roadmap-2"))!.pod.id;
    await takeSnapshot(aman, roadmap2, ABC_SPRINT, "close");
    setState(OCT_SPRINT_2, "active");
    await runSync(jira.make);
    expect((await getTrends(roadmap2)).map((t) => t.sprint.name)).toEqual(["Oct Spint 2", "ABC sprint"]);
    expect((await getSyncStatus()).failure).toBeNull();
  });
});
