import { asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { pods, snapshots, sprints, SNAPSHOT_KINDS, type SnapshotKind } from "@/db/schema";
import { getCapacitySheet } from "./capacity";
import { assertAdmin } from "./permissions";
import { planSnapshot, planTrend } from "./planning";
import { getPodPage } from "./pods";
import { ValidationError } from "./settings";
import { getSprintView } from "./sprints";
import type { Viewer } from "./viewer";

type Sprint = typeof sprints.$inferSelect;

/** Freezes one pod's capacity and commitment in a sprint, and at close what got done. Overwrites an earlier one. */
async function snapshotPod(slug: string, sprint: Sprint, kind: SnapshotKind) {
  const page = (await getPodPage(slug))!;
  const view = await getSprintView(page.pod.jiraPodValue, String(sprint.id));
  const sheet = await getCapacitySheet(page, sprint, view.tickets);
  const rows = planSnapshot(kind, sheet.commitment.skills, view.tickets).map((k) => ({
    ...k,
    podId: page.pod.id,
    sprintId: sprint.id,
    sprintName: sprint.name,
    sprintStartDate: sprint.startDate,
    sprintEndDate: sprint.endDate,
    kind,
  }));
  await db
    .insert(snapshots)
    .values(rows)
    .onConflictDoUpdate({
      target: [snapshots.podId, snapshots.sprintId, snapshots.kind, snapshots.skill],
      set: {
        sprintName: sql`excluded.sprint_name`,
        sprintStartDate: sql`excluded.sprint_start_date`,
        sprintEndDate: sql`excluded.sprint_end_date`,
        capacity: sql`excluded.capacity`,
        committed: sql`excluded.committed`,
        completed: sql`excluded.completed`,
        takenAt: sql`now()`,
      },
    });
}

/**
 * Every pod's snapshot of a sprint, as the sync takes them when it sees the sprint start or close. One pod failing
 * does not stop the others; the names of those that failed come back.
 */
export async function snapshotAllPods(sprintId: number, kind: SnapshotKind) {
  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
  const all = await db.select({ slug: pods.slug, name: pods.name }).from(pods);
  const failed: string[] = [];
  for (const { slug, name } of all) await snapshotPod(slug, sprint, kind).catch(() => failed.push(name));
  return failed;
}

/** The admin takes or retakes one pod's snapshot, e.g. when a sync missed the sprint starting or closing. */
export async function takeSnapshot(viewer: Viewer | null, podId: number, sprintId: number, kind: SnapshotKind) {
  assertAdmin(viewer);
  if (!SNAPSHOT_KINDS.includes(kind)) throw new ValidationError("Pick a start or a close snapshot.");
  const [[pod], [sprint]] = await Promise.all([
    Number.isInteger(podId) ? db.select({ slug: pods.slug }).from(pods).where(eq(pods.id, podId)) : [],
    Number.isInteger(sprintId) ? db.select().from(sprints).where(eq(sprints.id, sprintId)) : [],
  ]);
  if (!pod) throw new ValidationError("That pod does not exist.");
  if (!sprint) throw new ValidationError("That sprint is no longer on the board. Sync, then try again.");
  if (kind === "start" && sprint.state === "future") {
    throw new ValidationError(`${sprint.name} has not started yet.`);
  }
  if (kind === "close" && sprint.state !== "closed") {
    throw new ValidationError(`${sprint.name} has not closed yet.`);
  }
  await snapshotPod(pod.slug, sprint, kind);
}

export type Trend = Awaited<ReturnType<typeof getTrends>>[number];

/**
 * A pod's sprints with any snapshot, latest first: capacity and committed per skill as frozen at the start,
 * and completed as recorded at the close. A sprint since removed from the board keeps its history.
 */
export async function getTrends(podId: number) {
  const rows = await db
    .select({ snapshot: snapshots, state: sprints.state })
    .from(snapshots)
    .leftJoin(sprints, eq(sprints.id, snapshots.sprintId))
    .where(eq(snapshots.podId, podId))
    .orderBy(sql`${snapshots.sprintStartDate} desc nulls last`, asc(snapshots.sprintId));

  return [...Map.groupBy(rows, (r) => r.snapshot.sprintId).values()].map((rs) => {
    const of = (kind: SnapshotKind) => rs.flatMap((r) => (r.snapshot.kind === kind ? [r.snapshot] : []));
    const [start, close] = [of("start"), of("close")];
    const { sprintId, sprintName, sprintStartDate, sprintEndDate } = rs[0].snapshot;
    return {
      sprint: {
        id: sprintId,
        name: sprintName,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
        // Null once the sprint is off the board.
        state: rs[0].state,
      },
      startedAt: start[0]?.takenAt ?? null,
      closedAt: close[0]?.takenAt ?? null,
      ...planTrend(start, close),
    };
  });
}

/** The sprints the admin can snapshot: started ones, latest first. */
export async function snapshotableSprints() {
  return db
    .select({ id: sprints.id, name: sprints.name, state: sprints.state })
    .from(sprints)
    .where(ne(sprints.state, "future"))
    .orderBy(sql`${sprints.startDate} desc nulls last`, asc(sprints.id));
}
