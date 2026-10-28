# Implementation Decisions

## Architecture

- One Next.js application (App Router, TypeScript) serves the UI and the server logic, deployed on Vercel.
- Postgres on Neon (provisioned through the Vercel Marketplace) holds all platform-owned data.
- Auth.js with the Google provider handles sign-in; any @delightree.com account may enter read only, an allowlist table decides who may edit, and the session carries the person's pod and admin flag.
- A Vercel Cron job runs the Jira sync hourly and triggers snapshots; "Sync now" calls the same sync service.
- The UI is built with the `/design-taste-frontend` skill.

## Modules

- **Jira client**: the only module that talks to Jira. It exposes a small interface: list sprints for the board, list plannable issues and epics for the project, and resolve users. It handles auth headers, pagination, and rate-limit retries. Everything else depends on this interface, which is what tests replace with a fake.
- **Sync service**: pulls from the Jira client and upserts sprints, tickets, epics, and Jira users into Postgres. It takes a database advisory lock so only one sync runs at a time, records a sync run row (started, finished, status, error), and is idempotent.
- **Planning engine**: a pure module with no I/O. Input: a sprint, pod people with proficiencies, leave, holidays, focus factor, tickets with estimates and owners, and manual items. Output: per-person capacity, per-pod capacity and committed skill-days by skill, per-person load, flags, and pick-up suggestions including stretch options. All capacity math lives here and nowhere else.
- **Planning service**: loads data from Postgres, calls the planning engine, and returns view models to the UI. It also writes snapshots.
- **Admin and editing actions**: server actions for leave, proficiency, manual items, epic sizes, settings, holidays, allowlist, and membership. Every action checks permissions on the server.
- **Secrets**: the Jira token is encrypted with an application key held in an environment variable before it is stored.

## Jira mapping (facts verified against the live DTP project)

- Site: delightree.atlassian.net. Project: DTP. Board: 267. All pods work in DTP only.
- Pod field: `POD` (customfield_11457), a required single select with options Atlas (11229), Velocity (11230), RoadMap 1-Shikar (11231), RoadMap 2-Aman (11232) and Support (11265).
  Pods match tickets and epics on the option id, so renaming an option in Jira changes nothing; each sync refreshes the label shown on the pod page.
- Estimate fields: `FE Days` (customfield_11525) and `BE Days` (customfield_11524). `Data Eng Days` (customfield_11527) and `AI Eng Days` (customfield_11528) were added later. A `DevOps Days` field is read once the Jira admin adds it; until then DevOps work is planned with manual items. Field IDs are discovered by name at sync time, so new fields work without a code change.
- Owners: `Dev Owners` (customfield_10777, multi user) and the system assignee.
- Sprint: customfield_10020. Ready for Production Date: customfield_10946.
- Plannable issue types: Story, Improvement, Tech Story, Bug, Prod Bug, Dev Custom Task. Epics are synced for grouping. Sub-tasks are ignored.
- The platform never writes to Jira.

## Data model (platform-owned)

- **Pod**: Jira POD option id and its current label, display name, lead person.
- **Person**: name, email, Jira account ID, main skill, active flag. "No pod yet" lists Jira users who are no person yet.
- **Pod membership**: pod, person, share. An active person is in one pod or two, and their shares add up to 100; a removed person is in none.
- **Proficiency**: person, skill, percentage. The main skill is fixed at 100%.
- **Leave**: person, sprint, days (half-day steps).
- **Holiday**: date, name.
- **Settings**: focus factor (default 0.70), encrypted Jira credentials, allowlist, admin email.
- **Manual item**: pod, person (optional), skill, days, sprint, kind (non-Jira work or placeholder), title, optional linked Jira key.
- **Epic size**: epic Jira key, T-shirt size.
- **Snapshot**: pod, sprint, kind (start or close), skill, capacity, committed, completed, taken at.
- **Synced Jira data**: sprints, tickets, epics, and Jira users, cached for the planning service and replaced on each sync.

## Rules the planning engine encodes

- Person capacity = (working days in sprint - leave days - holidays in sprint) x focus factor. Working days are weekdays inside the sprint's dates.
- A pod plans with its share of each member's capacity, so someone in two pods is never counted twice. Leave and proficiency belong to the person, and the lead of either of their pods sets them.
- Pod capacity for a skill = the sum of capacity of members whose main skill is that skill. Stretch capacity is reported separately and never folded into the main number.
- A ticket counts for one pod: its POD value's pod when one of its owners is in it, else the pod of its first owner in a pod (the assignee, then the Dev Owners in Jira's order), else its POD value.
  Owners are set on work someone took on, while the POD field gets missed or names another pod.
  Owners in other pods show on it as cross-pod help.
  An owner in two pods, like Shadab in Velocity and Support, puts a ticket whose POD names neither in the pod with the larger share of them, then the older pod.
- Committed skill-days for a pod = the sum of estimates of plannable tickets in the sprint that count for that pod, plus manual items in that pod and sprint. A placeholder linked to a Jira ticket stops counting once the ticket is synced into the sprint for a pod; a ticket that counts for no pod takes nothing over.
- A missing estimate for a skill is "not estimated", which is distinct from zero and is counted and surfaced.
- Attribution: a ticket's skill-days for a skill go to its owners, the assignee and the Dev Owners, whose proficiency in that skill is above zero, split evenly; someone in both counts once. If no candidate exists, the days become unassigned pod work and raise a flag.
- A manual item's days go to its person. An item with no person counts against the pod without a flag, since the lead chose to reserve it there; an item whose person has left the pod, or has 0% in its skill, is unassigned work and raises a flag.
- Calendar days consumed by a person for attributed work = skill-days / proficiency in that skill.
- Free days = capacity - calendar days consumed. It can be negative, which means overloaded.
- An exact match is a backlog plannable ticket in the same pod, not in any active or future sprint, whose estimate is only in the person's main skill and fits their free days.
- A stretch option is the same, but for a skill where the person's proficiency is above zero and below 100%, with cost = skill-days / proficiency, which must fit free days.
- Suggestions are ordered by match type (exact before stretch), then Jira priority, then smallest cost.
- Cross-pod hints list other pods' free main-skill capacity for skills where this pod is overloaded.

## Snapshots

- On each sync, when a sprint's Jira state changes from future to active, a start snapshot is written. When it changes to closed, a close snapshot is written.
- Completed means plannable tickets in the sprint whose status category is Done at close time.
- The admin can trigger either snapshot manually, which overwrites the earlier one for that pod, sprint, and kind.

## Seed data

- Pods: RoadMap 1 (Shikhar Seth), RoadMap 2 (Aman Tyagi), Velocity (Rahul Saharan), Atlas (Abdullah Ghani), Support (Shadab Anjum).
- The seed adds any roster pod a database does not have yet, so existing databases got Support on the deploy that introduced it; it never changes a pod that exists.
- Members and main skills: RoadMap 1: Shikhar Seth AI, Hrishikesh Pujari BE, Vaibhav Pal FE, Divyanshu FE, Shahid Khan FE. RoadMap 2: Aman Tyagi BE, Mayank Awasthi FE, Muthaiyan Mani FE, Kalpan Punamiya Data, Akash Singh AI. Velocity: Rahul Saharan BE, Manish Bisht FE, Saikrishna Kotagiri FE, Shadab Anjum FE, Nanagoud BE. Atlas: Abdullah Ghani BE, Rahul Lanjewar BE, Abhay Sharma FE, Akhilesh Mourya FE. Support: Shadab Anjum FE and Nanagoud BE, each 50% here and 50% in Velocity, and Shashwat Mohite DevOps.
- Allowlist (edit rights): aman@, shikhar@, rahul@, abdullah@delightree.com. Admin: aman@delightree.com.
- Excluded on purpose: non-engineering roles, and people who have left (Praveen Singh, Raj Prakash Kante).
