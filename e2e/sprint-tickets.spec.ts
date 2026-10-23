import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { jiraSettings } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

test("a lead sees their pod's tickets for the upcoming sprint and can switch sprints", async ({ page }) => {
  // The site the links point at; the token is never used here.
  const db = drizzle(E2E_DATABASE_URL);
  const site = { site: "https://delightree.atlassian.net", email: "aman@delightree.com" };
  const values = { id: 1, ...site, tokenCiphertext: "unused", tokenUpdatedAt: new Date() };
  await db.insert(jiraSettings).values(values).onConflictDoUpdate({ target: jiraSettings.id, set: site });
  await db.$client.end();

  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);

  await expect(page.getByText("Last synced 23 Oct 2026, 14:00")).toBeVisible();
  const picker = page.getByLabel("Sprint", { exact: true });
  await expect(picker).toHaveValue("432");
  await expect(page.getByText("26 Oct to 6 Nov")).toBeVisible();

  const key = page.getByRole("link", { name: "DTP-4625" });
  await expect(key).toHaveAttribute("href", "https://delightree.atlassian.net/browse/DTP-4625");
  await expect(page.getByRole("row", { name: /DTP-4625/ })).toContainText("Rahul Saharan");
  await expect(page.getByRole("row", { name: /DTP-4395/ })).toContainText("Shahid Khan");
  await expect(page.getByRole("link", { name: "Epic: Checklists v2" })).toBeVisible();

  await picker.selectOption({ label: "ABC sprint" });
  await expect(page).toHaveURL(/\?sprint=332$/);
  await expect(page.getByText("No Velocity tickets in ABC sprint.")).toBeVisible();
});

test("a failed sync explains why and keeps the last good data", async ({ page }) => {
  // No Jira connection, so the sync fails the same way every run, without calling Atlassian.
  const db = drizzle(E2E_DATABASE_URL);
  await db.delete(jiraSettings);
  await db.$client.end();

  await signInAs(page, "shikhar@delightree.com");
  await expect(page).toHaveURL(/\/pods\/roadmap-1$/);
  await page.goto("/pods/velocity");

  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText("Sync failed.")).toBeVisible();
  const banner = page.getByRole("alert").filter({ hasText: "Jira sync" });
  await expect(banner).toContainText("Jira is not connected yet. The admin can connect it in Settings.");
  await expect(banner).toContainText("Showing data from the last successful sync, 23 Oct 2026, 14:00.");
  // Still listed, though with no Jira site to link to.
  await expect(page.getByRole("row", { name: /DTP-4625/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "DTP-4625" })).toHaveCount(0);
});
