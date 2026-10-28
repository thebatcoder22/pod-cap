import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leave, sprints } from "@/db/schema";
import { listManualItems } from "./manual-items";
import { activePerson, assertCanEditPerson, linkedPeopleOutside } from "./people";
import { planCapacity, planCommitment, planLoad, planManualItems, workingDays } from "./planning";
import type { PodPage } from "./pods";
import { getPlanningSettings, ValidationError } from "./settings";
import { getTicketsElsewhere, type SprintView } from "./sprints";
import type { Viewer } from "./viewer";

type Sprint = typeof sprints.$inferSelect;

export type CapacitySheet = Awaited<ReturnType<typeof getCapacitySheet>>;

/**
 * Each member's capacity in a sprint and the pod's capacity per skill, with what they are computed from,
 * set against the skill-days committed in the pod's tickets and manual items for the sprint, and who those
 * skill-days fall to.
 */
export async function getCapacitySheet(page: PodPage, sprint: Sprint, tickets: SprintView["tickets"]) {
  const ids = page.members.map((m) => m.id);
  const [settings, rows, others, items, elsewhere] = await Promise.all([
    getPlanningSettings(),
    ids.length
      ? db
          .select()
          .from(leave)
          .where(and(eq(leave.sprintId, sprint.id), inArray(leave.personId, ids)))
      : [],
    linkedPeopleOutside(page.pod.id),
    listManualItems(page.pod.id, sprint.id),
    getTicketsElsewhere(page.pod.jiraPodOptionId, sprint.id),
  ]);
  const manual = planManualItems(items);
  const counting = manual.filter((i) => i.counts);
  const plan = planCapacity({
    sprint,
    people: page.members,
    leave: new Map(rows.map((r) => [r.personId, r.days])),
    holidays: settings.holidays,
    focusFactor: settings.focusPercent / 100,
  });
  return {
    ...plan,
    focusPercent: settings.focusPercent,
    items: manual,
    commitment: planCommitment(tickets, counting, plan.skills),
    load: planLoad(tickets, counting, plan.people, new Map(others.map((p) => [p.jiraAccountId, p])), elsewhere),
  };
}

/** A lead enters one of their own people's leave for a sprint, in half days. Zero clears it. */
export async function setLeave(viewer: Viewer | null, personId: number, sprintId: number, days: number) {
  const person = await activePerson(personId);
  // Leave is the person's, so it counts in each of their pods.
  await assertCanEditPerson(viewer, person.id);
  const [sprint] = Number.isInteger(sprintId) ? await db.select().from(sprints).where(eq(sprints.id, sprintId)) : [];
  if (!sprint) throw new ValidationError("That sprint is no longer on the board. Sync, then try again.");

  const max = workingDays(sprint);
  if (!Number.isInteger(days * 2) || days < 0 || days > max) {
    throw new ValidationError(`Enter leave in half days, from 0 to ${max}.`);
  }

  const key = and(eq(leave.personId, person.id), eq(leave.sprintId, sprint.id));
  if (days === 0) await db.delete(leave).where(key);
  else
    await db
      .insert(leave)
      .values({ personId: person.id, sprintId: sprint.id, days })
      .onConflictDoUpdate({ target: [leave.personId, leave.sprintId], set: { days } });
}
