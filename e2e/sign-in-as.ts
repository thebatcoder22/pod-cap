import { expect, type Page } from "@playwright/test";

/** Signs in through the local test login and waits for the post-sign-in redirect. Signs out whoever was in first. */
export async function signInAs(page: Page, email: string) {
  // Leaving the page aborts its in-flight requests first: a late response would set the old session cookie again.
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Test sign-in email").fill(email);
  await page.getByRole("button", { name: "Test sign-in" }).click();
}
