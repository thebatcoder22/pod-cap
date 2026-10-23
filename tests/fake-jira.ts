import dtpFields from "./fixtures/dtp-fields.json";
import dtpIssues from "./fixtures/dtp-issues.json";
import dtpSprints from "./fixtures/dtp-board-267-sprints.json";
import type { JiraClient, JiraError, JiraField, JiraIssue, JiraSprint } from "../src/server/jira-client";

/** Serves what DTP served, with any edits a test makes to simulate changes in Jira. */
export function fakeJira() {
  const jira = {
    fields: structuredClone(dtpFields) as JiraField[],
    sprints: structuredClone(dtpSprints.values) as JiraSprint[],
    issues: structuredClone(dtpIssues) as JiraIssue[],
    fail: null as JiraError | null,
    // Lets a test hold a sync mid-flight.
    gate: Promise.resolve(),
    searches: 0,
    issue(key: string) {
      return jira.issues.find((i) => i.key === key)!;
    },
    make: (): JiraClient => ({
      myself: async () => ({ accountId: "a1", displayName: "Aman Tyagi" }),
      getProject: async (key) => ({ key, name: "Delightree Product" }),
      listFields: async () => structuredClone(jira.fields),
      listSprints: async () => {
        if (jira.fail) throw jira.fail;
        return structuredClone(jira.sprints);
      },
      searchIssues: async () => {
        jira.searches++;
        await jira.gate;
        return structuredClone(jira.issues);
      },
    }),
  };
  return jira;
}
