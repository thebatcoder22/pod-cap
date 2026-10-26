import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import { getCapacitySheet, setLeave } from "./capacity";
import { getPodPage } from "./pods";
import { ForbiddenError } from "./permissions";
import {
  addHoliday,
  getPlanningSettings,
  removeHoliday,
  saveJiraSettings,
  setFocusFactor,
  ValidationError,
} from "./settings";
import { getSprintView } from "./sprints";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

// On board 267: "Oct Spint 2" runs Mon 26 Oct to Fri 6 Nov 2026, ten weekdays.
const OCT_SPRINT_2 = "432";

let aman: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
  await runSync(fakeJira().make);
});

async function sheet(slug = "roadmap-2", sprint = OCT_SPRINT_2) {
  const page = (await getPodPage(slug))!;
  const view = await getSprintView(page.pod.jiraPodOptionId, sprint);
  return getCapacitySheet(page, view.sprint!, view.tickets);
}

const personId = async (slug: string, name: string) =>
  (await getPodPage(slug))!.members.find((m) => m.name === name)!.id;

const capacityOf = (s: Awaited<ReturnType<typeof sheet>>, name: string) =>
  s.people.find((p) => p.name === name)!.capacity;

describe("capacity sheet", () => {
  it("gives everyone 7 days in a full 10-day sprint with no leave", async () => {
    const s = await sheet();
    expect(s).toMatchObject({ workingDays: 10, holidays: [], focusPercent: 70 });
    expect(s.people.map((p) => [p.name, p.leave, p.capacity])).toEqual([
      ["Aman Tyagi", 0, 7],
      ["Akash Singh", 0, 7],
      ["Kalpan Punamiya", 0, 7],
      ["Mayank Awasthi", 0, 7],
      ["Muthaiyan Mani", 0, 7],
    ]);
  });

  it("takes half-day leave and holidays off in proportion", async () => {
    await addHoliday(aman, { date: "2026-11-03", name: "Founders' Day" });
    // A weekend holiday and one after the sprint take nothing off.
    await addHoliday(aman, { date: "2026-11-01", name: "Sunday off" });
    await addHoliday(aman, { date: "2026-11-09", name: "Diwali" });
    await setLeave(aman, await personId("roadmap-2", "Mayank Awasthi"), 432, 1.5);

    const s = await sheet();
    expect(s).toMatchObject({ workingDays: 10, holidays: [{ date: "2026-11-03", name: "Founders' Day" }] });
    const mayank = s.people.find((p) => p.name === "Mayank Awasthi")!;
    // (10 - 1.5 - 1) x 70%
    expect(mayank).toMatchObject({ leave: 1.5, capacity: 5.25 });
    // (10 - 1) x 70%
    expect(capacityOf(s, "Muthaiyan Mani")).toBe(6.3);
  });

  it("sums each skill over the people whose main skill it is", async () => {
    await setLeave(aman, await personId("roadmap-2", "Mayank Awasthi"), 432, 2);
    expect((await sheet()).skills).toEqual([
      // Mayank (10 - 2) x 70% plus Muthaiyan 7.
      { skill: "FE", people: 2, capacity: 12.6, gap: false },
      { skill: "BE", people: 1, capacity: 7, gap: false },
      { skill: "Data", people: 1, capacity: 7, gap: false },
      { skill: "AI", people: 1, capacity: 7, gap: false },
    ]);
    expect((await sheet()).total).toBe(33.6);
  });

  it("drops a skill to zero when its only person is away all sprint", async () => {
    await setLeave(aman, await personId("roadmap-2", "Kalpan Punamiya"), 432, 10);
    const s = await sheet();
    expect(s.skills.find((k) => k.skill === "Data")).toEqual({ skill: "Data", people: 1, capacity: 0, gap: true });
    expect(capacityOf(s, "Kalpan Punamiya")).toBe(0);
  });

  it("never goes below zero when leave overlaps a holiday", async () => {
    await addHoliday(aman, { date: "2026-10-27", name: "Holiday" });
    await setLeave(aman, await personId("roadmap-2", "Kalpan Punamiya"), 432, 10);
    expect(capacityOf(await sheet(), "Kalpan Punamiya")).toBe(0);
  });

  it("uses the focus factor the admin sets", async () => {
    await setFocusFactor(aman, 80);
    const s = await sheet();
    expect(s.focusPercent).toBe(80);
    expect(capacityOf(s, "Aman Tyagi")).toBe(8);
  });

  it("only counts a person's leave in the sprint it was entered for", async () => {
    await setLeave(aman, await personId("roadmap-2", "Mayank Awasthi"), 332, 3);
    expect(capacityOf(await sheet(), "Mayank Awasthi")).toBe(7);
  });
});

describe("leave", () => {
  it("can be changed and cleared by the lead", async () => {
    const mayank = await personId("roadmap-2", "Mayank Awasthi");
    await setLeave(aman, mayank, 432, 3);
    await setLeave(aman, mayank, 432, 0.5);
    expect((await sheet()).people.find((p) => p.name === "Mayank Awasthi")).toMatchObject({ leave: 0.5 });
    await setLeave(aman, mayank, 432, 0);
    expect((await sheet()).people.find((p) => p.name === "Mayank Awasthi")).toMatchObject({ leave: 0, capacity: 7 });
  });

  it("is refused for another lead's pod, even for the admin, and when signed out", async () => {
    const manish = await personId("velocity", "Manish Bisht");
    const mayank = await personId("roadmap-2", "Mayank Awasthi");
    await expect(setLeave(aman, manish, 432, 1)).rejects.toThrow(ForbiddenError);
    await expect(setLeave(await viewerForEmail("rahul@delightree.com"), mayank, 432, 1)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(setLeave(null, mayank, 432, 1)).rejects.toThrow(ForbiddenError);
    expect(capacityOf(await sheet("velocity"), "Manish Bisht")).toBe(7);
    expect(capacityOf(await sheet(), "Mayank Awasthi")).toBe(7);
  });

  it("must be half days within the sprint's working days", async () => {
    const mayank = await personId("roadmap-2", "Mayank Awasthi");
    for (const days of [0.3, -1, 10.5, NaN]) {
      await expect(setLeave(aman, mayank, 432, days)).rejects.toThrow(ValidationError);
    }
    await expect(setLeave(aman, mayank, 9999, 1)).rejects.toThrow(ValidationError);
    await setLeave(aman, mayank, 432, 10);
  });
});

describe("holidays and focus factor", () => {
  it("are read by everyone, with 70% until the admin changes it", async () => {
    await addHoliday(aman, { date: "2026-11-09", name: "Diwali" });
    await addHoliday(aman, { date: "2026-10-02", name: "Gandhi Jayanti" });
    // The same date again renames it.
    await addHoliday(aman, { date: "2026-11-09", name: " Diwali (Laxmi Puja) " });
    expect(await getPlanningSettings()).toEqual({
      focusPercent: 70,
      holidays: [
        { date: "2026-10-02", name: "Gandhi Jayanti" },
        { date: "2026-11-09", name: "Diwali (Laxmi Puja)" },
      ],
    });
  });

  it("lets the admin remove a holiday, giving the day back", async () => {
    await addHoliday(aman, { date: "2026-11-03", name: "Holiday" });
    await removeHoliday(aman, "2026-11-03");
    expect(capacityOf(await sheet(), "Aman Tyagi")).toBe(7);
    expect((await getPlanningSettings()).holidays).toEqual([]);
  });

  it("refuse bad input", async () => {
    for (const date of ["", "2026-02-30", "2026-13-01", "next friday"]) {
      await expect(addHoliday(aman, { date, name: "x" })).rejects.toThrow(ValidationError);
    }
    await expect(addHoliday(aman, { date: "2026-11-09", name: "  " })).rejects.toThrow(ValidationError);
    await expect(removeHoliday(aman, "2026-13-01")).rejects.toThrow(ValidationError);
    for (const percent of [0, 101, 70.5, NaN])
      await expect(setFocusFactor(aman, percent)).rejects.toThrow(ValidationError);
  });

  it("can only be changed by the admin", async () => {
    await addHoliday(aman, { date: "2026-11-03", name: "Holiday" });
    for (const viewer of [await viewerForEmail("shikhar@delightree.com"), null]) {
      await expect(addHoliday(viewer, { date: "2026-11-04", name: "Mine" })).rejects.toThrow(ForbiddenError);
      await expect(removeHoliday(viewer, "2026-11-03")).rejects.toThrow(ForbiddenError);
      await expect(setFocusFactor(viewer, 90)).rejects.toThrow(ForbiddenError);
    }
    expect(await getPlanningSettings()).toEqual({
      focusPercent: 70,
      holidays: [{ date: "2026-11-03", name: "Holiday" }],
    });
  });
});
