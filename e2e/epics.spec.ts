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
  await page.context().clearCookies();
  await signInAs(page, "abdullah@delightree.com");
  await expect(page).toHaveURL(/\/pods\/atlas$/);
  await expect(checklists).toContainText(/Velocity.s epic.*M/);
  await expect(epics.getByRole("combobox")).toHaveCount(0);
  await expect(epics.getByRole("row", { name: "Site visit reports" })).toHaveCount(0);
});
