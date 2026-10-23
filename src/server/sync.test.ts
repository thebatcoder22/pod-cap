import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { syncRuns } from "@/db/schema";
import { resetDb } from "../../tests/db";
import dtpIssues from "../../tests/fixtures/dtp-issues.json";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import { JiraError, type JiraClient, type JiraIssue, type JiraSprint } from "./jira-client";
import { ForbiddenError } from "./permissions";
import { saveJiraSettings } from "./settings";
import { getSprintView } from "./sprints";
import { getSyncStatus, runSync, syncNow } from "./sync";
import { viewerForEmail } from "./viewer";

const site = "https://delightree.atlassian.net";

/** Serves what DTP served, with any edits a test makes to simulate changes in Jira. */
function fakeJira() {
  const jira = {
    sprints: structuredClone(dtpSprints.values) as JiraSprint[],
    issues: structuredClone(dtpIssues) as JiraIssue[],
    fail: null as JiraError | null,
    // Lets a test hold a sync mid-flight.
    gate: Promise.resolve(),
    searches: 0,
    issue(key: string) {
      return jira.issues.find((i) => i.key === key)!;
    },
    make: (): JiraClient => ({
      myself: async () => ({ accountId: "a1", displayName: "Aman Tyagi" }),
      getProject: async (key) => ({ key, name: "Delightree Product" }),
      listSprints: async () => {
        if (jira.fail) throw jira.fail;
        return structuredClone(jira.sprints);
      },
      searchIssues: async () => {
        jira.searches++;
        await jira.gate;
        return structuredClone(jira.issues);
      },
    }),
  };
  return jira;
}

const keys = async (pod: string, sprint?: string) => (await getSprintView(pod, sprint)).tickets.map((t) => t.key);

beforeEach(async () => {
  await resetDb();
  const aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "t" });
});

describe("Jira sync", () => {
  it("pulls the board's sprints and shows a pod its plannable tickets, linked to Jira", async () => {
    expect(await runSync(fakeJira().make)).toEqual({ status: "succeeded" });

    const view = await getSprintView("RoadMap 1");
    expect(view.sprints.map((s) => s.name)).toEqual([
      "Oct Spint 2",
      "ABC sprint",
      "DTP Q2 Sprint 3",
      "DTP April Sprint",
      "DTP Mar Sprint 2",
      "DTP Jan Sprint",
    ]);
    expect(view.sprint).toMatchObject({ id: 432, name: "Oct Spint 2", state: "future" });
    expect(view.tickets).toEqual([
      {
        key: "DTP-4820",
        url: `${site}/browse/DTP-4820`,
        summary: "Assigned to me Views",
        type: "Story",
        status: "To Do",
        statusCategory: "new",
        priority: "Medium",
        assignee: null,
        devOwners: [],
        owners: [],
        epic: { key: "DTP-4819", summary: "Assigned to me Views", url: `${site}/browse/DTP-4819` },
        readyForProductionDate: null,
      },
    ]);
  });

  it("maps assignee, Dev Owners, priority and status from Jira's fields", async () => {
    await runSync(fakeJira().make);
    const { tickets } = await getSprintView("Velocity", "432");
    expect(tickets.map((t) => t.key)).toEqual(["DTP-4395", "DTP-4625"]);
    // Dev Owners do the work even when someone else is the assignee; the assignee stands in when there are none.
    expect(tickets[0]).toMatchObject({
      assignee: { displayName: "Adhyayan Rathi" },
      owners: [{ accountId: expect.any(String), displayName: "Shahid Khan" }],
      status: "In Requirement (With Product)",
      statusCategory: "indeterminate",
    });
    expect(tickets[1]).toMatchObject({
      owners: [{ displayName: "Rahul Saharan" }],
      priority: "High",
      status: "In-Dev",
      statusCategory: "indeterminate",
    });
  });

  it("reads the Ready for Production Date", async () => {
    const jira = fakeJira();
    const t = jira.issue("DTP-163");
    t.fields.customfield_11457 = { value: "RoadMap 2", id: "11232" };
    t.fields.customfield_10020 = [dtpSprints.values.find((s) => s.id === 432)];
    await runSync(jira.make);

    const [ticket] = (await getSprintView("RoadMap 2", "432")).tickets;
    expect(ticket).toMatchObject({ key: "DTP-163", type: "Improvement", readyForProductionDate: "2026-07-02" });
    expect(ticket.devOwners).toHaveLength(7);
  });

  it("ignores sub-tasks", async () => {
    const jira = fakeJira();
    // A sub-task that carries a POD value still never shows.
    jira.issue("DTP-4824").fields.customfield_11457 = { value: "RoadMap 1", id: "11231" };
    await runSync(jira.make);
    expect(await keys("RoadMap 1", "432")).toEqual(["DTP-4820"]);
  });

  it("defaults to the active sprint and lists it first", async () => {
    const jira = fakeJira();
    jira.sprints.find((s) => s.id === 332)!.state = "active";
    await runSync(jira.make);
    const view = await getSprintView("RoadMap 1");
    expect(view.sprint?.name).toBe("ABC sprint");
    expect(view.sprints.map((s) => s.state)).toEqual(["active", "future", "closed", "closed", "closed", "closed"]);
  });

  it("falls back to the default for an unknown sprint", async () => {
    await runSync(fakeJira().make);
    expect((await getSprintView("RoadMap 1", "999")).sprint?.id).toBe(432);
    expect((await getSprintView("RoadMap 1", "nonsense")).sprint?.id).toBe(432);
  });

  it("shows a closed sprint's tickets, including ones carried over to a later sprint", async () => {
    const jira = fakeJira();
    jira.issue("DTP-1313").fields.customfield_11457 = { value: "Atlas", id: "11234" };
    await runSync(jira.make);
    expect(await keys("Atlas", "299")).toEqual(["DTP-1313"]);
    expect(await keys("Atlas", "332")).toEqual(["DTP-1313"]);
  });

  it("is empty before the first sync", async () => {
    expect(await getSprintView("RoadMap 1")).toMatchObject({ sprints: [], sprint: null, tickets: [] });
  });

  it("is idempotent", async () => {
    const jira = fakeJira();
    await runSync(jira.make);
    const first = await getSprintView("Velocity", "432");
    await runSync(jira.make);
    expect(await getSprintView("Velocity", "432")).toEqual(first);
  });

  it("moves tickets that changed pod or sprint, and drops ones gone from Jira", async () => {
    const jira = fakeJira();
    await runSync(jira.make);

    jira.issue("DTP-4820").fields.customfield_11457 = { value: "RoadMap 2", id: "11232" };
    jira.issue("DTP-4625").fields.customfield_10020 = null;
    jira.issues = jira.issues.filter((i) => i.key !== "DTP-4395");
    jira.sprints = jira.sprints.filter((s) => s.id !== 167);
    await runSync(jira.make);

    expect(await keys("RoadMap 1", "432")).toEqual([]);
    expect(await keys("RoadMap 2", "432")).toEqual(["DTP-4820"]);
    expect(await keys("Velocity", "432")).toEqual([]);
    expect((await getSprintView("Velocity")).sprints.map((s) => s.id)).not.toContain(167);
  });

  it("never runs two syncs at once", async () => {
    const jira = fakeJira();
    let release!: () => void;
    jira.gate = new Promise((r) => (release = r));

    const first = runSync(jira.make);
    await expect.poll(() => jira.searches).toBe(1);
    expect(await runSync(jira.make)).toEqual({ status: "skipped" });
    expect(await runSync(jira.make)).toEqual({ status: "skipped" });
    expect((await getSyncStatus()).running).toBe(true);

    release();
    expect(await first).toEqual({ status: "succeeded" });
    expect(jira.searches).toBe(1);
    expect(await getSyncStatus()).toMatchObject({ running: false, failure: null });
  });

  it("keeps one copy of a sprint or ticket that Jira returns on two pages", async () => {
    const jira = fakeJira();
    jira.sprints.push(structuredClone(jira.sprints[0]));
    jira.issues.push(structuredClone(jira.issue("DTP-4820")));
    expect(await runSync(jira.make)).toEqual({ status: "succeeded" });
    expect(await keys("RoadMap 1", "432")).toEqual(["DTP-4820"]);
  });
});

describe("sync status", () => {
  it("records each run and reports the last success", async () => {
    expect(await getSyncStatus()).toEqual({ lastSuccessAt: null, failure: null, running: false });

    const before = new Date();
    await runSync(fakeJira().make);
    const status = await getSyncStatus();
    expect(status).toEqual({ lastSuccessAt: expect.any(Date), failure: null, running: false });
    expect(status.lastSuccessAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("explains a failed sync and keeps the earlier data and success time", async () => {
    const jira = fakeJira();
    await runSync(jira.make);
    const { lastSuccessAt } = await getSyncStatus();

    jira.fail = new JiraError("unauthorized", "Jira answered 401 Unauthorized for /rest/agile/1.0/board/267/sprint.");
    expect(await runSync(jira.make)).toEqual({ status: "failed", error: expect.stringContaining("401") });

    const status = await getSyncStatus();
    expect(status.lastSuccessAt).toEqual(lastSuccessAt);
    expect(status.failure).toEqual({
      at: expect.any(Date),
      error: "Jira rejected the saved API token (401). The admin can replace it in Settings.",
    });
    expect(await keys("RoadMap 1", "432")).toEqual(["DTP-4820"]);

    jira.fail = null;
    await runSync(jira.make);
    expect((await getSyncStatus()).failure).toBeNull();
  });

  it("rolls back a sync that fails part way through writing", async () => {
    const jira = fakeJira();
    await runSync(jira.make);
    jira.sprints.find((s) => s.id === 432)!.name = "Renamed sprint";
    jira.issue("DTP-4820").fields.summary = "Renamed";
    // The database refuses a ticket without a summary, after the sprints and earlier tickets are written.
    jira.issue("DTP-4841").fields.summary = null;

    expect(await runSync(jira.make)).toMatchObject({ status: "failed" });
    const view = await getSprintView("RoadMap 1", "432");
    expect(view.sprint?.name).toBe("Oct Spint 2");
    expect(view.tickets[0].summary).toBe("Assigned to me Views");
  });

  it("fails clearly when Jira is not connected", async () => {
    await resetDb();
    expect(await runSync(fakeJira().make)).toEqual({
      status: "failed",
      error: "Jira is not connected yet. The admin can connect it in Settings.",
    });
  });

  it("stops reporting a run that died mid-way once the next sync takes the lock", async () => {
    // What a function timeout leaves behind: a run that started and never finished.
    await db.insert(syncRuns).values({ startedAt: new Date(Date.now() - 60_000) });
    expect((await getSyncStatus()).running).toBe(true);

    await runSync(fakeJira().make);
    expect(await getSyncStatus()).toMatchObject({ running: false, failure: null });
  });

  it("lets any signed-in lead sync now, but not a signed-out caller", async () => {
    const rahul = await viewerForEmail("rahul@delightree.com");
    expect(await syncNow(rahul, fakeJira().make)).toEqual({ status: "succeeded" });
    await expect(syncNow(null, fakeJira().make)).rejects.toThrow(ForbiddenError);
  });
});
