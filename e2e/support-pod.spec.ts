import { expect, test } from "@playwright/test";
import { ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { podMembers } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// Back to the seeded 50/50 split, which the other specs' Velocity numbers assume.
test.afterEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  await db.update(podMembers).set({ share: 50 }).where(ne(podMembers.share, 100));
  await db.$client.end();
});

test("the Support pod shares Shadab and Nanagoud with Velocity, and the admin sets how their time splits", async ({
  page,
}) => {
  await signInAs(page, "aman@delightree.com");

  await page
    .getByRole("navigation", { name: "Pods" })
    .getByRole("link", { name: /Support/ })
    .click();
  await expect(page).toHaveURL(/\/pods\/support$/);
  await expect(page.getByRole("heading", { name: "Support", level: 1 })).toBeVisible();
  await expect(page.getByText("Led by Shadab Anjum")).toBeVisible();

  // Each of the two brings Support half of their 7 days; Shashwat is DevOps, a skill only this pod plans in.
  const sheet = page.getByRole("region", { name: "Capacity sheet" });
  await expect(sheet.getByRole("row", { name: /Shadab Anjum/ })).toContainText(/50% here, rest in Velocity.*3.5 days/);
  await expect(sheet.getByRole("row", { name: /Shashwat Mohite/ })).toContainText(/DevOps.*7 days/);
  const committed = page.getByRole("region", { name: "Committed vs capacity" });
  await expect(committed.getByRole("listitem", { name: "DevOps committed vs capacity" })).toContainText("7 days");
  await page.screenshot({ path: "test-results/support-pod.png", fullPage: true });

  await page.goto("/pods/velocity");
  await expect(
    page.getByRole("region", { name: "Committed vs capacity" }).getByRole("listitem", { name: /DevOps/ }),
  ).toHaveCount(0);

  await page.goto("/settings");
  const velocity = page.getByRole("region", { name: "Members" }).getByRole("region", { name: "Velocity" });
  await velocity.getByLabel("Share of Shadab Anjum's time in Velocity").fill("70");
  await velocity.getByLabel("Share of Shadab Anjum's time in Velocity").press("Enter");
  await expect(
    page.getByText("Velocity now plans with 70% of Shadab Anjum's time, and Support with 30%."),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/support-settings.png", fullPage: true });

  await page.goto("/pods/support");
  await expect(
    page.getByRole("region", { name: "Capacity sheet" }).getByRole("row", { name: /Shadab Anjum/ }),
  ).toContainText(/30% here, rest in Velocity.*2.1 days/);
});
