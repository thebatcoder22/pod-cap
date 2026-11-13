import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { people, tickets } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// What a sync would link. Unlinked after, as the people spec confirms Rahul's account itself.
async function linkRahul(on: boolean) {
  const db = drizzle(E2E_DATABASE_URL);
  await db
    .update(people)
    .set({ jiraAccountId: on ? "a-rahul" : null })
    .where(eq(people.name, "Rahul Saharan"));
  await db.$client.end();
}
// Parked: in the sprint, but nobody is working on it. Here only, so other pods' numbers stay put.
async function parkTicket(on: boolean) {
  const db = drizzle(E2E_DATABASE_URL);
  if (on)
    await db.insert(tickets).values({
      key: "DTP-4630",
      summary: "Checklist audit trail",
      type: "Story",
      status: "On Hold",
      statusCategory: "new",
      priority: "Medium",
      podOptionId: "11230",
      sprintIds: [432],
      assignee: { accountId: "a-rahul", displayName: "Rahul Saharan" },
      devOwners: [],
      epicKey: "DTP-4640",
      epicSummary: "Checklist audits",
      estimates: { BE: 3 },
    });
  else await db.delete(tickets).where(eq(tickets.key, "DTP-4630"));
  await db.$client.end();
}
// Unestimated tickets on three more epics: more epics than a cell shows, without booking Rahul any days.
const extra = ["Audit export", "Audit filters", "Audit retention"];
async function moreEpics(on: boolean) {
  const db = drizzle(E2E_DATABASE_URL);
  const keys = extra.map((_, i) => `DTP-465${i}`);
  if (on)
    await db.insert(tickets).values([
      ...extra.map((summary, i) => ({
        key: keys[i],
        summary,
        type: "Story",
        status: "In Progress",
        statusCategory: "indeterminate" as const,
        priority: "Medium",
        podOptionId: "11230",
        sprintIds: [432],
        assignee: { accountId: "a-rahul", displayName: "Rahul Saharan" },
        devOwners: [],
        epicKey: `DTP-466${i}`,
        epicSummary: summary,
        estimates: {},
      })),
      // Checklists v2 started in the sprint before, so it runs on into Oct Spint 2.
      {
        key: "DTP-4653",
        summary: "Checklist templates",
        type: "Story",
        status: "Done",
        statusCategory: "done" as const,
        priority: "Medium",
        podOptionId: "11230",
        sprintIds: [332],
        assignee: { accountId: "a-rahul", displayName: "Rahul Saharan" },
        devOwners: [],
        epicKey: "DTP-4610",
        epicSummary: "Checklists v2",
        estimates: {},
      },
    ]);
  else await db.delete(tickets).where(inArray(tickets.key, [...keys, "DTP-4653"]));
  await db.$client.end();
}
test.beforeEach(() => Promise.all([linkRahul(true), parkTicket(true), moreEpics(true)]));
test.afterEach(() => Promise.all([linkRahul(false), parkTicket(false), moreEpics(false)]));

test("product sees who works on what across every pod, week by week, then opens a pod's calendar", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await page.getByRole("link", { name: "Bandwidth" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.goto("/calendar?from=2026-10-21");
  await expect(page.getByRole("heading", { name: "19 Oct - 8 Jan" })).toBeVisible();

  // Oct Spint 2 holds the weeks of 26 Oct and 2 Nov; nothing is planned after it.
  await expect(page.getByRole("columnheader", { name: "Oct Spint 2" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Week of 2 Nov" })).toBeVisible();
  const rahul = page.getByRole("row", { name: /^Rahul Saharan/ });
  // Rahul's 16.5 BE days on Checklists v2 against his 7 plannable days.
  await expect(rahul.getByText("Checklists v2")).toBeVisible();
  await expect(rahul.getByLabel("16.5 of 7 days booked")).toBeVisible();
  // His On Hold ticket books none of his days, here or on the pod calendar below.
  await expect(rahul.getByText("Checklist audits")).toHaveCount(0);
  // An epic running through back-to-back sprints is one chip across them.
  const sprint = (await page.getByRole("columnheader", { name: "Oct Spint 2" }).boundingBox())!;
  const run = (await rahul.getByText("Checklists v2", { exact: true }).boundingBox())!;
  expect(run.x).toBeLessThan(sprint.x);
  expect(run.x + run.width).toBeGreaterThan(sprint.x + sprint.width / 2);
  // Past three epics the rest fold into "+N more", which opens to show them.
  await rahul.getByText(/^\+\d+ more$/).click();
  for (const epic of ["Checklists v2", ...extra]) await expect(rahul.getByText(epic, { exact: true })).toBeVisible();
  await rahul.getByText("Show less").click();
  await expect(rahul.getByText(/^\+\d+ more$/)).toBeVisible();
  // Manish has no Jira account linked, so nothing of his is booked.
  await expect(page.getByRole("row", { name: /^Manish Bisht/ }).getByText("7d free", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Later weeks" }).click();
  await expect(page).toHaveURL(/\/calendar\?from=2026-11-30$/);

  // Each pod's calendar is a click away, and links back.
  await page.goto("/calendar?from=2026-10-19");
  await page
    .getByRole("row", { name: /^Velocity/ })
    .getByRole("link", { name: "Calendar" })
    .click();
  await expect(page).toHaveURL(/\/pods\/velocity\/calendar$/);
  await page.goto("/pods/velocity/calendar?month=2026-10");
  await expect(page.getByRole("heading", { name: "Velocity calendar" })).toBeVisible();
  const day = page.getByRole("cell", { name: "Wednesday 28 October" });
  // Rahul's 16.5 BE days are 13.2h a day; nobody in Velocity can take the 6 FE days.
  await expect(day.getByRole("link", { name: "Rahul Saharan: 13.2h booked of 5.6h" })).toBeVisible();
  await expect(day.getByRole("link", { name: "Manish Bisht: 0h booked of 5.6h" })).toBeVisible();
  await expect(day.getByRole("link", { name: "Unassigned: 4.8h booked of 0h" })).toBeVisible();

  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Monday 9 November" })).toContainText("No sprint");
  await page.getByRole("link", { name: "See every pod's bandwidth" }).click();
  await expect(page).toHaveURL(/\/calendar$/);

  // The pod page links to its calendar.
  await page.goto("/pods/velocity");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/pods\/velocity\/calendar$/);
});
