import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { manualItems } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// The specs share one database.
test.afterEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  await db.delete(manualItems);
  await db.$client.end();
});

test("a lead adds, links, edits and deletes manual items, and they count against capacity", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await expect(page).toHaveURL(/\/pods\/roadmap-2$/);
  const items = page.getByRole("region", { name: "Manual items" });
  const add = items.getByRole("form", { name: "Add a manual item" });
  const load = page.getByRole("region", { name: "Who is working on what" });
  const fe = page.getByRole("listitem", { name: "FE committed vs capacity" });

  // RoadMap 2 has no tickets in Oct Spint 2, so the item alone is the commitment.
  await add.getByLabel("Title").fill("Interviews");
  await add.getByLabel("Person").selectOption({ label: "Mayank Awasthi" });
  await add.getByLabel("Days").fill("2");
  await add.getByRole("button", { name: "Add item" }).click();
  await expect(items.getByRole("listitem", { name: "Interviews" })).toContainText(
    /Non-Jira work.*Mayank Awasthi.*FE 2d/,
  );
  await expect(add.getByLabel("Title")).toHaveValue("");
  await expect(fe).toContainText("2 of 14 days");
  await expect(load.getByRole("group").filter({ hasText: "Mayank Awasthi" })).toContainText("2 of 7 days");

  // Aman has no FE, so the server refuses, and what was typed stays.
  await add.getByLabel("Title").fill("Pairing");
  await add.getByLabel("Person").selectOption({ label: "Aman Tyagi" });
  await add.getByLabel("Days").fill("1");
  await add.getByRole("button", { name: "Add item" }).click();
  await expect(add.getByRole("alert")).toHaveText("Aman Tyagi has 0% in FE.");
  await expect(add.getByLabel("Title")).toHaveValue("Pairing");

  // A placeholder for a ticket that is already in the sprint does not count twice.
  await add.getByLabel("Title").fill("Checklist reminders");
  await add.getByLabel("Kind").selectOption({ label: "Placeholder" });
  await add.getByLabel("Person").selectOption({ label: "No one yet" });
  await add.getByLabel("Days").fill("3");
  await add.getByLabel("Jira ticket, once it exists").fill("dtp-4625");
  await add.getByRole("button", { name: "Add item" }).click();
  const placeholder = items.getByRole("listitem", { name: "Checklist reminders" });
  await expect(placeholder).toContainText(
    /Placeholder.*DTP-4625.*In Velocity.s sprint, so the ticket.s estimate counts instead/,
  );
  await expect(fe).toContainText("2 of 14 days");

  // Unlinked, it reserves its days.
  await placeholder.getByRole("button", { name: "Edit Checklist reminders" }).click();
  const edit = items.getByRole("form", { name: "Edit Checklist reminders" });
  await edit.getByLabel("Jira ticket, once it exists").fill("");
  await edit.getByLabel("Days").fill("4.5");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(placeholder).toContainText(/Placeholder.*No one yet.*FE 4.5d/);
  await expect(fe).toContainText("6.5 of 14 days");

  await items.getByRole("button", { name: "Delete Interviews" }).click();
  await expect(items.getByRole("listitem", { name: "Interviews" })).toHaveCount(0);
  await expect(fe).toContainText("4.5 of 14 days");

  // Another lead sees the items, but cannot change them.
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  await page.goto("/pods/roadmap-2");
  await expect(items.getByRole("listitem", { name: "Checklist reminders" })).toBeVisible();
  await expect(items.getByRole("button")).toHaveCount(0);
});
