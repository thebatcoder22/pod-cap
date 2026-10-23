import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { people, proficiencies } from "../src/db/schema";
import { E2E_DATABASE_URL } from "../playwright.config";
import { signInAs } from "./sign-in-as";

// Rahul is DTP-4625's assignee, which makes Velocity's BE overloaded. Manish gets 50% in BE.
async function setUp(on: boolean) {
  const db = drizzle(E2E_DATABASE_URL);
  await db
    .update(people)
    .set({ jiraAccountId: on ? "a-rahul" : null })
    .where(eq(people.name, "Rahul Saharan"));
  const [manish] = await db.select().from(people).where(eq(people.name, "Manish Bisht"));
  if (on) await db.insert(proficiencies).values({ personId: manish.id, skill: "BE", percent: 50 });
  else await db.delete(proficiencies).where(and(eq(proficiencies.personId, manish.id), eq(proficiencies.skill, "BE")));
  await db.$client.end();
}
test.beforeEach(() => setUp(true));
test.afterEach(() => setUp(false));

test("a lead sees who can pick up backlog tickets, stretch options, and who could cover an overloaded skill", async ({
  page,
}) => {
  await signInAs(page, "rahul@delightree.com");
  await expect(page).toHaveURL(/\/pods\/velocity$/);
  const panel = page.getByRole("region", { name: "Who can pick up more" });

  // Rahul is over capacity, so he is not offered anything.
  await expect(panel.getByRole("group").filter({ hasText: "Rahul Saharan" })).toHaveCount(0);

  const manish = panel.getByRole("group").filter({ hasText: "Manish Bisht" });
  await expect(manish).toContainText("7 days free, 2 tickets fit");
  await manish.getByText("Manish Bisht").click();
  const suggestions = manish.getByRole("list", { name: "Manish Bisht's suggestions" }).getByRole("listitem");
  // His own FE ticket first, then the BE bug as a stretch: 1 BE day at 50% is 2 days.
  await expect(suggestions.nth(0)).toContainText(/DTP-4710.*High.*FE 2d/);
  await expect(suggestions.nth(1)).toContainText(/DTP-4711.*Highest.*BE 1d.*Stretch, 2 days/);

  const nanagoud = panel.getByRole("group").filter({ hasText: "Nanagoud" });
  await nanagoud.getByText("Nanagoud").click();
  await expect(nanagoud.getByRole("listitem")).toHaveCount(1);
  await expect(nanagoud.getByRole("listitem")).toContainText(/DTP-4711.*BE 1d/);
  await expect(nanagoud.getByRole("listitem")).not.toContainText("Stretch");

  // BE: 16.5 committed against 14 days.
  const be = page.getByRole("listitem", { name: "Covering BE" });
  await expect(be).toContainText("BE over by 2.5 days");
  // His 7 free days at 50% are 3.5 BE days, more than the 2.5 missing.
  await expect(be).toContainText(/Manish Bisht\s*50%\s*2.5 skill-days/);
  await expect(be.getByRole("link", { name: "Atlas" })).toHaveAttribute("href", "/pods/atlas?sprint=432");
  await expect(be).toContainText(/Atlas\s*14 days/);
});
