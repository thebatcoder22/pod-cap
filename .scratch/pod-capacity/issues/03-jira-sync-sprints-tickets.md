# 03 - Jira sync of sprints and plannable tickets

**What to build:** The platform pulls sprints and plannable tickets from Jira every hour and on demand.
A pod lead picks a sprint (defaulting to the active one) and sees their pod's plannable tickets for it, each linking to Jira.
The page shows when the last successful sync happened, and a clear banner explains any failed sync.
Tickets that change sprint or pod in Jira move accordingly on the next sync.

**Blocked by:** 02 - Admin settings: Jira connection and allowlist.

**Status:** ready-for-agent

- [ ] A Jira client is the only code that talks to Jira, behind a small interface that tests replace with a fake serving trimmed real DTP responses
- [ ] Sync pulls all sprints on board 267 (active, future, closed) and plannable tickets (Story, Improvement, Tech Story, Bug, Prod Bug, Dev Custom Task) with pod, sprint, status, type, priority, assignee, Dev Owners, parent epic and Ready for Production Date
- [ ] Sub-tasks are ignored
- [ ] Only one sync runs at a time, even when "Sync now" is pressed repeatedly
- [ ] Each run is recorded with start, finish, status and error
- [ ] An hourly Vercel Cron job and a "Sync now" button both trigger the same sync
- [ ] The pod page has a sprint picker defaulting to the active sprint, and lists the pod's plannable tickets with links to Jira
- [ ] Last successful sync time is shown; a failed sync shows a banner with the reason
- [ ] Re-running a sync is idempotent, and tickets that left a sprint or changed pod move on the next run
