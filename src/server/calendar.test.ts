import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import dtpSprints from "../../tests/fixtures/dtp-board-267-sprints.json";
import type { JiraUser } from "@/db/schema";
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

  it("shows every pod with its hours, and gives the later sprint the day two sprints share", async () => {
    await runSync(jira.make);
    const c = await getCalendar("2026-10");
    // ABC sprint runs to 27 Oct, but Oct Spint 2 starts on 26 Oct.
    expect(on(c, "2026-10-26").sprint?.name).toBe("Oct Spint 2");
    expect(on(c, "2026-10-23").sprint?.name).toBe("ABC sprint");
    // Five people at 5.6h each.
    expect(row(c, "2026-10-28", "RoadMap 2")).toMatchObject({ capacity: 28, booked: 3.2 });
    expect(on(c, "2026-10-28").rows.map((r) => r.name)).toEqual(["RoadMap 1", "RoadMap 2", "Velocity", "Atlas"]);
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
