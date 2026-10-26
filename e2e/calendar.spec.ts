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

test("a lead sees every pod's hours on the capacity calendar, then opens a pod to see its people", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await page.getByRole("link", { name: "Capacity calendar" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.goto("/calendar?month=2026-10");
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();

  // Oct Spint 2 runs 26 Oct to 6 Nov. Velocity's five people plan 5.6h a day each; DTP-4625's 22.5 days are 18h a day.
  await expect(page.getByRole("cell", { name: "Monday 26 October" })).toContainText("Oct Spint 2");
  const wednesday = page.getByRole("cell", { name: "Wednesday 28 October" });
  await expect(wednesday.getByRole("link", { name: "Velocity: 18h booked of 28h" })).toBeVisible();
  await expect(wednesday.getByRole("link", { name: "RoadMap 2: 0h booked of 28h" })).toBeVisible();
  // ABC sprint still has the days before it.
  await expect(page.getByRole("cell", { name: "Monday 19 October" })).toContainText("ABC sprint");

  await wednesday.getByRole("link", { name: /^Velocity/ }).click();
  await expect(page).toHaveURL(/\/pods\/velocity\/calendar\?month=2026-10$/);
  await expect(page.getByRole("heading", { name: "Velocity calendar" })).toBeVisible();
  const day = page.getByRole("cell", { name: "Wednesday 28 October" });
  // Rahul's 16.5 BE days are 13.2h a day; nobody in Velocity can take the 6 FE days.
  await expect(day.getByRole("link", { name: "Rahul Saharan: 13.2h booked of 5.6h" })).toBeVisible();
  await expect(day.getByRole("link", { name: "Manish Bisht: 0h booked of 5.6h" })).toBeVisible();
  await expect(day.getByRole("link", { name: "Unassigned: 4.8h booked of 0h" })).toBeVisible();

  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Monday 9 November" })).toContainText("No sprint");

  // The pod page links to its calendar.
  await page.goto("/pods/velocity");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/pods\/velocity\/calendar$/);
});
