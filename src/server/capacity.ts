import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leave, sprints } from "@/db/schema";
import { activePerson } from "./people";
import { assertCanEditPod } from "./permissions";
import { planCapacity, planCommitment, workingDays } from "./planning";
import type { PodPage } from "./pods";
import { getPlanningSettings, ValidationError } from "./settings";
import type { SprintView } from "./sprints";
import type { Viewer } from "./viewer";

type Sprint = typeof sprints.$inferSelect;

export type CapacitySheet = Awaited<ReturnType<typeof getCapacitySheet>>;

/**
 * Each member's capacity in a sprint and the pod's capacity per skill, with what they are computed from,
 * set against the skill-days committed in the pod's tickets for the sprint.
 */
export async function getCapacitySheet(page: PodPage, sprint: Sprint, tickets: SprintView["tickets"]) {
  const ids = page.members.map((m) => m.id);
  const [settings, rows] = await Promise.all([
    getPlanningSettings(),
    ids.length
      ? db
          .select()
          .from(leave)
          .where(and(eq(leave.sprintId, sprint.id), inArray(leave.personId, ids)))
      : [],
  ]);
  const plan = planCapacity({
    sprint,
    people: page.members.map(({ id, name, mainSkill, isLead }) => ({ id, name, mainSkill, isLead })),
    leave: new Map(rows.map((r) => [r.personId, r.days])),
    holidays: settings.holidays,
    focusFactor: settings.focusPercent / 100,
  });
  return { ...plan, focusPercent: settings.focusPercent, commitment: planCommitment(tickets, plan.skills) };
}

/** A lead enters one of their own people's leave for a sprint, in half days. Zero clears it. */
export async function setLeave(viewer: Viewer | null, personId: number, sprintId: number, days: number) {
  const person = await activePerson(personId);
  // Active people are always in a pod (people_active_in_a_pod).
  assertCanEditPod(viewer, person.podId!);
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
