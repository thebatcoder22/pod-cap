import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { epicSizes } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// The specs share one database.
test.afterEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  await db.delete(epicSizes);
  await db.$client.end();
});

test("a lead sizes their pod's epics next to their tickets' skill-days, and other pods see them read-only", async ({
  page,
}) => {
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  const epics = page.getByRole("region", { name: "Epics" });

  // DTP-4625 asks FE 6, BE 16.5; Atlas's DTP-4702 in the same epic has no estimates.
  const checklists = epics.getByRole("row", { name: "Checklists v2" });
  await expect(checklists).toContainText(/In Progress.*2 tickets/);
  await expect(checklists).toContainText(/FE 6d.*BE 16.5d.*1 of 2 tickets not estimated/);
  await expect(checklists).toContainText("20 Nov");
  await expect(epics.getByRole("row", { name: "Site visit reports" })).toContainText(/Open.*1 ticket.*FE 2d.*Not set/);

  const size = checklists.getByLabel("T-shirt size of DTP-4610");
  await expect(size).toHaveValue("");
  await size.selectOption("M");
  await expect(size).toHaveValue("M");
  await expect(size).not.toHaveAttribute("aria-busy", "true");
  // Still M once saved, not reset by the form.
  await page.waitForLoadState("networkidle");
  await expect(size).toHaveValue("M");
  await page.reload();
  await expect(size).toHaveValue("M");

  // Atlas has work in it, so Atlas sees it, owned by Velocity and not editable.
  await signInAs(page, "abdullah@delightree.com");
  await expect(page).toHaveURL(/\/pods\/atlas$/);
  await expect(checklists).toContainText(/Velocity.s epic.*M/);
  await expect(epics.getByRole("combobox")).toHaveCount(0);
  await expect(epics.getByRole("row", { name: "Site visit reports" })).toHaveCount(0);
});

test("a lead sees what the PM still has to fill in on their epics in Jira", async ({ page }) => {
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  const pending = page.getByRole("region", { name: "Pending in Jira" });

  // DTP-4700 has no POD and no date in Jira; DTP-4610 has both.
  const siteVisits = pending.getByRole("listitem", { name: "Site visit reports" });
  await expect(siteVisits).toContainText(
    /DTP-4700.*Set its POD.*1 ticket in Velocity.*Set its Ready for Production Date/,
  );
  await expect(pending.getByRole("listitem", { name: "Checklists v2" })).toHaveCount(0);

  // Atlas's only epic is Velocity's to chase, so Atlas has nothing pending.
  await signInAs(page, "abdullah@delightree.com");
  await expect(page).toHaveURL(/\/pods\/atlas$/);
  await expect(page.getByRole("region", { name: "Epics" })).toBeVisible();
  await expect(pending).toHaveCount(0);
});

test("the sidebar opens every pod's pending Jira epics", async ({ page }) => {
  await signInAs(page, "abdullah@delightree.com");
  await page.getByRole("link", { name: "Pending in Jira" }).first().click();
  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.getByRole("heading", { name: "Pending in Jira", level: 1 })).toBeVisible();

  // Atlas has nothing pending, so only Velocity's list shows.
  const velocity = page.getByRole("region", { name: "Velocity" });
  await expect(velocity.getByRole("listitem", { name: "Site visit reports" })).toContainText(
    /Set its POD.*1 ticket in Velocity.*Set its Ready for Production Date/,
  );
  await expect(page.getByRole("region", { name: /Atlas/ })).toHaveCount(0);
});
