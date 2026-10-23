// The only module that talks to Jira. Tests replace JiraClient with a fake.

export type JiraCredentials = { site: string; email: string; token: string };

export type JiraClient = {
  myself(): Promise<{ accountId: string; displayName: string }>;
  getProject(key: string): Promise<{ key: string; name: string }>;
};

export type MakeJiraClient = (creds: JiraCredentials) => JiraClient;

export class JiraError extends Error {
  constructor(
    readonly kind: "unauthorized" | "forbidden" | "not-found" | "unreachable",
    message: string,
  ) {
    super(message);
    this.name = "JiraError";
  }
}

const KIND_BY_STATUS = { 401: "unauthorized", 403: "forbidden", 404: "not-found" } as const;

export const createJiraClient: MakeJiraClient = ({ site, email, token }) => {
  const authorization = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

  async function get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${site}/rest/api/3${path}`, {
        headers: { authorization, accept: "application/json" },
        // A redirect could carry the token to another host.
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      const cause = e instanceof Error ? ((e.cause as Error | undefined)?.message ?? e.message) : String(e);
      throw new JiraError("unreachable", `Could not reach ${site} (${cause}).`);
    }
    if (res.ok) return res.json() as Promise<T>;
    const kind = KIND_BY_STATUS[res.status as keyof typeof KIND_BY_STATUS] ?? "unreachable";
    throw new JiraError(kind, `Jira answered ${res.status} ${res.statusText} for ${path}.`);
  }

  return {
    myself: () => get("/myself"),
    getProject: (key) => get(`/project/${encodeURIComponent(key)}`),
  };
};
