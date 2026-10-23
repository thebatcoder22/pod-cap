// The only module that talks to Jira. Tests replace JiraClient with a fake.

export type JiraCredentials = { site: string; email: string; token: string };

export type JiraSprint = {
  id: number;
  name: string;
  state: "future" | "active" | "closed";
  startDate?: string;
  endDate?: string;
  completeDate?: string;
};

/** An issue as Jira returns it: custom fields stay keyed by field id. */
export type JiraIssue = { id: string; key: string; fields: Record<string, unknown> };

export type JiraClient = {
  myself(): Promise<{ accountId: string; displayName: string }>;
  getProject(key: string): Promise<{ key: string; name: string }>;
  /** Every sprint on the board, in any state. */
  listSprints(boardId: number): Promise<JiraSprint[]>;
  /** Every issue matching the JQL, across all pages. */
  searchIssues(jql: string, fields: string[]): Promise<JiraIssue[]>;
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
const MAX_RETRIES = 3;

export const createJiraClient: MakeJiraClient = ({ site, email, token }) => {
  const authorization = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

  async function call<T>(path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${site}${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            authorization,
            accept: "application/json",
            ...(body ? { "content-type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          // A redirect could carry the token to another host.
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        });
      } catch (e) {
        const cause = e instanceof Error ? ((e.cause as Error | undefined)?.message ?? e.message) : String(e);
        throw new JiraError("unreachable", `Could not reach ${site} (${cause}).`);
      }
      if (res.ok) return res.json() as Promise<T>;
      if (res.status === 429 && attempt < MAX_RETRIES) {
        // Jira says how long to back off; cap it so a sync cannot stall for minutes.
        const seconds = Math.min(Number(res.headers.get("retry-after")) || 2 ** attempt, 10);
        await new Promise((r) => setTimeout(r, seconds * 1000));
        continue;
      }
      const kind = KIND_BY_STATUS[res.status as keyof typeof KIND_BY_STATUS] ?? "unreachable";
      // A 400 means Jira did not understand the request (say, an unknown issue type); it says why.
      const why =
        res.status === 400
          ? await res
              .json()
              .then((b: { errorMessages?: string[] }) => b.errorMessages?.join(" ") ?? "")
              .catch(() => "")
          : "";
      throw new JiraError(
        kind,
        `Jira answered ${res.status} ${res.statusText} for ${path.split("?")[0]}.${why ? ` ${why}` : ""}`,
      );
    }
  }

  return {
    myself: () => call("/rest/api/3/myself"),
    getProject: (key) => call(`/rest/api/3/project/${encodeURIComponent(key)}`),

    async listSprints(boardId) {
      const sprints: JiraSprint[] = [];
      for (;;) {
        const page = await call<{ isLast: boolean; values: JiraSprint[] }>(
          `/rest/agile/1.0/board/${boardId}/sprint?startAt=${sprints.length}&maxResults=50`,
        );
        sprints.push(...page.values);
        if (page.isLast || !page.values.length) return sprints;
      }
    },

    async searchIssues(jql, fields) {
      const issues: JiraIssue[] = [];
      let nextPageToken: string | undefined;
      do {
        const page = await call<{ issues: JiraIssue[]; nextPageToken?: string }>("/rest/api/3/search/jql", {
          jql,
          fields,
          maxResults: 100,
          nextPageToken,
        });
        issues.push(...page.issues);
        nextPageToken = page.nextPageToken;
      } while (nextPageToken);
      return issues;
    },
  };
};
