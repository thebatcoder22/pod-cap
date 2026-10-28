import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import { jiraSettings, tickets } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// The site the links point at; the token is never used. Removed after, as the settings spec starts unconnected.
test.beforeEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  const values = { site: "https://delightree.atlassian.net", email: "aman@delightree.com" };
  await db.insert(jiraSettings).values({ ...values, tokenCiphertext: "unused", tokenUpdatedAt: new Date() });
  await db.$client.end();
});
test.afterEach(async () => {
  const db = drizzle(E2E_DATABASE_URL);
  await db.delete(jiraSettings);
  await db.$client.end();
});

test("a lead sees committed skill-days against capacity, the overloaded skill and the unestimated tickets", async ({
  page,
}) => {
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  const committed = page.getByRole("region", { name: "Committed vs capacity" });

  // Velocity in Oct Spint 2: three FE people and two BE people at 7 days each, but Shadab (FE) and Nanagoud (BE)
  // bring half of theirs, being in Support too. DTP-4625 asks FE 6, BE 16.5.
  const fe = committed.getByRole("listitem", { name: "FE committed vs capacity" });
  await expect(fe).toContainText("6 of 17.5 days");
  await expect(fe).toContainText("11.5 days free");
  // Which tickets lack estimates is left to the No estimates card, not repeated on every skill.
  await expect(fe).not.toContainText("not estimated");

  const be = committed.getByRole("listitem", { name: "BE committed vs capacity" });
  await expect(be).toContainText("16.5 of 10.5 days");
  await expect(be).toContainText("Over by 6 days");

  // No Data Eng Days anywhere, and no Data people in Velocity: not estimated, never 0.
  const data = committed.getByRole("listitem", { name: "Data committed vs capacity" });
  await expect(data).toContainText("No oneNot estimated");
  await expect(data).not.toContainText("0 of");

  const unestimated = page.getByRole("region", { name: "No estimates" });
  await expect(unestimated.getByRole("listitem")).toHaveCount(1);
  await expect(unestimated.getByRole("link", { name: /DTP-4395/ })).toHaveAttribute(
    "href",
    "https://delightree.atlassian.net/browse/DTP-4395",
  );
  await expect(page.getByRole("row", { name: /DTP-4625/ })).toContainText("FE 6dBE 16.5d");
  await expect(page.getByRole("row", { name: /DTP-4395/ })).toContainText("Not estimated");
});

test("a long list of unestimated tickets stays as tall as the capacity card, with the rest behind +N more", async ({
  page,
}) => {
  // Fifteen more unestimated Velocity tickets in Oct Spint 2, on top of DTP-4395.
  const keys = Array.from({ length: 15 }, (_, i) => `DTP-${9000 + i}`);
  const db = drizzle(E2E_DATABASE_URL);
  await db.insert(tickets).values(
    keys.map((key) => ({
      key,
      summary: `Unestimated story ${key}`,
      type: "Story",
      status: "To Do",
      statusCategory: "new" as const,
      podOptionId: "11230",
      sprintIds: [432],
      devOwners: [],
    })),
  );
  try {
    await signInAs(page, "rahul@delightree.com");
    await expect(page).toHaveURL(/\/pods\/velocity$/);
    const committed = page.getByRole("region", { name: "Committed vs capacity" });
    const unestimated = page.getByRole("region", { name: "No estimates" });
    await expect(unestimated).toContainText("16 tickets");

    const more = unestimated.getByRole("button", { name: /^\+\d+ more$/ });
    await expect(more).toBeVisible();
    const hidden = Number((await more.innerText()).match(/\d+/)![0]);
    await expect(unestimated.getByRole("listitem")).toHaveCount(16 - hidden);
    expect((await unestimated.boundingBox())!.height).toBeCloseTo((await committed.boundingBox())!.height, 0);

    await more.click();
    await expect(unestimated.getByRole("listitem")).toHaveCount(16);
    await unestimated.getByRole("button", { name: "Show less" }).click();
    await expect(unestimated.getByRole("listitem")).toHaveCount(16 - hidden);

    // One column on a phone: nothing beside it to match, so every ticket shows.
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(unestimated.getByRole("listitem")).toHaveCount(16);
    await expect(unestimated.getByRole("button")).toHaveCount(0);
  } finally {
    await db.delete(tickets).where(inArray(tickets.key, keys));
    await db.$client.end();
  }
});
