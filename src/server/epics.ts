import { eq, getTableColumns, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { epics, epicSizes, jiraSettings, pods, tickets, TSHIRT_SIZES, type TshirtSize } from "@/db/schema";
import { ForbiddenError, assertCanEditPod } from "./permissions";
import { planEpics } from "./planning";
import { ticketPodOptionId } from "./sprints";
import { ValidationError } from "./settings";
import type { Viewer } from "./viewer";

export type EpicList = Awaited<ReturnType<typeof getEpicList>>;

const CATEGORY_ORDER = { indeterminate: 0, new: 1, done: 2 };
const keyNumber = (key: string) => Number(key.split("-")[1]);

// ponytail: plans every epic on each page view (DTP has ~25); filter by pod in SQL if it shows in page times.
async function planAll(key?: string) {
  const [rows, children, podRows, [settings]] = await Promise.all([
    db
      .select({ ...getTableColumns(epics), size: epicSizes.size })
      .from(epics)
      .leftJoin(epicSizes, eq(epicSizes.epicKey, epics.key))
      .where(key ? eq(epics.key, key) : undefined),
    db
      .select({ epicKey: tickets.epicKey, podOptionId: ticketPodOptionId, estimates: tickets.estimates })
      .from(tickets)
      .where(key ? eq(tickets.epicKey, key) : isNotNull(tickets.epicKey)),
    db.select({ id: pods.id, name: pods.name, slug: pods.slug, jiraPodOptionId: pods.jiraPodOptionId }).from(pods),
    db.select({ site: jiraSettings.site }).from(jiraSettings),
  ]);
  return { plans: planEpics(rows, children, podRows), site: settings?.site ?? null };
}

/** What a PM fills in on a Jira epic for planning to work. */
export type JiraGap = "POD" | "Ready for Production Date";

/**
 * The epics a pod owns or has tickets in: in progress first, then to do, then done, each by Ready for
 * Production Date, soonest first.
 */
export async function getEpicList(pod: { id: number }) {
  return epicList(await planAll(), pod);
}

/** Each pod's open epics with something still to fill in on Jira, the viewer's pods first. Pods with none are left out. */
export async function getPendingInJira(viewerPodIds: number[]) {
  const [planned, podRows] = await Promise.all([
    planAll(),
    db.select({ id: pods.id, name: pods.name, slug: pods.slug }).from(pods).orderBy(pods.id),
  ]);
  return podRows
    .toSorted((a, b) => Number(viewerPodIds.includes(b.id)) - Number(viewerPodIds.includes(a.id)))
    .map((pod) => ({ pod, epics: epicList(planned, pod).filter((e) => e.missing.length) }))
    .filter((p) => p.epics.length);
}

function epicList({ plans, site }: Awaited<ReturnType<typeof planAll>>, pod: { id: number }) {
  return plans
    .filter((e) => e.owner?.id === pod.id || e.pods.some((p) => p.id === pod.id))
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.statusCategory] - CATEGORY_ORDER[b.statusCategory] ||
        (a.readyForProductionDate ?? "9999").localeCompare(b.readyForProductionDate ?? "9999") ||
        keyNumber(a.key) - keyNumber(b.key),
    )
    .map((e) => ({
      key: e.key,
      // Null when Jira is not connected, so there is no site to link to.
      url: site ? `${site}/browse/${e.key}` : null,
      summary: e.summary,
      status: e.status,
      statusCategory: e.statusCategory,
      readyForProductionDate: e.readyForProductionDate,
      size: e.size,
      owner: e.owner && { id: e.owner.id, name: e.owner.name, slug: e.owner.slug },
      pods: e.pods.map(({ name, slug, tickets }) => ({ name, slug, tickets })),
      missing: missing(e, pod.id),
      tickets: e.tickets,
      skills: e.skills,
      unestimated: e.unestimated,
    }));
}

/** Gaps on an open epic this pod owns or shares; a done epic, or another pod's, is not this pod's to chase. */
function missing(
  e: {
    podOptionId: string | null;
    readyForProductionDate: string | null;
    statusCategory: string;
    owner: { id: number } | null;
  },
  podId: number,
): JiraGap[] {
  if (e.statusCategory === "done" || (e.owner && e.owner.id !== podId)) return [];
  return [
    ...(e.podOptionId ? [] : (["POD"] as const)),
    ...(e.readyForProductionDate ? [] : (["Ready for Production Date"] as const)),
  ];
}

/** A lead sets the T-shirt size of an epic their pod owns. Null clears it. */
export async function setEpicSize(viewer: Viewer | null, key: string, size: TshirtSize | null) {
  if (size !== null && !TSHIRT_SIZES.includes(size)) throw new ValidationError("Pick S, M, L or XL.");
  const {
    plans: [epic],
  } = await planAll(key);
  if (!epic) throw new ValidationError("That epic is no longer in Jira. Sync, then try again.");
  if (!epic.owner) {
    throw new ForbiddenError(
      epic.pods.length > 1
        ? `${epic.key} has work in more than one pod. Set its POD in Jira to size it.`
        : `${epic.key} is in no pod. Set its POD in Jira to size it.`,
    );
  }
  assertCanEditPod(viewer, epic.owner.id);

  if (size === null) await db.delete(epicSizes).where(eq(epicSizes.epicKey, epic.key));
  else
    await db
      .insert(epicSizes)
      .values({ epicKey: epic.key, size })
      .onConflictDoUpdate({ target: epicSizes.epicKey, set: { size } });
}
