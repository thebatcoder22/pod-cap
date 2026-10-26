import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import { getEpicList, getPendingInJira, setEpicSize } from "./epics";
import { ForbiddenError } from "./permissions";
import { getPodPage } from "./pods";
import { saveJiraSettings, ValidationError } from "./settings";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const site = "https://delightree.atlassian.net";
const FE_DAYS = "customfield_11525";
const BE_DAYS = "customfield_11524";

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
let shikhar: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  shikhar = (await viewerForEmail("shikhar@delightree.com"))!;
  await saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
});

const list = async (slug: string) => getEpicList((await getPodPage(slug))!.pod);
const epic = async (slug: string, key: string) => (await list(slug)).find((e) => e.key === key)!;
const skills = (e: Awaited<ReturnType<typeof epic>>) => Object.fromEntries(e.skills.map((k) => [k.skill, k]));

/** Moves a ticket under another epic, as dragging it in Jira would. */
const reparent = (key: string, epicKey: string) => {
  const sibling = jira.issues.find((i) => i.fields.parent && (i.fields.parent as { key: string }).key === epicKey)!;
  jira.issue(key).fields.parent = sibling.fields.parent;
};

describe("epics", () => {
  it("lists the epics a pod owns or has work in, with their Ready for Production Date, linked to Jira", async () => {
    await runSync(jira.make);
    expect(await list("roadmap-1")).toEqual([
      // In progress first, then to do; then by Ready for Production Date.
      {
        key: "DTP-4427",
        url: `${site}/browse/DTP-4427`,
        summary: "AI Reporting - AI Analyst, KPI watchlist and reusable reports",
        status: "In Progress",
        statusCategory: "indeterminate",
        readyForProductionDate: "2026-11-14",
        size: null,
        owner: { id: expect.any(Number), name: "RoadMap 1", slug: "roadmap-1" },
        tickets: 0,
        skills: [
          { skill: "FE", days: null, notEstimated: 0 },
          { skill: "BE", days: null, notEstimated: 0 },
          { skill: "Data", days: null, notEstimated: 0 },
          { skill: "AI", days: null, notEstimated: 0 },
        ],
        unestimated: 0,
        pods: [],
        missing: [],
      },
      // Its POD is RoadMap 1, though its only ticket is Velocity's.
      expect.objectContaining({ key: "DTP-4610", owner: expect.objectContaining({ slug: "roadmap-1" }), tickets: 1 }),
      // Velocity's epic, with a ticket built by Shahid, so RoadMap 1 has work in it.
      expect.objectContaining({ key: "DTP-4700", owner: expect.objectContaining({ slug: "velocity" }), tickets: 1 }),
      // No POD in Jira: its tickets are all RoadMap 1's, so it is.
      expect.objectContaining({ key: "DTP-4819", owner: expect.objectContaining({ slug: "roadmap-1" }), tickets: 1 }),
    ]);
    // DTP-4610 has work in Velocity, so Velocity sees it too, owned by RoadMap 1.
    expect((await list("velocity")).map((e) => [e.key, e.owner?.slug])).toEqual([
      ["DTP-4610", "roadmap-1"],
      ["DTP-4700", "velocity"],
    ]);
    // DTP-4 has no POD, but its only ticket's Dev Owners are RoadMap 2's, so it is.
    expect((await list("roadmap-2")).map((e) => [e.key, e.owner?.slug])).toEqual([
      ["DTP-4", "roadmap-2"],
      ["DTP-4830", "roadmap-2"],
    ]);
  });

  it("sums its child tickets' skill-days per skill, keeping missing estimates apart from zero", async () => {
    jira.issue("DTP-4625").fields[FE_DAYS] = 2;
    jira.issue("DTP-4625").fields[BE_DAYS] = 3;
    jira.issue("DTP-4395").fields[FE_DAYS] = 1.5;
    jira.issue("DTP-4395").fields[BE_DAYS] = null;
    reparent("DTP-4395", "DTP-4610");
    // A sub-task is not plannable, so it adds nothing.
    jira.issue("DTP-4824").fields.parent = jira.issue("DTP-4625").fields.parent;
    await runSync(jira.make);

    const e = await epic("roadmap-1", "DTP-4610");
    expect(e.tickets).toBe(2);
    expect(skills(e)).toEqual({
      FE: { skill: "FE", days: 3.5, notEstimated: 0 },
      BE: { skill: "BE", days: 3, notEstimated: 1 },
      Data: { skill: "Data", days: null, notEstimated: 2 },
      AI: { skill: "AI", days: null, notEstimated: 2 },
    });
    expect(e.unestimated).toBe(0);

    // An epic whose tickets have no estimates at all says so.
    const assigned = await epic("roadmap-1", "DTP-4819");
    expect(assigned).toMatchObject({ tickets: 1, unestimated: 1 });
    expect(skills(assigned).FE).toEqual({ skill: "FE", days: null, notEstimated: 1 });
  });

  it("follows Jira when a ticket moves to another epic or pod", async () => {
    await runSync(jira.make);
    expect((await epic("velocity", "DTP-4700")).tickets).toBe(1);

    reparent("DTP-4395", "DTP-4610");
    await runSync(jira.make);
    expect((await epic("velocity", "DTP-4700")).tickets).toBe(0);
    expect((await epic("velocity", "DTP-4610")).tickets).toBe(2);

    // An epic with no POD and work in two pods belongs to neither, and both see it.
    reparent("DTP-4687", "DTP-4830");
    await runSync(jira.make);
    expect(await epic("roadmap-2", "DTP-4830")).toMatchObject({ owner: null, tickets: 2 });
    expect(await epic("roadmap-1", "DTP-4830")).toMatchObject({ owner: null, tickets: 2 });
  });

  it("lists what the PM still has to fill in on the pod's open epics in Jira", async () => {
    await runSync(jira.make);
    // No POD and no Ready for Production Date; its only ticket makes it RoadMap 2's anyway.
    expect(await epic("roadmap-2", "DTP-4830")).toMatchObject({
      pods: [{ name: "RoadMap 2", slug: "roadmap-2", tickets: 1 }],
      missing: ["POD", "Ready for Production Date"],
    });
    // Both set in Jira: nothing to chase.
    expect((await epic("roadmap-1", "DTP-4427")).missing).toEqual([]);
    // RoadMap 1's epic: Velocity has work in it, but chasing it is RoadMap 1's job.
    expect((await epic("velocity", "DTP-4610")).missing).toEqual([]);

    // Shared by two pods, both are asked, and see where its tickets are.
    reparent("DTP-4687", "DTP-4830");
    await runSync(jira.make);
    for (const slug of ["roadmap-1", "roadmap-2"]) {
      expect(await epic(slug, "DTP-4830")).toMatchObject({
        pods: [
          { name: "RoadMap 1", tickets: 1 },
          { name: "RoadMap 2", tickets: 1 },
        ],
        missing: ["POD", "Ready for Production Date"],
      });
    }

    // A done epic needs nothing more.
    jira.issue("DTP-4830").fields.status = { name: "Done", statusCategory: { key: "done" } };
    await runSync(jira.make);
    expect((await epic("roadmap-2", "DTP-4830")).missing).toEqual([]);
  });

  it("gathers every pod's pending epics for the PM page, the viewer's pod first", async () => {
    reparent("DTP-4687", "DTP-4830");
    await runSync(jira.make);
    const roadmap2 = (await getPodPage("roadmap-2"))!.pod;
    const pending = await getPendingInJira(roadmap2.id);

    expect(pending[0].pod).toEqual({ id: roadmap2.id, name: "RoadMap 2", slug: "roadmap-2" });
    // Shared by two pods, so it is on both lists.
    for (const slug of ["roadmap-1", "roadmap-2"]) {
      expect(pending.find((p) => p.pod.slug === slug)!.epics.map((e) => e.key)).toContain("DTP-4830");
    }
    // Only epics with something to set, and only pods that have some.
    expect(pending.every((p) => p.epics.length && p.epics.every((e) => e.missing.length))).toBe(true);
    // RoadMap 1 sees its own pod first.
    const roadmap1 = (await getPodPage("roadmap-1"))!.pod;
    expect((await getPendingInJira(roadmap1.id))[0].pod.slug).toBe("roadmap-1");
  });

  it("lets a lead size their own pod's epics, and keeps the size across syncs", async () => {
    await runSync(jira.make);
    await setEpicSize(aman, "DTP-4830", "M");
    await setEpicSize(shikhar, "DTP-4610", "XL");
    expect((await epic("roadmap-2", "DTP-4830")).size).toBe("M");
    // Every pod sees the size, including one with work in it.
    expect((await epic("velocity", "DTP-4610")).size).toBe("XL");

    await runSync(jira.make);
    expect((await epic("roadmap-2", "DTP-4830")).size).toBe("M");

    await setEpicSize(aman, "DTP-4830", "S");
    expect((await epic("roadmap-2", "DTP-4830")).size).toBe("S");
    await setEpicSize(aman, "DTP-4830", null);
    expect((await epic("roadmap-2", "DTP-4830")).size).toBeNull();
  });

  it("refuses to size another pod's epic, or one no pod owns", async () => {
    await runSync(jira.make);
    const rahul = (await viewerForEmail("rahul@delightree.com"))!;
    // Velocity has work in DTP-4610, but RoadMap 1 owns it.
    await expect(setEpicSize(rahul, "DTP-4610", "L")).rejects.toThrow(
      new ForbiddenError("You can only edit your own pod."),
    );
    await expect(setEpicSize(null, "DTP-4610", "L")).rejects.toThrow(ForbiddenError);

    reparent("DTP-4687", "DTP-4830");
    await runSync(jira.make);
    await expect(setEpicSize(aman, "DTP-4830", "L")).rejects.toThrow(
      new ForbiddenError("DTP-4830 has work in more than one pod. Set its POD in Jira to size it."),
    );
    expect((await epic("roadmap-2", "DTP-4830")).size).toBeNull();
  });

  it("refuses a size other than S, M, L or XL, and an epic Jira no longer has", async () => {
    await runSync(jira.make);
    await expect(setEpicSize(aman, "DTP-4830", "XXL" as "XL")).rejects.toThrow(
      new ValidationError("Pick S, M, L or XL."),
    );
    await expect(setEpicSize(aman, "DTP-9999", "S")).rejects.toThrow(
      new ValidationError("That epic is no longer in Jira. Sync, then try again."),
    );
  });
});
