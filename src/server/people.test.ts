import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { fakeJira } from "../../tests/fake-jira";
import { db } from "@/db";
import { tickets, type JiraUser } from "@/db/schema";
import { addFromJira, confirmJiraAccount, getPeopleAdmin, movePerson, removePerson, type PeopleAdmin } from "./people";
import { ForbiddenError } from "./permissions";
import { getPodPage } from "./pods";
import { saveJiraSettings, ValidationError } from "./settings";
import { runSync } from "./sync";
import { viewerForEmail, type Viewer } from "./viewer";

// Jira account ids on the recorded DTP tickets.
const ACCOUNT = {
  aman: "712020:32635250-1878-49e5-bc85-7a3a44ef0b3f",
  rahulS: "712020:3d5a3bd2-92d5-4261-8ec3-120c80a6e2a0",
  rahulL: "712020:ac5c5701-c798-4ba0-a93d-98c44f812268",
  praveen: "712020:80ad7b87-4804-45aa-816f-7d533527e444",
  jatin: "712020:86bbadc3-723a-41a4-9794-12a41f54cf55",
};

/** Renames a Jira account everywhere it appears, as Jira would. */
function renameInJira(jira: ReturnType<typeof fakeJira>, accountId: string, displayName: string) {
  for (const { fields } of jira.issues) {
    const users = [fields.assignee, ...((fields.customfield_10777 as JiraUser[] | null) ?? [])] as (JiraUser | null)[];
    for (const u of users) if (u?.accountId === accountId) u.displayName = displayName;
  }
}

let aman: Viewer;
beforeEach(async () => {
  await resetDb();
  aman = (await viewerForEmail("aman@delightree.com"))!;
  await saveJiraSettings(aman, { site: "https://delightree.atlassian.net", email: "aman@delightree.com", token: "t" });
});

const member = (admin: PeopleAdmin, name: string) => admin.members.find((m) => m.name === name);
const pending = (admin: PeopleAdmin, name: string) => admin.toConfirm.find((p) => p.name === name);
const podMembers = async (slug: string) => (await getPodPage(slug))!.members.map((m) => m.name);
const podId = async (slug: string) => (await getPodPage(slug))!.pod.id;

describe("matching people to Jira accounts", () => {
  it("links seeded people whose name matches one Jira account exactly", async () => {
    await runSync(fakeJira().make);
    const admin = await getPeopleAdmin(aman);
    for (const [name, accountId] of [
      ["Rahul Saharan", ACCOUNT.rahulS],
      ["Rahul Lanjewar", ACCOUNT.rahulL],
    ]) {
      expect(member(admin, name)?.jira).toEqual({ accountId, displayName: name });
      expect(pending(admin, name)).toBeUndefined();
    }
  });

  it("links by email where Jira exposes it, whatever the display name", async () => {
    const jira = fakeJira();
    renameInJira(jira, ACCOUNT.aman, "AT");
    await runSync(jira.make);
    expect(member(await getPeopleAdmin(aman), "Aman Tyagi")?.jira).toEqual({
      accountId: ACCOUNT.aman,
      displayName: "AT",
    });
  });

  it("never auto-confirms the two Rahuls when Jira shows them both as Rahul", async () => {
    const jira = fakeJira();
    renameInJira(jira, ACCOUNT.rahulS, "Rahul");
    renameInJira(jira, ACCOUNT.rahulL, "Rahul");
    await runSync(jira.make);

    const admin = await getPeopleAdmin(aman);
    for (const name of ["Rahul Saharan", "Rahul Lanjewar"]) {
      expect(member(admin, name)?.jira).toBeNull();
      expect(
        pending(admin, name)
          ?.candidates.map((c) => c.accountId)
          .sort(),
      ).toEqual([ACCOUNT.rahulS, ACCOUNT.rahulL].sort());
    }
    // Either could be a new hire, so they stay addable too.
    expect(admin.noPod.map((u) => u.accountId)).toEqual(expect.arrayContaining([ACCOUNT.rahulS, ACCOUNT.rahulL]));
  });

  it("suggests a partial name match for review instead of linking it", async () => {
    const jira = fakeJira();
    renameInJira(jira, ACCOUNT.rahulL, "Rahul L");
    await runSync(jira.make);
    const admin = await getPeopleAdmin(aman);
    expect(member(admin, "Rahul Lanjewar")?.jira).toBeNull();
    expect(pending(admin, "Rahul Lanjewar")?.candidates).toEqual([
      { accountId: ACCOUNT.rahulL, displayName: "Rahul L" },
    ]);
  });

  it("lets the admin confirm a suggestion, and the next sync keeps it", async () => {
    const jira = fakeJira();
    renameInJira(jira, ACCOUNT.rahulS, "Rahul");
    renameInJira(jira, ACCOUNT.rahulL, "Rahul");
    await runSync(jira.make);

    const rahulS = pending(await getPeopleAdmin(aman), "Rahul Saharan")!;
    await confirmJiraAccount(aman, rahulS.id, ACCOUNT.rahulS);
    await runSync(jira.make);

    const admin = await getPeopleAdmin(aman);
    expect(member(admin, "Rahul Saharan")?.jira?.accountId).toBe(ACCOUNT.rahulS);
    // One Rahul left, but a first-name match is still only a suggestion.
    expect(member(admin, "Rahul Lanjewar")?.jira).toBeNull();
    expect(pending(admin, "Rahul Lanjewar")?.candidates.map((c) => c.accountId)).toEqual([ACCOUNT.rahulL]);
  });

  it("lets the admin correct a suggestion to any unlinked Jira user", async () => {
    const jira = fakeJira();
    renameInJira(jira, ACCOUNT.rahulL, "Rahul L");
    await runSync(jira.make);
    const rahulL = pending(await getPeopleAdmin(aman), "Rahul Lanjewar")!;

    await confirmJiraAccount(aman, rahulL.id, ACCOUNT.jatin);
    const admin = await getPeopleAdmin(aman);
    expect(member(admin, "Rahul Lanjewar")?.jira).toEqual({ accountId: ACCOUNT.jatin, displayName: "Jatin Tyagi" });
    expect(admin.noPod.map((u) => u.displayName)).toContain("Rahul L");
  });

  it("refuses a Jira account that is already linked to someone else", async () => {
    await runSync(fakeJira().make);
    const shikhar = pending(await getPeopleAdmin(aman), "Shikhar Seth")!;
    await expect(confirmJiraAccount(aman, shikhar.id, ACCOUNT.rahulS)).rejects.toThrow(ValidationError);
    await expect(confirmJiraAccount(aman, shikhar.id, "not-on-any-ticket")).rejects.toThrow(ValidationError);
  });

  it("suggests a sure match that no sync has linked yet", async () => {
    await db.insert(tickets).values({
      key: "DTP-1",
      summary: "s",
      type: "Story",
      status: "To Do",
      statusCategory: "new",
      devOwners: [{ accountId: "a-shahid", displayName: "Shahid Khan" }],
    });
    const admin = await getPeopleAdmin(aman);
    expect(pending(admin, "Shahid Khan")?.candidates).toEqual([{ accountId: "a-shahid", displayName: "Shahid Khan" }]);
    expect(admin.noPod).toEqual([]);
  });

  it("lists people Jira does not know yet for review, with no suggestion", async () => {
    await runSync(fakeJira().make);
    expect(pending(await getPeopleAdmin(aman), "Akhilesh Mourya")).toMatchObject({ pod: "Atlas", candidates: [] });
  });
});

describe("the No pod yet list", () => {
  it("shows Jira users on DTP tickets who are in no pod, busiest first", async () => {
    await runSync(fakeJira().make);
    expect((await getPeopleAdmin(aman)).noPod).toEqual(
      [
        "Adhyayan Rathi",
        "Akshansh Deva",
        "Arfaz Chougule",
        "Avinash Kumar",
        "gaurav",
        "Jatin Tyagi",
        "Nagarathna C",
        "Praveen Singh",
      ].map((displayName) => ({ accountId: expect.any(String), displayName, tickets: 1 })),
    );
  });

  it("is empty before the first sync", async () => {
    expect((await getPeopleAdmin(aman)).noPod).toEqual([]);
  });

  it("adds a person to a pod with a main skill in one action", async () => {
    await runSync(fakeJira().make);
    await addFromJira(aman, { accountId: ACCOUNT.jatin, podId: await podId("atlas"), mainSkill: "BE" });

    expect((await getPodPage("atlas"))!.members).toContainEqual(
      expect.objectContaining({ name: "Jatin Tyagi", mainSkill: "BE", isLead: false }),
    );
    const admin = await getPeopleAdmin(aman);
    expect(admin.noPod.map((u) => u.accountId)).not.toContain(ACCOUNT.jatin);
    expect(member(admin, "Jatin Tyagi")).toMatchObject({ pod: { name: "Atlas" }, jira: { accountId: ACCOUNT.jatin } });
  });

  it("refuses to add someone twice, to an unknown pod, or with an unknown skill", async () => {
    await runSync(fakeJira().make);
    const atlas = await podId("atlas");
    await addFromJira(aman, { accountId: ACCOUNT.jatin, podId: atlas, mainSkill: "BE" });
    await expect(addFromJira(aman, { accountId: ACCOUNT.jatin, podId: atlas, mainSkill: "BE" })).rejects.toThrow(
      ValidationError,
    );
    await expect(addFromJira(aman, { accountId: ACCOUNT.praveen, podId: 9999, mainSkill: "BE" })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      addFromJira(aman, { accountId: ACCOUNT.praveen, podId: atlas, mainSkill: "QA" as "BE" }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("membership", () => {
  it("moves a person to another pod, so they are in exactly one", async () => {
    const mayank = member(await getPeopleAdmin(aman), "Mayank Awasthi")!;
    await movePerson(aman, mayank.id, await podId("velocity"));

    expect(await podMembers("roadmap-2")).not.toContain("Mayank Awasthi");
    expect(await podMembers("velocity")).toContain("Mayank Awasthi");
    expect(member(await getPeopleAdmin(aman), "Mayank Awasthi")?.pod.name).toBe("Velocity");
  });

  it("removes a person who has left, and they stop counting anywhere", async () => {
    await runSync(fakeJira().make);
    const mayank = member(await getPeopleAdmin(aman), "Mayank Awasthi")!;
    await removePerson(aman, mayank.id);
    await runSync(fakeJira().make);

    expect(await podMembers("roadmap-2")).not.toContain("Mayank Awasthi");
    const admin = await getPeopleAdmin(aman);
    expect(member(admin, "Mayank Awasthi")).toBeUndefined();
    // Their old tickets do not bring them back as a new person.
    expect(admin.noPod.map((u) => u.displayName)).not.toContain("Mayank Awasthi");
  });

  it("keeps pod leads in their own pod", async () => {
    const shikhar = member(await getPeopleAdmin(aman), "Shikhar Seth")!;
    await expect(movePerson(aman, shikhar.id, await podId("atlas"))).rejects.toThrow(ValidationError);
    await expect(removePerson(aman, shikhar.id)).rejects.toThrow(ValidationError);
    expect(await podMembers("roadmap-1")).toContain("Shikhar Seth");
  });

  it("refuses to move a person to a pod that does not exist, or the one they are in", async () => {
    const mayank = member(await getPeopleAdmin(aman), "Mayank Awasthi")!;
    await expect(movePerson(aman, mayank.id, 9999)).rejects.toThrow(ValidationError);
    await expect(movePerson(aman, mayank.id, await podId("roadmap-2"))).rejects.toThrow("already in RoadMap 2");
  });
});

describe("non-admins", () => {
  it("are refused every membership change by the server", async () => {
    await runSync(fakeJira().make);
    const admin = await getPeopleAdmin(aman);
    const mayank = member(admin, "Mayank Awasthi")!;
    const shikhar = pending(admin, "Shikhar Seth")!;
    const atlas = await podId("atlas");

    for (const viewer of [await viewerForEmail("rahul@delightree.com"), null]) {
      const actions = [
        () => getPeopleAdmin(viewer),
        () => confirmJiraAccount(viewer, shikhar.id, ACCOUNT.jatin),
        () => addFromJira(viewer, { accountId: ACCOUNT.jatin, podId: atlas, mainSkill: "BE" }),
        () => movePerson(viewer, mayank.id, atlas),
        () => removePerson(viewer, mayank.id),
      ];
      for (const action of actions) await expect(action()).rejects.toThrow(ForbiddenError);
    }
    expect(await podMembers("roadmap-2")).toContain("Mayank Awasthi");
  });
});
