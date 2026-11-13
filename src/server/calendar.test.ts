import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import type { JiraUser } from "@/db/schema";
import { bandwidthFrom, getBandwidth } from "./bandwidth";
import { planWeeks } from "./planning";
import { calendarMonth, getCalendar, type Calendar } from "./calendar";
import { addHoliday, saveJiraSettings } from "./settings";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

const OCT_SPRINT_2 = dtpSprints.values.find((s) => s.id === 432);

let jira: ReturnType<typeof fakeJira>;
let aman: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  jira = fakeJira();
  // Mayank owns 4 FE days in RoadMap 2's Oct Spint 2, which runs 26 Oct to 6 Nov: 10 working days.
  const known = jira.issues.flatMap((i) => [i.fields.assignee, ...((i.fields.customfield_10777 ?? []) as JiraUser[])]);
  const mayank = (known as (JiraUser | null)[]).find((u) => u?.displayName === "Mayank Awasthi") ?? {
    accountId: "a-mayank",
    displayName: "Mayank Awasthi",
  };
  Object.assign(jira.issue("DTP-163").fields, {
    customfield_11457: { value: "RoadMap 2-Aman", id: "11232" },
    customfield_10020: [OCT_SPRINT_2],
    assignee: null,
    customfield_10777: [mayank],
    customfield_11525: 4,
  });
});

const on = (c: Calendar, date: string) => c.weeks.flat().find((d) => d.date === date)!;
const row = (c: Calendar, date: string, name: string) => on(c, date).rows.find((r) => r.name === name);

describe("capacity calendar", () => {
  it("shows a pod's people with hours booked against plannable hours, Monday to Friday", async () => {
    await runSync(jira.make);
    const c = await getCalendar("2026-11", "roadmap-2");
    expect(c.pod?.name).toBe("RoadMap 2");
    // November 2026 starts on a Sunday, so its weeks run from Monday 2 Nov to Friday 4 Dec.
    expect(c.weeks.map((w) => w.map((d) => d.date.slice(5)))).toEqual([
      ["11-02", "11-03", "11-04", "11-05", "11-06"],
      ["11-09", "11-10", "11-11", "11-12", "11-13"],
      ["11-16", "11-17", "11-18", "11-19", "11-20"],
      ["11-23", "11-24", "11-25", "11-26", "11-27"],
      ["11-30", "12-01", "12-02", "12-03", "12-04"],
    ]);
    // 7 plannable days over 10 working days is 5.6h a day; 4 days of work is 3.2h a day.
    expect(on(c, "2026-11-04").sprint?.name).toBe("Oct Spint 2");
    expect(row(c, "2026-11-04", "Mayank Awasthi")).toMatchObject({ capacity: 5.6, booked: 3.2 });
    expect(row(c, "2026-11-04", "Mayank Awasthi")?.tickets).toEqual([expect.stringMatching(/^DTP-163 /)]);
    expect(row(c, "2026-11-04", "Kalpan Punamiya")).toMatchObject({ capacity: 5.6, booked: 0 });
    // After the sprint there is nothing planned yet.
    expect(on(c, "2026-11-09")).toMatchObject({ sprint: null, rows: [] });
  });

  it("books nothing on a holiday and spreads the sprint over the days left", async () => {
    await addHoliday(aman, { date: "2026-11-03", name: "Founders' Day" });
    await runSync(jira.make);
    const c = await getCalendar("2026-11", "roadmap-2");
    expect(on(c, "2026-11-03")).toMatchObject({ holiday: "Founders' Day", rows: [] });
    // 9 days left: 6.3 plannable days is still 5.6h a day, and 4 days of work is 3.56h.
    expect(row(c, "2026-11-04", "Mayank Awasthi")).toMatchObject({ capacity: 5.6, booked: 3.56 });
  });

  it("falls back to this month for a month it cannot read", () => {
    expect(calendarMonth("2026-11")).toBe("2026-11");
    expect(calendarMonth("2026-13")).toMatch(/^\d{4}-\d{2}$/);
    expect(calendarMonth(undefined)).not.toBe("2026-13");
  });
});

describe("bandwidth", () => {
  it("shows each pod's people, sprint by sprint, with the epics they work on and their days", async () => {
    jira.issue("DTP-163").fields.parent = {
      key: "DTP-9001",
      fields: { summary: "Territory", issuetype: { name: "Epic" } },
    };
    await runSync(jira.make);
    const b = await getBandwidth("2026-10-19");
    // ABC sprint holds the week of 19 Oct, Oct Spint 2 the next two, and nothing is planned after.
    expect(b.weeks.map((r) => [r.sprint?.name ?? null, r.weeks.length])).toEqual([
      ["ABC sprint", 1],
      ["Oct Spint 2", 2],
      [null, 9],
    ]);
    expect(b.pods.map((p) => p.name)).toEqual(["RoadMap 1", "RoadMap 2", "Velocity", "Atlas", "Support"]);
    const mayank = b.pods[1].people.find((p) => p.name === "Mayank Awasthi")!;
    expect(mayank.sprints[1]).toEqual({
      work: [
        {
          key: "DTP-9001",
          label: "Territory",
          url: "https://delightree.atlassian.net/browse/DTP-9001",
          tickets: [expect.stringMatching(/^DTP-163 /)],
        },
      ],
      booked: 4,
      capacity: 7,
    });
    expect(mayank.sprints[2]).toBeNull();
  });

  it("links a person's tickets without an epic to Jira: the ticket itself, or a search for several", async () => {
    await runSync(jira.make);
    const mayank = async () =>
      (await getBandwidth("2026-10-19")).pods[1].people.find((p) => p.name === "Mayank Awasthi")!.sprints[1]!.work;
    expect(await mayank()).toEqual([
      expect.objectContaining({
        label: "1 ticket without an epic",
        url: "https://delightree.atlassian.net/browse/DTP-163",
      }),
    ]);

    const other = jira.issue("DTP-1313").fields;
    delete other.parent;
    Object.assign(other, pick(jira.issue("DTP-163").fields));
    await runSync(jira.make);
    expect(await mayank()).toEqual([
      expect.objectContaining({
        label: "2 tickets without an epic",
        url: `https://delightree.atlassian.net/issues/?jql=${encodeURIComponent("key in (DTP-163, DTP-1313)")}`,
      }),
    ]);
  });

  it("gives a week to the sprint holding its Wednesday, the later one where two do", () => {
    const sprint = (id: number, start: string, end: string) => ({
      id,
      name: `S${id}`,
      startDate: new Date(`${start}T04:30:00Z`),
      endDate: new Date(`${end}T14:30:00Z`),
    });
    // S1 starts on a Thursday, so its first week is nobody's; S2 overlaps its last week and takes it.
    const runs = planWeeks("2026-11-02", 4, [
      sprint(1, "2026-11-05", "2026-11-25"),
      sprint(2, "2026-11-23", "2026-12-04"),
    ]);
    expect(runs.map((r) => [r.sprint?.id ?? null, r.weeks])).toEqual([
      [null, ["2026-11-02"]],
      [1, ["2026-11-09", "2026-11-16"]],
      [2, ["2026-11-23"]],
    ]);
  });

  it("starts on the Monday of the day asked for, else this week", () => {
    expect(bandwidthFrom("2026-11-11")).toBe("2026-11-09");
    expect(bandwidthFrom("2026-11-09")).toBe("2026-11-09");
    expect(new Date(`${bandwidthFrom("nonsense")}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});

/** The fields that put a ticket in RoadMap 2's Oct Spint 2, owned by Mayank. */
const pick = (f: Record<string, unknown>) => ({
  customfield_11457: f.customfield_11457,
  customfield_10020: f.customfield_10020,
  assignee: f.assignee,
  customfield_10777: f.customfield_10777,
});
