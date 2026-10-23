import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { people } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// What a sync would link. Unlinked after, as the people spec confirms Rahul's account itself.
const links = { "Rahul Saharan": "a-rahul", "Shahid Khan": "a-shahid" };
async function link(on: boolean) {
  const db = drizzle(E2E_DATABASE_URL);
  for (const [name, id] of Object.entries(links)) {
    await db
      .update(people)
      .set({ jiraAccountId: on ? id : null })
      .where(eq(people.name, name));
  }
  await db.$client.end();
}
test.beforeEach(() => link(true));
test.afterEach(() => link(false));

test("a lead sees each person's load, opens a person, and sees unassigned work and cross-pod help", async ({
  page,
}) => {
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  const load = page.getByRole("region", { name: "Who is working on what" });

  // DTP-4625 is Rahul's as assignee: its BE 16.5 days are his, against 7 days of capacity.
  const rahul = load.getByRole("group").filter({ hasText: "Rahul Saharan" });
  await expect(rahul).toContainText("16.5 of 7 days");
  await expect(rahul).toContainText("Over by 9.5 days");
  await expect(load.getByRole("group").filter({ hasText: "Manish Bisht" })).toContainText("7 days free");

  await rahul.getByText("Rahul Saharan").click();
  const tickets = rahul.getByRole("list", { name: "Rahul Saharan's tickets" });
  await expect(tickets.getByRole("listitem")).toHaveCount(1);
  await expect(tickets.getByRole("listitem")).toContainText(/DTP-4625.*In-Dev.*BE 16.5d/);

  // Nobody on DTP-4625 does FE.
  const unassigned = load.getByRole("region", { name: /Unassigned work/ });
  await expect(unassigned).toContainText("Unassigned work, 6 skill-days");
  await expect(unassigned.getByRole("listitem")).toContainText(/DTP-4625.*No owner can do FE.*FE 6d/);
  await expect(page.getByRole("row", { name: /DTP-4625/ })).toContainText("No owner can do FE");

  // Shahid is in RoadMap 1.
  await expect(page.getByRole("row", { name: /DTP-4395/ })).toContainText("Cross-pod help: Shahid Khan (RoadMap 1)");
});
