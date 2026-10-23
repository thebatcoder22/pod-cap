import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { snapshots } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// The specs share one database.
test.afterEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  await db.delete(snapshots);
  await db.$client.end();
});

test("the admin takes a snapshot a sync missed, and every lead sees the pod's trends", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await page.getByRole("link", { name: "Trends" }).click();
  await expect(page).toHaveURL(/\/pods\/roadmap-2\/trends$/);
  await expect(page.getByRole("heading", { name: "RoadMap 2 trends" })).toBeVisible();
  await expect(page.getByText("No snapshots yet.")).toBeVisible();

  // ABC sprint closed before the platform's first sync.
  const take = page.getByRole("region", { name: "Take a snapshot" });
  await take.getByLabel("Sprint").selectOption({ label: "ABC sprint" });
  await take.getByLabel("Snapshot").selectOption("start");
  await take.getByRole("button", { name: "Take snapshot" }).click();
  await expect(take).toContainText("Start snapshot taken.");

  const abc = page.getByRole("rowgroup", { name: "ABC sprint" });
  await expect(abc).toContainText(/Closed.*Start snapshot.*No close snapshot/);
  // Kalpan is RoadMap 2's only Data engineer; nothing was committed.
  await expect(abc.getByRole("row", { name: "ABC sprint Data" })).toContainText(/Data\s*\d+(\.\d+)?\s*Not estimated/);

  // Oct Spint 2 has not started, so it is not offered.
  await expect(take.getByLabel("Sprint").getByRole("option", { name: /Oct Spint 2/ })).toHaveCount(0);

  // Another lead sees it read only.
  await signInAs(page, "rahul@delightree.com");
  await page.goto("/pods/roadmap-2/trends");
  await expect(page.getByRole("rowgroup", { name: "ABC sprint" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Take a snapshot" })).toHaveCount(0);
});
