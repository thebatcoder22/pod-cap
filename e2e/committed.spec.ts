import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { jiraSettings } from "../src/db/schema";
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

  // Velocity in Oct Spint 2: three FE people and two BE people at 7 days each. DTP-4625 asks FE 6, BE 16.5.
  const fe = committed.getByRole("listitem", { name: "FE committed vs capacity" });
  await expect(fe).toContainText("6 of 21 days");
  await expect(fe).toContainText("15 days free");
  await expect(fe).toContainText("1 ticket not estimated");

  const be = committed.getByRole("listitem", { name: "BE committed vs capacity" });
  await expect(be).toContainText("16.5 of 14 days");
  await expect(be).toContainText("Over by 2.5 days");

  // No Data Eng Days anywhere, and no Data people in Velocity: not estimated, never 0.
  const data = committed.getByRole("listitem", { name: "Data committed vs capacity" });
  await expect(data).toContainText("No one2 tickets not estimated");
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
