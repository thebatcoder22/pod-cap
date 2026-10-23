import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./sign-in-as";

async function openSettings(page: Page) {
  await signInAs(page, "aman@delightree.com");
  await expect(page).toHaveURL(/\/pods\//);
  await page.goto("/settings");
}

test("the admin adds a new hire from the No pod yet list, then removes them", async ({ page }) => {
  await openSettings(page);
  const noPod = page.getByRole("region", { name: "No pod yet" });
  await expect(noPod.getByText("Priya Nair")).toBeVisible();
  await expect(noPod.getByText("On 1 DTP ticket")).toBeVisible();

  await noPod.getByLabel("Pod for Priya Nair").selectOption({ label: "Atlas" });
  await noPod.getByLabel("Main skill for Priya Nair").selectOption("FE");
  await noPod.getByRole("button", { name: "Add Priya Nair" }).click();
  await expect(page.getByText("Priya Nair joined Atlas.")).toBeVisible();
  await expect(noPod.getByRole("listitem").filter({ hasText: "Priya Nair" })).toHaveCount(0);

  await page.goto("/pods/atlas");
  await expect(page.getByRole("region", { name: "Members" }).getByRole("cell", { name: "Priya Nair" })).toBeVisible();

  await page.goto("/settings");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove Priya Nair" }).click();
  await expect(page.getByText("Priya Nair was removed and no longer counts toward any pod.")).toBeVisible();
  // Linked still, so their old ticket does not list them as new again.
  await expect(noPod.getByRole("listitem").filter({ hasText: "Priya Nair" })).toHaveCount(0);

  await page.goto("/pods/atlas");
  await expect(page.getByRole("region", { name: "Members" })).not.toContainText("Priya Nair");
});

test("the admin confirms a Jira match and moves a person between pods", async ({ page }) => {
  await openSettings(page);
  const confirm = page.getByRole("region", { name: "Confirm Jira accounts" });
  // The one Jira Rahul matches Rahul Saharan by full name, so the other Rahul is not offered it.
  await expect(
    confirm
      .getByRole("combobox", { name: "Jira account for Rahul Saharan" })
      .locator("optgroup[label=Suggested] option"),
  ).toHaveText(["Rahul Saharan"]);
  await expect(
    confirm.getByRole("combobox", { name: "Jira account for Rahul Lanjewar" }).locator("optgroup[label=Suggested]"),
  ).toHaveCount(0);
  await confirm
    .getByRole("combobox", { name: "Jira account for Rahul Saharan" })
    .selectOption({ label: "Rahul Saharan" });
  await confirm.getByRole("button", { name: "Confirm Jira account for Rahul Saharan" }).click();
  await expect(page.getByText("Rahul Saharan is linked to Rahul Saharan in Jira.")).toBeVisible();
  await expect(confirm.getByRole("combobox", { name: "Jira account for Rahul Saharan" })).toHaveCount(0);
  await expect(
    confirm.getByRole("combobox", { name: "Jira account for Rahul Lanjewar" }).locator("optgroup[label=Suggested]"),
  ).toHaveCount(0);

  const members = page.getByRole("region", { name: "Members" });
  await members.getByLabel("Pod for Mayank Awasthi").selectOption({ label: "Velocity" });
  await members.getByRole("button", { name: "Move Mayank Awasthi", exact: true }).click();
  await expect(page.getByText("Mayank Awasthi moved to Velocity.")).toBeVisible();
  await expect(members.getByRole("region", { name: "Velocity" })).toContainText("Mayank Awasthi");
  await expect(members.getByRole("region", { name: "RoadMap 2" })).not.toContainText("Mayank Awasthi");
});
