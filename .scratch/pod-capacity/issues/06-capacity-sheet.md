# 06 - Capacity sheet: leave, holidays, focus factor

**What to build:** For the selected sprint, a lead sees each person's capacity and the pod's capacity per skill, with the sprint's dates, working days and holidays so the numbers are explainable.
The lead enters leave per person in half-day steps for their own pod.
The admin maintains the company holiday calendar and the focus factor.

**Blocked by:** 03 - Jira sync of sprints and plannable tickets.

**Status:** ready-for-agent

- [ ] Capacity = (working days - leave - holidays) x focus factor, computed in one pure planning module
- [ ] A full 10-day sprint with no leave shows 7 days per person at the default 70% focus factor
- [ ] Half-day leave and a holiday reduce capacity proportionally
- [ ] Pod capacity per skill sums members whose main skill is that skill
- [ ] The sprint view shows dates, working days and holidays in the sprint
- [ ] Leads edit leave for their own pod only; the admin alone edits holidays and the focus factor; both enforced on the server
- [ ] A skill with zero capacity (for example RoadMap 2's only Data engineer on leave) is obvious in the view
