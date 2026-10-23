# 08 - Who is working on what

**What to build:** For the selected sprint, a lead sees each person's load in skill-days and calendar days against their capacity, and can open a person to see their tickets.
Ticket work is attributed to the people doing it, with flags for work nobody in the ticket's owners can do, and owners from other pods shown as cross-pod help.

**Blocked by:** 04 - Jira user matching and the "No pod yet" list; 05 - Proficiency editing; 07 - Committed vs capacity per skill.

**Status:** ready-for-agent

- [ ] A ticket's skill-days for a skill go to its Dev Owners with proficiency above zero in that skill, split evenly
- [ ] If Dev Owners is empty, the assignee is used
- [ ] Work with no eligible owner counts against the pod as unassigned work and raises a flag
- [ ] Calendar days consumed = skill-days / proficiency; free days = capacity - calendar days, and can be negative
- [ ] Each person shows load in skill-days and calendar days against capacity
- [ ] Opening a person lists their sprint tickets with status and attributed skill-days
- [ ] Dev Owners from other pods are shown as cross-pod help on the ticket
