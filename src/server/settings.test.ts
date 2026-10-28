import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { allowlist, jiraSettings } from "@/db/schema";
import { resetDb } from "../../tests/db";
import { ForbiddenError } from "./permissions";
import { viewerForEmail, type Viewer } from "./viewer";
import { JiraError, type JiraClient, type JiraCredentials } from "./jira-client";
import {
  addAllowlisted,
  getJiraSettings,
  listAllowlist,
  removeAllowlisted,
  saveJiraSettings,
  testJiraConnection,
  ValidationError,
} from "./settings";

beforeEach(resetDb);

const viewer = async (email: string) => (await viewerForEmail(email))!;
const site = "https://delightree.atlassian.net";

/** Records the credentials it was built with; each call fails the way Jira would when told to. */
function fakeJira(fail: { myself?: JiraError["kind"]; project?: JiraError["kind"] } = {}) {
  const used: JiraCredentials[] = [];
  const make = (creds: JiraCredentials): JiraClient => {
    used.push(creds);
    return {
      async myself() {
        if (fail.myself) throw new JiraError(fail.myself, "boom");
        return { accountId: "a1", displayName: "Aman Tyagi" };
      },
      async getProject(key) {
        if (fail.project) throw new JiraError(fail.project, "boom");
        return { key, name: "Delightree Product" };
      },
      listFields: async () => [],
      listSprints: async () => [],
      searchIssues: async () => [],
    };
  };
  return { make, used };
}

describe("Jira settings", () => {
  let aman: Viewer;
  beforeEach(async () => {
    aman = await viewer("aman@delightree.com");
  });

  it("starts unconfigured", async () => {
    expect(await getJiraSettings(aman)).toBeNull();
  });

  it("stores the token encrypted and only reports that it is set", async () => {
    await saveJiraSettings(aman, { site, email: "Aman@Delightree.com", token: "ATATT-secret" });

    const settings = await getJiraSettings(aman);
    expect(settings).toMatchObject({ site, email: "aman@delightree.com", tokenUpdatedAt: expect.any(Date) });
    expect(JSON.stringify(settings)).not.toContain("ATATT-secret");

    const [row] = await db.select().from(jiraSettings);
    expect(JSON.stringify(row)).not.toContain("ATATT-secret");
  });

  it("normalises the site to an https origin", async () => {
    await saveJiraSettings(aman, {
      site: " delightree.atlassian.net/jira/ ",
      email: "aman@delightree.com",
      token: "t",
    });
    expect((await getJiraSettings(aman))?.site).toBe(site);
  });

  it("only accepts Atlassian Cloud sites, so the token is never sent elsewhere", async () => {
    for (const bad of ["https://evil.example.com", "http://delightree.atlassian.net", "not a url"]) {
      await expect(saveJiraSettings(aman, { site: bad, email: "aman@delightree.com", token: "t" })).rejects.toThrow(
        ValidationError,
      );
    }
  });

  it("requires a token on first save", async () => {
    await expect(saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("keeps the current token when the token field is left blank", async () => {
    await saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "first" });
    await saveJiraSettings(aman, { site, email: "ops@delightree.com", token: "" });

    const jira = fakeJira();
    await testJiraConnection(aman, jira.make);
    expect(jira.used).toEqual([{ site, email: "ops@delightree.com", token: "first" }]);
  });

  it("uses the new token once it is replaced", async () => {
    await saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "old" });
    await saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "new" });

    const jira = fakeJira();
    await testJiraConnection(aman, jira.make);
    expect(jira.used.map((c) => c.token)).toEqual(["new"]);
  });

  describe("test connection", () => {
    beforeEach(() => saveJiraSettings(aman, { site, email: "aman@delightree.com", token: "t" }));

    it("succeeds when the token can read DTP", async () => {
      expect(await testJiraConnection(aman, fakeJira().make)).toEqual({
        ok: true,
        message: "Connected as Aman Tyagi. DTP (Delightree Product) is readable.",
      });
    });

    it.each([
      [{ myself: "unauthorized" }, "bad-credentials"],
      [{ myself: "unreachable" }, "unreachable"],
      // A site name with no Jira behind it.
      [{ myself: "not-found" }, "unreachable"],
      // An account without Jira product access.
      [{ myself: "forbidden" }, "bad-credentials"],
      [{ project: "unauthorized" }, "bad-credentials"],
      [{ project: "unreachable" }, "unreachable"],
      [{ project: "not-found" }, "no-project-access"],
      [{ project: "forbidden" }, "no-project-access"],
    ] as const)("reports %o from Jira as %s", async (fail, reason) => {
      expect(await testJiraConnection(aman, fakeJira(fail).make)).toMatchObject({ ok: false, reason });
    });

    it("names the missing site", async () => {
      expect(await testJiraConnection(aman, fakeJira({ myself: "not-found" }).make)).toMatchObject({
        message: `No Jira site answers at ${site}. Check the site address.`,
      });
    });

    it("asks for the token again when it can no longer be decrypted", async () => {
      await db.update(jiraSettings).set({ tokenCiphertext: "c2VhbGVkLXdpdGgtYW4tb2xkLWtleS1sb25nLWVub3VnaA==" });
      expect(await testJiraConnection(aman, fakeJira().make)).toMatchObject({
        ok: false,
        reason: "not-configured",
        message: expect.stringContaining("Paste the token again"),
      });
    });

    it("says when nothing is configured yet", async () => {
      await db.delete(jiraSettings);
      expect(await testJiraConnection(aman, fakeJira().make)).toMatchObject({ ok: false, reason: "not-configured" });
    });
  });
});

describe("allowlist", () => {
  let aman: Viewer;
  beforeEach(async () => {
    aman = await viewer("aman@delightree.com");
  });

  it("adds an address in lowercase and lets it edit", async () => {
    await addAllowlisted(aman, "  Mayank@Delightree.com ");
    expect(await listAllowlist(aman)).toContainEqual({ email: "mayank@delightree.com", isAdmin: false });
    expect(await viewerForEmail("mayank@delightree.com")).toMatchObject({ canEdit: true });
  });

  it("treats adding an existing address as done", async () => {
    await addAllowlisted(aman, "RAHUL@delightree.com");
    expect((await listAllowlist(aman)).filter((r) => r.email === "rahul@delightree.com")).toHaveLength(1);
  });

  it("refuses addresses that cannot sign in with Google", async () => {
    await expect(addAllowlisted(aman, "someone@gmail.com")).rejects.toThrow(ValidationError);
    await expect(addAllowlisted(aman, "not-an-email")).rejects.toThrow(ValidationError);
  });

  it("removes an address and makes it read only", async () => {
    await removeAllowlisted(aman, "Rahul@Delightree.com");
    expect((await listAllowlist(aman)).map((r) => r.email)).not.toContain("rahul@delightree.com");
    expect(await viewerForEmail("rahul@delightree.com")).toMatchObject({
      canEdit: false,
      pods: [{ slug: "velocity" }],
    });
  });

  it("does not let the admin remove their own address", async () => {
    await expect(removeAllowlisted(aman, "AMAN@delightree.com")).rejects.toThrow(ValidationError);
  });

  it("lets one admin remove another", async () => {
    await db.insert(allowlist).values({ email: "ops@delightree.com", isAdmin: true });
    await removeAllowlisted(aman, "ops@delightree.com");
    expect((await listAllowlist(aman)).map((r) => r.email)).not.toContain("ops@delightree.com");
  });

  it("does not remove the last admin", async () => {
    await db.insert(allowlist).values({ email: "ops@delightree.com", isAdmin: true });
    const ops = await viewer("ops@delightree.com");
    // Ops loses admin while their request is in flight, which leaves Aman as the last admin.
    await db.update(allowlist).set({ isAdmin: false }).where(eq(allowlist.email, "ops@delightree.com"));
    await expect(removeAllowlisted(ops, "aman@delightree.com")).rejects.toThrow("last admin");
  });
});

describe("non-admins", () => {
  it("are refused every settings action by the server", async () => {
    const rahul = await viewer("rahul@delightree.com");
    const actions = [
      () => getJiraSettings(rahul),
      () => saveJiraSettings(rahul, { site, email: "rahul@delightree.com", token: "t" }),
      () => testJiraConnection(rahul, fakeJira().make),
      () => listAllowlist(rahul),
      () => addAllowlisted(rahul, "friend@delightree.com"),
      () => removeAllowlisted(rahul, "shikhar@delightree.com"),
    ];
    for (const action of actions) await expect(action()).rejects.toThrow(ForbiddenError);
  });

  it("refuse signed-out callers too", async () => {
    await expect(listAllowlist(null)).rejects.toThrow(ForbiddenError);
    await expect(removeAllowlisted(null, "rahul@delightree.com")).rejects.toThrow(ForbiddenError);
  });
});
