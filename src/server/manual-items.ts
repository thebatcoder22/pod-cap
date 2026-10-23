import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jiraSettings, manualItems, people, pods, SKILLS, sprints, tickets, type Skill } from "@/db/schema";
import { withProficiency } from "./people";
import { assertCanEditPod } from "./permissions";
import { ValidationError } from "./settings";
import type { Viewer } from "./viewer";

export type ManualItemKind = (typeof manualItems.$inferSelect)["kind"];

export type ManualItemInput = {
  kind: ManualItemKind;
  title: string;
  personId: number | null;
  skill: Skill;
  days: number;
  /** Placeholders only: the ticket the work became. */
  jiraKey: string | null;
};

/** A pod's manual items in a sprint, oldest first. Whether each counts is the planning engine's call. */
export async function listManualItems(podId: number, sprintId: number) {
  const [[settings], rows] = await Promise.all([
    db.select({ site: jiraSettings.site }).from(jiraSettings),
    db
      .select({
        id: manualItems.id,
        kind: manualItems.kind,
        title: manualItems.title,
        personId: manualItems.personId,
        person: people.name,
        skill: manualItems.skill,
        days: manualItems.days,
        jiraKey: manualItems.jiraKey,
        // The pod whose sprint the linked ticket is in. A ticket in no pod is counted nowhere, so it takes nothing over.
        ticketPod: sql<string | null>`(
          select ${pods.name} from ${tickets} join ${pods} on ${pods.jiraPodValue} = ${tickets.pod}
          where ${tickets.key} = ${manualItems.jiraKey} and ${manualItems.sprintId} = any(${tickets.sprintIds})
        )`,
      })
      .from(manualItems)
      .leftJoin(people, eq(people.id, manualItems.personId))
      .where(and(eq(manualItems.podId, podId), eq(manualItems.sprintId, sprintId)))
      .orderBy(asc(manualItems.id)),
  ]);
  // Null when Jira is not connected, so there is no site to link to.
  return rows.map((r) => ({ ...r, url: r.jiraKey && settings ? `${settings.site}/browse/${r.jiraKey}` : null }));
}

/** A lead adds an item to their own pod's sprint. */
export async function addManualItem(
  viewer: Viewer | null,
  input: ManualItemInput & { podId: number; sprintId: number },
) {
  assertCanEditPod(viewer, input.podId);
  const [sprint] = Number.isInteger(input.sprintId)
    ? await db.select({ id: sprints.id }).from(sprints).where(eq(sprints.id, input.sprintId))
    : [];
  if (!sprint) throw new ValidationError("That sprint is no longer on the board. Sync, then try again.");
  const values = await validate(input.podId, input);
  const [{ id }] = await db
    .insert(manualItems)
    .values({ ...values, podId: input.podId, sprintId: sprint.id })
    .returning({ id: manualItems.id });
  return { id };
}

/** Everything but the pod and sprint can change. */
export async function updateManualItem(viewer: Viewer | null, id: number, input: ManualItemInput) {
  const item = await editable(viewer, id);
  await db
    .update(manualItems)
    .set(await validate(item.podId, input))
    .where(eq(manualItems.id, item.id));
}

export async function deleteManualItem(viewer: Viewer | null, id: number) {
  const item = await editable(viewer, id);
  await db.delete(manualItems).where(eq(manualItems.id, item.id));
}

async function editable(viewer: Viewer | null, id: number) {
  const [item] = Number.isInteger(id) ? await db.select().from(manualItems).where(eq(manualItems.id, id)) : [];
  if (!item) throw new ValidationError("That item was already deleted.");
  assertCanEditPod(viewer, item.podId);
  return item;
}

async function validate(podId: number, input: ManualItemInput) {
  if (input.kind !== "work" && input.kind !== "placeholder")
    throw new ValidationError("Pick non-Jira work or a placeholder.");
  const title = input.title.trim();
  if (!title) throw new ValidationError("Enter a title.");
  if (!SKILLS.includes(input.skill)) throw new ValidationError("Pick a skill.");
  // numeric(4, 1) holds up to 999.9; a sprint never needs more than 99.5.
  if (!Number.isInteger(input.days * 2) || input.days < 0.5 || input.days > 99.5)
    throw new ValidationError("Enter days in half days, from 0.5 to 99.5.");

  const jiraKey = input.jiraKey?.trim().toUpperCase() || null;
  if (jiraKey && input.kind !== "placeholder") throw new ValidationError("Only a placeholder links to a Jira ticket.");
  if (jiraKey && !/^DTP-\d+$/.test(jiraKey)) throw new ValidationError("Enter a DTP key, like DTP-163.");

  if (input.personId !== null) {
    const [row] = Number.isInteger(input.personId)
      ? await db
          .select({
            id: people.id,
            name: people.name,
            mainSkill: people.mainSkill,
            podId: people.podId,
            pod: pods.name,
          })
          .from(people)
          .innerJoin(pods, eq(pods.id, podId))
          .where(and(eq(people.id, input.personId), eq(people.active, true)))
      : [];
    if (!row) throw new ValidationError("That person is no longer in any pod.");
    if (row.podId !== podId) throw new ValidationError(`${row.name} is not in ${row.pod}.`);
    const [{ proficiency }] = await withProficiency([row]);
    if (!proficiency[input.skill]) throw new ValidationError(`${row.name} has 0% in ${input.skill}.`);
  }

  return { kind: input.kind, title, personId: input.personId, skill: input.skill, days: input.days, jiraKey };
}
