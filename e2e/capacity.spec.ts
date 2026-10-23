import { expect, test, type Page } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { leave } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// The specs share one database, so the leave entered here goes with the test.
test.afterEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  await db.delete(leave);
  await db.$client.end();
});

/** Waits for the save itself: the typed value shows at once, and reloading early would race it. */
async function save(page: Page, field: ReturnType<Page["getByLabel"]>, value: string) {
  await field.fill(value);
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), field.press("Enter")]);
}

test("a lead enters leave and sees capacity per person and per skill, with the admin's holidays", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await expect(page).toHaveURL(/\/pods\/roadmap-2$/);
  const bySkill = page.getByRole("region", { name: "Capacity by skill" });
  const sheet = page.getByRole("region", { name: "Capacity sheet" });

  // Oct Spint 2: ten weekdays at 70%.
  await expect(bySkill).toContainText("Working days10");
  await expect(sheet.getByRole("row", { name: /Mayank Awasthi/ })).toContainText("7 days");
  await expect(bySkill).toContainText("35plannable days");

  await save(page, sheet.getByLabel("Leave days for Mayank Awasthi"), "1.5");
  await expect(sheet.getByRole("row", { name: /Mayank Awasthi/ })).toContainText("5.95 days");

  // RoadMap 2's only Data engineer away all sprint.
  await save(page, sheet.getByLabel("Leave days for Kalpan Punamiya"), "10");
  await expect(bySkill.getByText("No Data capacity this sprint")).toBeVisible();
  await expect(sheet.getByRole("row", { name: /Kalpan Punamiya/ })).toContainText("0 days");

  // The admin adds a holiday inside the sprint.
  await page.goto("/settings");
  const planning = page.getByRole("region", { name: "Capacity planning" });
  await planning.getByLabel("Holiday date").fill("2026-11-03");
  await planning.getByLabel("Holiday name").fill("Founders' Day");
  await planning.getByRole("button", { name: "Add holiday" }).click();
  await expect(planning.getByText("Founders' Day is a holiday for every pod.")).toBeVisible();

  await page.goto("/pods/roadmap-2");
  await expect(bySkill).toContainText("Holidays1");
  await expect(bySkill.getByText("Founders' Day")).toBeVisible();
  // (10 - 1.5 - 1) x 70%
  await expect(sheet.getByRole("row", { name: /Mayank Awasthi/ })).toContainText("5.25 days");

  // Removing it gives the day back, and keeps the shared holiday calendar out of the other specs.
  await page.goto("/settings");
  await planning.getByRole("button", { name: "Remove Founders' Day" }).click();
  await expect(planning.getByText("Holiday removed.")).toBeVisible();
  await page.goto("/pods/roadmap-2");
  await expect(sheet.getByRole("row", { name: /Mayank Awasthi/ })).toContainText("5.95 days");

  // Another lead sees the sheet read only.
  await page.context().clearCookies();
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  await page.goto("/pods/roadmap-2");
  await expect(sheet.getByRole("row", { name: /Kalpan Punamiya/ })).toContainText("10 d");
  await expect(sheet.getByRole("spinbutton")).toHaveCount(0);
});
