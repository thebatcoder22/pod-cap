import { expect, test } from "@playwright/test";
import { signInAs } from "./sign-in-as";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.use({ colorScheme: "light" });

test("the theme toggle pins light or dark over the OS setting and remembers it", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await expect(page).toHaveURL(/\/pods\//);

  await expect(page.getByRole("button", { name: "Theme: system" })).toBeVisible();
  expect(await background(page)).toBe("rgb(251, 251, 251)");

  await page.getByRole("button", { name: "Theme: system" }).click();
  await page.getByRole("button", { name: "Theme: light" }).click();
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
  expect(await background(page)).toBe("rgb(13, 13, 15)");

  // The pinned theme survives a reload and wins over the OS.
  await page.reload();
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
  expect(await background(page)).toBe("rgb(13, 13, 15)");

  // Back to system follows the OS again.
  await page.getByRole("button", { name: "Theme: dark" }).click();
  await expect(page.getByRole("button", { name: "Theme: system" })).toBeVisible();
  expect(await background(page)).toBe("rgb(251, 251, 251)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background(page)).toBe("rgb(13, 13, 15)");
});
