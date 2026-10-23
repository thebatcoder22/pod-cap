import { expect, test, type Page } from "@playwright/test";

async function signInAs(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Test sign-in email").fill(email);
  await page.getByRole("button", { name: "Test sign-in" }).click();
}

test("an allowlisted pod lead lands on their own pod page", async ({ page }) => {
  await signInAs(page, "rahul@delightree.com");

  await expect(page).toHaveURL(/\/pods\/velocity$/);
  await expect(page.getByRole("heading", { level: 1, name: "Velocity" })).toBeVisible();
  await expect(page.getByText("Your pod", { exact: true })).toBeVisible();
  for (const name of ["Rahul Saharan", "Manish Bisht", "Saikrishna Kotagiri"]) {
    await expect(page.getByRole("cell", { name })).toBeVisible();
  }

  await page.getByRole("link", { name: "Atlas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Atlas" })).toBeVisible();
  await expect(page.getByText("Read only")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/pods/velocity");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a non-allowlisted account sees the access-denied message", async ({ page }) => {
  await signInAs(page, "mayank@delightree.com");

  await expect(page.getByText("You do not have access")).toBeVisible();
  await page.goto("/pods/roadmap-2");
  await expect(page).toHaveURL(/\/sign-in$/);
});
