# 01 - Sign in with Google, allowlist and seeded pod page

**What to build:** A pod lead signs in with their Delightree Google account and lands on their own pod page, which lists the pod's members and main skills.
Anyone not on the allowlist sees a clear access-denied message.
Every pod is viewable read-only, and the server-side "can edit this pod" and "is admin" guards exist for later tickets.

**Blocked by:** None - can start immediately.

**Status:** done (commit 441bf31, live at https://pod-cap.vercel.app)

- [x] The four pods and the day-one roster are seeded with main skills, matching SPEC "Seed data"
- [x] The four leads are allowlisted and Aman is admin
- [x] An allowlisted lead lands on their own pod page after sign-in
- [x] A non-allowlisted account sees "You do not have access"
- [x] Sign-out works, and sessions last 30 days
- [x] Removing an address from the allowlist revokes access on the next request
- [x] Server-side guards refuse edits to another lead's pod and admin actions by non-admins
- [x] Service tests against real Postgres and one Playwright sign-in test
- [x] Deployed on Vercel with Neon; each deploy migrates and seeds before building

Notes for later tickets:
- Admin is a flag on the allowlist row, not a separate admin-email setting.
- The viewer's pod and admin flag are looked up per request, not stored in the session.
- Being admin grants no edit rights over other pods' data (stories 92 and 93).
