# Pod Capacity Platform - Spec

Status: ready-for-agent

## Problem Statement

Delightree engineering moves to a pod structure on 2026-10-26, with four pods and four pod leads (Aman, Shikhar, Rahul S, Abdullah).
Everything is tracked in Jira, but Jira cannot answer the questions a pod lead now owns.
A pod lead cannot easily tell who is in their pod, how many days of work the pod can actually take on in a sprint, who is working on what, and who has room to pick up more.
Engineers have different skills (frontend, backend, data, AI), so capacity is not one number.
A backend-heavy sprint cannot be balanced by handing backend work to a data engineer as if their days were interchangeable, yet sometimes a data engineer with free days genuinely can take a small frontend ticket at a slower pace.
Today none of this is visible, so planning is guesswork, overload is discovered late, and there is no record of how the pods perform as work grows.
The CTO's Engineering Rhythm asks pod leads to keep a capacity sheet current, commit stories with person-days at planning, and review capacity mid-sprint, and they have no tool for it.

## Solution

A small web platform for the four pod leads that sits on top of Jira and never replaces it.
Jira stays the source of truth for tickets, sprints, owners, pod assignment, and per-skill estimates.
The platform owns only what Jira does not know: who is in which pod, each person's proficiency per skill, leave, company holidays, work that never lives in Jira, and sprint-over-sprint history.
For any sprint, a pod lead sees their pod's capacity per skill against the committed estimates, each person's load, flags for gaps, and a pick-up panel that suggests backlog tickets for people with free days, including clearly labeled stretch options across skills.
The platform suggests and the pod lead decides; all assignment still happens in Jira.
Anyone at Delightree signs in with Google and can see every pod. Allowlisted leads can also edit their own pod.

## Glossary

- **Pod**: a team identified by the Jira `POD` field value: RoadMap 1 (lead Shikhar), RoadMap 2 (lead Aman), Velocity (lead Rahul S), Atlas (lead Abdullah, called the Rebuild pod in the deck).
- **Pod lead**: the engineer who leads a pod; also counts as a working engineer with full capacity.
- **Admin**: Aman; a pod lead who also controls platform settings.
- **Person**: an engineer who belongs to exactly one pod, linked to one Jira account.
- **Skill**: one of FE, BE, Data, AI. Mobile and React Native work counts as FE. QA and Design are not skills in this platform.
- **Proficiency**: a percentage per person per skill describing how fast that person does that kind of work relative to a specialist. A person's main skill is 100%; others default to 0%.
- **Working days**: weekdays inside the sprint's date range.
- **Leave**: days a person is away during a sprint, entered by their pod lead.
- **Holiday**: a company-wide non-working day, maintained by the admin.
- **Focus factor**: the share of available days that is plannable, default 70%, leaving the rest for thinking, monitoring, and rituals.
- **Capacity**: a person's plannable days in a sprint: (working days - leave days - holidays) x focus factor. A full 10-day sprint gives 7 days.
- **Estimate**: per-skill person-days on a Jira ticket, read from the Jira fields FE Days, BE Days, Data Days, AI Days.
- **Skill-days**: an amount of estimated work in one skill, measured in specialist person-days.
- **Plannable ticket**: a Jira issue of type Story, Improvement, Tech Story, Bug, Prod Bug, or Dev Custom Task. Sub-tasks and Epics are not plannable.
- **Manual item**: work recorded in the platform, either non-Jira work (support, interviews, onboarding) or a placeholder for planned work not yet in Jira.
- **Attribution**: assigning a ticket's skill-days to specific people.
- **Stretch option**: a suggestion that a person works outside their main skill, costed in calendar days using their proficiency.
- **Snapshot**: a frozen record of a pod's capacity and commitment at sprint start, and of completion at sprint close.

## User Stories

In [spec/user-stories.md](spec/user-stories.md).

## Implementation Decisions

In [spec/implementation-decisions.md](spec/implementation-decisions.md): architecture, modules, Jira mapping, data model, the rules the planning engine encodes, snapshots and seed data.

## Testing Decisions

- A good test drives the system the way the UI does and asserts on what a pod lead would see. It does not assert on internal helpers, query shapes, or component structure, so refactors do not break it.
- **Primary seam: the service layer with a fake Jira client.** Tests run a sync against a fake client that serves recorded DTP responses, then call the same planning and editing functions the UI calls, against a real Postgres test database. They assert on returned view models: capacity by skill, committed skill-days, per-person load, flags, "not estimated" handling, exact and stretch suggestions, cross-pod hints, snapshots, and permission refusals.
- Fixtures are trimmed copies of real DTP responses (sprints from board 267, issues with POD, FE Days, BE Days, Dev Owners, sub-tasks, epics) so the field mapping is tested against reality.
- Key scenarios: a full sprint gives 7 days per person; half-day leave plus a holiday is proportional; a ticket with two FE owners splits evenly; a ticket with AI days and no AI owner raises a flag; a missing Data Days field shows as not estimated; a data engineer at 45% FE gets a stretch option costed at skill-days / 0.45; a lead cannot edit another pod's leave; concurrent syncs do not overlap; a sprint going active writes a start snapshot.
- **One thin browser test** (Playwright) for the sign-in boundary: an allowlisted account reaches its pod page, a non-allowlisted Delightree account sees pods read only, and an outside account sees the access-denied message.
- No unit tests for UI components or individual helpers.
- There is no prior art in this repo; it is a new project.

## Out of Scope

- Writing anything back to Jira (estimates, assignments, sprint moves).
- Ticket workflow, comments, or sub-tasks on manual items; anything that turns the platform into a Jira clone.
- QA and Design capacity.
- People in more than one pod, and history of pod membership.
- Per-person availability percentages (leads and new hires use full capacity; leave covers absence).
- An AI "Suggest a plan" assistant.
- Day ranges for T-shirt sizes.
- A custom domain (v1 uses the default Vercel URL).
- Jira projects other than DTP.

## Further Notes

- The Jira admin needs to add `Data Days` and `AI Days` number fields to DTP next to FE Days and BE Days. Until then, Data and AI show as not estimated.
- Most sampled DTP tickets do not yet have FE Days or BE Days filled in, so the first sprints will rely on the unestimated-tickets list to drive adoption.
- Pods start on 2026-10-26, which is the start of the "Oct Spint 2" sprint on board 267, so that sprint should produce the first start snapshot.
- RoadMap 2 has a single Data engineer and a single AI engineer, so leave for either one drops that skill's capacity to zero; the sprint view should make this obvious.
- The two Rebuild-pod new hires are added through the "No pod yet" list once they have Jira accounts.
