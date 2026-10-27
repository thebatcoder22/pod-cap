import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./sign-in-as";

async function signInToPod(page: Page, email: string) {
  await signInAs(page, email);
  await expect(page).toHaveURL(/\/pods\//);
}

test("the admin connects Jira without the token ever coming back to the browser", async ({ page }) => {
  await signInToPod(page, "aman@delightree.com");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByText("No API token saved yet.")).toBeVisible();

  await page.getByLabel("Site").fill("delightree.atlassian.net");
  await page.getByLabel("Account email").fill("aman@delightree.com");
  await page.getByLabel("API token").fill("ATATT-e2e-secret");
  await page.getByRole("region", { name: "Jira connection" }).getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Saved. The new token is in use.")).toBeVisible();
  await expect(page.getByText(/API token saved \d/)).toBeVisible();
  await expect(page.getByLabel("API token")).toHaveValue("");

  await page.reload();
  expect(await page.content()).not.toContain("ATATT-e2e-secret");
  await expect(page.getByLabel("Site")).toHaveValue("delightree.atlassian.net");
});

test("the admin gives a new lead edit rights and takes them away", async ({ page, browser }) => {
  await signInToPod(page, "aman@delightree.com");
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Remove aman@delightree.com" })).toHaveCount(0);

  await page.getByLabel("Email address to allow").fill("New.Lead@Delightree.com");
  await page.getByRole("region", { name: "Who can edit" }).getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("new.lead@delightree.com can now edit their pod.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "new.lead@delightree.com" })).toBeVisible();

  const lead = await browser.newPage();
  await signInToPod(lead, "new.lead@delightree.com");

  await page.getByRole("button", { name: "Remove new.lead@delightree.com" }).click();
  await expect(page.getByText("new.lead@delightree.com is now read only.")).toBeVisible();

  // Still signed in: everyone at Delightree can view.
  await lead.reload();
  await expect(lead).toHaveURL(/\/pods\//);
  await expect(lead.getByText("Read only")).toBeVisible();
});

test("a pod lead who is not admin cannot reach settings", async ({ page }) => {
  await signInToPod(page, "rahul@delightree.com");
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByLabel("API token")).toHaveCount(0);
});
