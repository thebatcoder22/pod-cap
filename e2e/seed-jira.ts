import { sprints, syncRuns, tickets } from "../src/db/schema";
import type { Db } from "../src/db";

/** What a successful sync of DTP leaves behind, trimmed to a few tickets. */
export async function seedSyncedJira(db: Db) {
  await db.insert(sprints).values([
    {
      id: 432,
      name: "Oct Spint 2",
      state: "future",
      startDate: new Date("2026-10-26T04:30:00.000Z"),
      endDate: new Date("2026-11-06T14:30:00.000Z"),
    },
    {
      id: 332,
      name: "ABC sprint",
      state: "closed",
      startDate: new Date("2026-10-12T23:49:03.030Z"),
      endDate: new Date("2026-10-26T23:49:31.000Z"),
      completeDate: new Date("2026-10-14T04:33:00.677Z"),
    },
  ]);
  await db.insert(tickets).values([
    {
      key: "DTP-4625",
      summary: "Checklist reminders for location owners",
      type: "Story",
      status: "In-Dev",
      statusCategory: "indeterminate",
      priority: "High",
      pod: "Velocity",
      sprintIds: [432],
      assignee: { accountId: "a-rahul", displayName: "Rahul Saharan" },
      devOwners: [],
      epicKey: "DTP-4610",
      epicSummary: "Checklists v2",
      estimates: { FE: 6, BE: 16.5 },
    },
    {
      key: "DTP-4395",
      summary: "Bulk edit for training paths",
      type: "Story",
      status: "To Do",
      statusCategory: "new",
      priority: "Medium",
      pod: "Velocity",
      sprintIds: [432],
      assignee: null,
      devOwners: [{ accountId: "a-shahid", displayName: "Shahid Khan" }],
      readyForProductionDate: "2026-11-06",
    },
    {
      // A new hire who is on a ticket but in no pod yet.
      key: "DTP-4702",
      summary: "Rebuild the location picker",
      type: "Story",
      status: "To Do",
      statusCategory: "new",
      priority: "Medium",
      pod: "Atlas",
      sprintIds: [432],
      assignee: null,
      devOwners: [{ accountId: "a-priya", displayName: "Priya Nair" }],
    },
    // Velocity's backlog: in no sprint, for the pick-up panel.
    {
      key: "DTP-4710",
      summary: "Show overdue checklists on the dashboard",
      type: "Story",
      status: "To Do",
      statusCategory: "new",
      priority: "High",
      pod: "Velocity",
      assignee: null,
      devOwners: [],
      estimates: { FE: 2 },
    },
    {
      key: "DTP-4711",
      summary: "Checklist export times out for large locations",
      type: "Bug",
      status: "To Do",
      statusCategory: "new",
      priority: "Highest",
      pod: "Velocity",
      assignee: null,
      devOwners: [],
      estimates: { BE: 1 },
    },
  ]);
  const at = new Date("2026-10-23T08:30:00.000Z");
  await db.insert(syncRuns).values({ startedAt: at, finishedAt: at, status: "succeeded" });
}
