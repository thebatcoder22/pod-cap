import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { people } from "../src/db/schema";
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
test.beforeEach(() => linkRahul(true));
test.afterEach(() => linkRahul(false));

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
