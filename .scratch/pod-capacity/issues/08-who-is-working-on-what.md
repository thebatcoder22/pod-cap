# 08 - Who is working on what

**What to build:** For the selected sprint, a lead sees each person's load in skill-days and calendar days against their capacity, and can open a person to see their tickets.
Ticket work is attributed to the people doing it, with flags for work nobody in the ticket's owners can do, and owners from other pods shown as cross-pod help.

**Blocked by:** 04 - Jira user matching and the "No pod yet" list; 05 - Proficiency editing; 07 - Committed vs capacity per skill.

**Status:** done (commit f6f0d46, live at https://pod-cap.vercel.app)

- [x] A ticket's skill-days for a skill go to its Dev Owners with proficiency above zero in that skill, split evenly
- [x] If Dev Owners is empty, the assignee is used
- [x] Work with no eligible owner counts against the pod as unassigned work and raises a flag
- [x] Calendar days consumed = skill-days / proficiency; free days = capacity - calendar days, and can be negative
- [x] Each person shows load in skill-days and calendar days against capacity
- [x] Opening a person lists their sprint tickets with status and attributed skill-days
- [x] Dev Owners from other pods are shown as cross-pod help on the ticket
