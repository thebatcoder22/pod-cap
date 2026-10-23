import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createJiraClient, JiraError } from "./jira-client";

// A stand-in Jira. /rest/api/3/project/<status> replies with that status;
// the sprint and search endpoints serve 120 sprints and 250 issues in pages, after one 429.
let server: Server;
let site: string;
const seen: (string | undefined)[] = [];
const searchBodies: { jql: string; fields: string[]; nextPageToken?: string }[] = [];
let throttled = 0;

const json = (res: ServerResponse, body: unknown, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  server = createServer(async (req, res) => {
    seen.push(req.headers.authorization);
    const url = new URL(req.url!, "http://x");
    if (url.pathname.startsWith("/rest/agile/1.0/board/267/sprint")) {
      if (throttled++ === 0) {
        res.writeHead(429, { "retry-after": "0" });
        return res.end();
      }
      const startAt = Number(url.searchParams.get("startAt"));
      const values = Array.from({ length: Math.min(50, 120 - startAt) }, (_, i) => ({
        id: startAt + i,
        name: `Sprint ${startAt + i}`,
        state: "closed",
      }));
      return json(res, { startAt, maxResults: 50, isLast: startAt + values.length >= 120, values });
    }
    if (url.pathname === "/rest/api/3/search/jql" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      searchBodies.push(body);
      const from = Number(body.nextPageToken ?? 0);
      const issues = Array.from({ length: Math.min(100, 250 - from) }, (_, i) => ({
        id: String(from + i),
        key: `DTP-${from + i}`,
        fields: {},
      }));
      return json(res, { issues, ...(from + 100 < 250 ? { nextPageToken: String(from + 100) } : {}) });
    }
    const status = Number(req.url!.split("/").pop()) || 200;
    if (status === 400)
      return json(res, { errorMessages: ["The value 'Spike' does not exist for the field 'issuetype'."] }, 400);
    if (status === 302) res.setHeader("location", "http://example.com/");
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ key: "DTP", name: "Delightree Product" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const client = () => createJiraClient({ site, email: "aman@delightree.com", token: "tok" });
const kindOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: JiraError) => e.kind,
  );

describe("Jira client", () => {
  it("authenticates with the account email and API token", async () => {
    expect(await client().getProject("DTP")).toMatchObject({ key: "DTP" });
    expect(seen.at(-1)).toBe(`Basic ${Buffer.from("aman@delightree.com:tok").toString("base64")}`);
  });

  it("classifies Jira's answers", async () => {
    expect(await kindOf(client().getProject("401"))).toBe("unauthorized");
    expect(await kindOf(client().getProject("403"))).toBe("forbidden");
    expect(await kindOf(client().getProject("404"))).toBe("not-found");
    expect(await kindOf(client().getProject("503"))).toBe("unreachable");
  });

  it("passes on Jira's reason for a bad request", async () => {
    await expect(client().getProject("400")).rejects.toThrow(
      "The value 'Spike' does not exist for the field 'issuetype'.",
    );
  });

  it("does not follow redirects, which could carry the token elsewhere", async () => {
    expect(await kindOf(client().getProject("302"))).toBe("unreachable");
  });

  it("lists every sprint on the board across pages, waiting out rate limits", async () => {
    const sprints = await client().listSprints(267);
    expect(sprints.map((s) => s.id)).toEqual(Array.from({ length: 120 }, (_, i) => i));
  });

  it("searches every page of issues with the requested fields", async () => {
    const issues = await client().searchIssues("project = DTP", ["summary"]);
    expect(issues).toHaveLength(250);
    expect(new Set(issues.map((i) => i.key)).size).toBe(250);
    expect(searchBodies.map((b) => b.nextPageToken)).toEqual([undefined, "100", "200"]);
    expect(searchBodies[0]).toMatchObject({ jql: "project = DTP", fields: ["summary"] });
  });

  it("reports a site that does not answer as unreachable", async () => {
    const dead = createJiraClient({ site: "http://127.0.0.1:1", email: "a@b.c", token: "secret-token" });
    const error = await dead.myself().catch((e: JiraError) => e);
    expect(error).toMatchObject({ kind: "unreachable" });
    expect((error as Error).message).not.toContain("secret-token");
  });
});
