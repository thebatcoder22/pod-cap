import { expect, test } from "@playwright/test";
import { signInAs } from "./sign-in-as";

test("a lead sets proficiency for their own people, and other leads see it read only", async ({ page }) => {
  await signInAs(page, "aman@delightree.com");
  await expect(page).toHaveURL(/\/pods\/roadmap-2$/);
  const members = page.getByRole("region", { name: "Members" });
  const kalpan = members.getByRole("row", { name: /Kalpan Punamiya/ });

  // Data is Kalpan's main skill: fixed at 100%, with nothing to edit.
  await expect(kalpan.getByRole("cell", { name: /^100%.*main skill$/ })).toBeVisible();
  await expect(members.getByLabel("Data proficiency for Kalpan Punamiya")).toHaveCount(0);

  const fe = members.getByLabel("FE proficiency for Kalpan Punamiya");
  await expect(fe).toHaveValue("0");
  await fe.fill("40");
  // Wait for the save itself: the typed value shows at once, and reloading early would race it.
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), fe.press("Enter")]);
  await page.reload();
  await expect(members.getByLabel("FE proficiency for Kalpan Punamiya")).toHaveValue("40");

  // Out of range is refused in the browser, and leaving the field undoes it.
  const ai = members.getByLabel("AI proficiency for Kalpan Punamiya");
  await ai.fill("150");
  await ai.press("Enter");
  expect(await ai.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  await ai.blur();
  await expect(ai).toHaveValue("0");

  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  await page.goto("/pods/roadmap-2");
  await expect(kalpan.getByRole("cell", { name: "40%" })).toBeVisible();
  await expect(members.getByRole("spinbutton")).toHaveCount(0);
});
