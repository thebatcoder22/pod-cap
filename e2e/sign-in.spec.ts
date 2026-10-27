import { expect, test } from "@playwright/test";
import { signInAs } from "./sign-in-as";

test("an allowlisted pod lead lands on their own pod page", async ({ page }) => {
  await signInAs(page, "rahul@delightree.com");

  await expect(page).toHaveURL(/\/pods\/velocity$/);
  await expect(page.getByRole("heading", { level: 1, name: "Velocity" })).toBeVisible();
  await expect(page.getByText("Your pod", { exact: true })).toBeVisible();
  for (const name of ["Rahul Saharan", "Manish Bisht", "Saikrishna Kotagiri"]) {
    await expect(page.getByRole("region", { name: "Members" }).getByRole("cell", { name })).toBeVisible();
  }

  await page.getByRole("navigation", { name: "Pods" }).getByRole("link", { name: "Atlas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Atlas" })).toBeVisible();
  await expect(page.getByText("Read only")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/pods/velocity");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a Delightree account that is not allowlisted views every pod read only", async ({ page }) => {
  await signInAs(page, "mayank@delightree.com");

  await expect(page).toHaveURL(/\/pods\//);
  await expect(page.getByText("Read only")).toBeVisible();
  await expect(page.getByText("Your pod", { exact: true })).toHaveCount(0);
});

test("an account outside Delightree sees the access-denied message", async ({ page }) => {
  await signInAs(page, "someone@gmail.com");

  await expect(page.getByText("You do not have access")).toBeVisible();
  await page.goto("/pods/roadmap-2");
  await expect(page).toHaveURL(/\/sign-in$/);
});
