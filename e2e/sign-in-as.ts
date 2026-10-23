import { expect, type Page } from "@playwright/test";

/** Signs in through the local test login and waits for the post-sign-in redirect. */
export async function signInAs(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Test sign-in email").fill(email);
  await page.getByRole("button", { name: "Test sign-in" }).click();
}
