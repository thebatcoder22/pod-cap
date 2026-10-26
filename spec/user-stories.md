# User Stories

## Access and sign-in

1. As a pod lead, I want to sign in with my Delightree Google account, so that I do not need another password.
2. As the admin, I want only allowlisted email addresses to be able to sign in, so that the platform is not open to the whole company.
3. As a person who is not on the allowlist, I want a clear "you do not have access" message after Google sign-in, so that I know access was refused on purpose and not broken.
4. As the admin, I want to add or remove addresses on the allowlist, so that I can give access to a new pod lead without a code change.
5. As a pod lead, I want to stay signed in across browser sessions for a reasonable period, so that I do not log in every time I open the dashboard.
6. As a pod lead, I want to sign out, so that I can leave a shared machine safely.
7. As a pod lead, I want to land on my own pod's page after sign-in, so that the most relevant view is one click away.

## Jira connection and sync

8. As the admin, I want to enter the Jira site, account email, and API token on a settings page, so that the platform can read Jira on our behalf.
9. As the admin, I want the token to be stored encrypted and never shown again or sent to the browser, so that a leaked page cannot expose it.
10. As the admin, I want a "Test connection" action that confirms the token can read the DTP project, so that I know setup worked before relying on it.
11. As the admin, I want to replace the token, so that I can rotate it when it expires.
12. As a pod lead, I want Jira to sync automatically every hour, so that the numbers are fresh without anyone remembering to refresh.
13. As a pod lead, I want a "Sync now" button, so that I can pull changes immediately during a planning meeting.
14. As a pod lead, I want to see when the last successful sync happened, so that I know how fresh the numbers are.
15. As a pod lead, I want a clear error banner when a sync fails, with the reason, so that I do not plan on stale data without knowing it.
16. As a pod lead, I want two syncs never to run at the same time, so that pressing "Sync now" repeatedly cannot corrupt data.
17. As a pod lead, I want the sync to pull all sprints on the DTP board, including future ones, so that I can plan the next sprint before it starts.
18. As a pod lead, I want the sync to pull each plannable ticket's pod, sprint, status, type, priority, assignee, Dev Owners, parent epic, estimates, and Ready for Production Date, so that every view is built from current Jira facts.
19. As a pod lead, I want epics to be synced with their child tickets, so that I can see how big each epic really is.
20. As a pod lead, I want tickets that leave a sprint or change pod in Jira to move accordingly in the platform on the next sync, so that the platform never disagrees with Jira.

## Pods and people

21. As the admin, I want the four pods to exist from the start with their Jira POD values and leads, so that the platform matches the deck on day one.
22. As the admin, I want the starting roster seeded from the pod deck and Slack roles, so that nobody has to type in the team.
23. As the admin, I want each seeded person matched to their Jira account by email where Jira exposes it and by display name otherwise, so that tickets attach to the right people.
24. As the admin, I want to review and confirm uncertain Jira matches (for example two people named Rahul), so that no ticket is credited to the wrong person.
25. As the admin, I want a "No pod yet" list of Jira users who appear as assignees or Dev Owners on DTP tickets but are not in any pod, so that new hires and missed people surface on their own.
26. As the admin, I want to add a person from the "No pod yet" list to a pod in one action, so that onboarding a new hire takes seconds.
27. As the admin, I want to move a person from one pod to another, so that the platform follows reorganisations.
28. As the admin, I want to remove a person who has left the company, so that they stop counting toward capacity.
29. As a pod lead, I want each person to belong to exactly one pod, so that no capacity is ever counted twice.
30. As a pod lead, I want pod leads to appear as members of their own pod with full capacity, so that the work I do myself is counted.
31. As a pod lead, I want to see each member's name, main skill, and proficiencies on my pod page, so that I understand my team's shape at a glance.

## Proficiency

32. As a pod lead, I want each person's main skill set to 100% proficiency, so that their specialist work is costed at face value.
33. As a pod lead, I want to set a proficiency percentage for each of my people in each other skill, so that I can record that a data engineer can do some frontend work.
34. As a pod lead, I want proficiency to default to 0% outside the main skill, so that nobody is offered work they cannot do unless I decide otherwise.
35. As a pod lead, I want to edit proficiency only for my own pod's people, so that other leads cannot change how my team is modelled.
36. As a pod lead, I want proficiency to be visible to all leads, so that cross-pod suggestions are understandable.

## Capacity, leave, and holidays

37. As a pod lead, I want each person's capacity for a sprint computed as (working days - leave - holidays) x focus factor, so that I never do the arithmetic by hand.
38. As a pod lead, I want a full two-week sprint with no leave to show 7 days per person, so that the numbers match how we agreed to plan.
39. As a pod lead, I want to enter leave days per person per sprint, so that capacity reflects who is actually around.
40. As a pod lead, I want to enter half days of leave, so that a half-day off is not rounded away.
41. As a pod lead, I want leave to reduce capacity proportionally (leave also reduces the 30% buffer), so that the rule is consistent for everyone.
42. As the admin, I want to maintain one company holiday calendar, so that a holiday reduces everyone's capacity without each lead entering it.
43. As the admin, I want to change the focus factor, so that we can tune the 70% assumption later without code changes.
44. As a pod lead, I want to edit leave only for my own pod, so that other leads cannot change my team's availability.
45. As a pod lead, I want to see the capacity sheet for my pod for any sprint, so that I can keep it current before Day 1 planning as the deck asks.

## Estimates

46. As a pod lead, I want FE Days and BE Days read from Jira, so that estimates are entered once, in the place everyone already uses.
47. As a pod lead, I want Data Days and AI Days read from Jira once those fields exist, so that all four skills are covered.
48. As a pod lead, I want a skill whose Jira field does not exist yet, or is empty on a ticket, to show as "not estimated" rather than zero, so that missing estimates are visible instead of looking like free capacity.
49. As a pod lead, I want a list of plannable tickets in a sprint that have no estimates at all, so that I can chase them before committing.
50. As a pod lead, I want sub-tasks excluded from capacity math, so that work is not counted twice under its parent story.
51. As a pod lead, I want every ticket to link to its Jira page, so that editing an estimate is one click away.

## Sprint view (capacity of my pod)

52. As a pod lead, I want a sprint picker that defaults to the active sprint and can switch to the next or past sprints, so that I can plan ahead and look back.
53. As a pod lead, I want to see my pod's capacity per skill next to the committed skill-days for the sprint, so that I can see instantly which skill is overloaded and which has room.
54. As a pod lead, I want overloaded skills clearly marked with the size of the gap, so that I know how much to cut or move.
55. As a pod lead, I want manual items in the sprint to count against capacity like tickets do, so that support rotations and interviews are not invisible.
56. As a pod lead, I want the sprint view to include bugs picked from the backlog, so that bug work is planned with the same discipline as stories.
57. As a pod lead, I want the sprint view to show the sprint's dates and how many working days and holidays it contains, so that the capacity number is explainable.
58. As a pod lead, I want to look at any other pod's sprint view read-only, so that I can see where help might come from.

## Who is working on what

59. As a pod lead, I want each person's load in skill-days and calendar days against their capacity, so that I can see who is full and who has room.
60. As a pod lead, I want a ticket's skill-days attributed to its Dev Owners who have that skill, so that per-person load reflects how we actually split work.
61. As a pod lead, I want skill-days split evenly when several owners share the needed skill, so that the default is fair and predictable.
62. As a pod lead, I want the assignee counted alongside the Dev Owners, so that everyone working on a ticket is attributed, and simple tickets with no Dev Owners still attribute correctly.
63. As a pod lead, I want tickets with no owner and no assignee to appear as "unassigned work" that counts against the pod but no person, so that nothing falls through.
64. As a pod lead, I want a flag when a ticket has skill-days that none of its owners has proficiency in, so that I spot tickets with no one able to do part of the work.
65. As a pod lead, I want a person's list of tickets for the sprint with status and the skill-days attributed to them, so that I can answer "what is Mayank on" in one click.
66. As a pod lead, I want Dev Owners who belong to another pod to be shown as cross-pod help on that ticket, so that borrowed effort is visible.

## Who can pick up more

67. As a pod lead, I want a pick-up panel listing people with free capacity and how many days they have free, so that I know who can take more.
68. As a pod lead, I want backlog tickets from my pod that are estimated and fit a person's free days in their main skill suggested next to them, so that I can fill gaps quickly.
69. As a pod lead, I want suggestions ordered by Jira priority, so that the most important work is offered first.
70. As a pod lead, I want backlog bugs included in suggestions, so that free days go to bug fixing when there is no story that fits.
71. As a pod lead, I want stretch options that show a person taking a ticket outside their main skill, costed in calendar days using their proficiency, so that I can judge whether the trade is worth it.
72. As a pod lead, I want stretch options clearly labeled and listed after exact matches, so that I never mistake a stretch for a natural fit.
73. As a pod lead, I want no stretch option suggested for a skill where the person's proficiency is 0%, so that suggestions respect my judgement.
74. As a pod lead, I want an overloaded skill in my pod to show which of my people could cover it as a stretch and how many skill-days they could absorb, so that I can rebalance inside the pod first.
75. As a pod lead, I want hints about free capacity in other pods for the skills my pod is short on, so that I can ask another lead for help.
76. As a pod lead, I want suggestions to never change anything in Jira, so that I stay in control and assign in Jira myself.

## Manual items

77. As a pod lead, I want to add a manual item with title, person, skill, days, and sprint, so that non-Jira work counts against capacity.
78. As a pod lead, I want to add a placeholder manual item for work that is planned but not ticketed, so that I can reserve capacity during planning.
79. As a pod lead, I want to link a placeholder to a Jira ticket once it exists, so that the ticket's estimate takes over and the work is not counted twice.
80. As a pod lead, I want to edit and delete manual items in my own pod only, so that other pods' records stay intact.
81. As a pod lead, I want manual items to carry no status workflow, comments, or sub-items, so that the platform does not drift into a Jira clone.

## Epics

82. As a pod lead, I want to set a T-shirt size (S, M, L, XL) on an epic in the platform, so that grooming output is recorded where capacity is planned.
83. As a pod lead, I want each epic to show the sum of its child tickets' skill-days next to its T-shirt size, so that I can see how far the first guess drifted.
84. As a pod lead, I want each epic to show its Ready for Production Date from Jira, so that target deploy dates are visible next to the effort.
85. As a pod lead, I want an epic list for my pod, so that I know every epic before planning as the deck asks.

## History and trends

86. As a pod lead, I want a snapshot taken automatically when a sprint starts, recording capacity and committed skill-days per pod and skill, so that the commitment is preserved even if Jira changes later.
87. As a pod lead, I want a snapshot taken automatically when a sprint closes, recording completed skill-days per pod and skill, so that we can compare plan against delivery.
88. As the admin, I want to take or retake a snapshot manually, so that a missed cron run does not lose a sprint.
89. As a pod lead, I want a trends page for my pod showing capacity, committed, and completed per sprint by skill, so that I can see whether we over-commit and whether 70% is the right focus factor.
90. As a pod lead, I want to see other pods' trends, so that we can learn from each other at the monthly retro.

## Permissions

91. As a pod lead, I want to see every pod, so that cross-pod help is possible.
92. As a pod lead, I want edits (leave, proficiency, manual items, epic sizes) limited to my own pod, so that mistakes cannot spill into another team.
93. As the admin, I want to be the only one who can change the Jira token, focus factor, holidays, allowlist, and pod membership, so that shared settings have one owner.
94. As a pod lead, I want an attempt to edit another pod's data to be refused by the server, not just hidden in the UI, so that permissions cannot be bypassed.
