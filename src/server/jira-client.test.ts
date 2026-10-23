import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createJiraClient, JiraError } from "./jira-client";

// A stand-in Jira that answers by path: /rest/api/3/project/<status> replies with that status.
let server: Server;
let site: string;
const seen: (string | undefined)[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push(req.headers.authorization);
    const status = Number(req.url!.split("/").pop()) || 200;
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

  it("does not follow redirects, which could carry the token elsewhere", async () => {
    expect(await kindOf(client().getProject("302"))).toBe("unreachable");
  });

  it("reports a site that does not answer as unreachable", async () => {
    const dead = createJiraClient({ site: "http://127.0.0.1:1", email: "a@b.c", token: "secret-token" });
    const error = await dead.myself().catch((e: JiraError) => e);
    expect(error).toMatchObject({ kind: "unreachable" });
    expect((error as Error).message).not.toContain("secret-token");
  });
});
