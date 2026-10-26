# Pod capacity

Capacity, load and pick-up planning for Delightree pod leads, on top of Jira.
See `SPEC.md` for the full spec.
Live at https://pod-cap.vercel.app for allowlisted pod leads.

Jira stays the source of truth for tickets, sprints, owners and estimates, and the platform never writes to it.
It owns only what Jira does not know: pods and people, proficiency per skill, leave, holidays, manual items, epic sizes and sprint history.

## What a pod lead sees

Each pod page, for any sprint on DTP board 267:

- **Capacity sheet**: each person's plannable days, (working days - leave - holidays) x focus factor, and the pod's capacity per skill (FE, BE, Data, AI).
- **Committed vs capacity**: the sprint's FE, BE, Data and AI Days from Jira plus manual items, against capacity, with overloaded skills and unestimated tickets called out.
- **Who is working on what**: each person's load in skill-days and calendar days, attributed to the assignee and Dev Owners, each ticket counted for the pod its owners are in, with cross-pod help and unassigned work flagged.
- **Pick-up panel**: backlog tickets that fit people with free days, exact matches before labeled stretch options, and where an overloaded skill's days could come from.
- **Manual items**: support, interviews and placeholders for work not ticketed yet, counted like tickets.
- **Epics**: T-shirt size next to the skill-days estimated on their tickets, and the Ready for Production Date.
- **Trends**: capacity and committed per skill frozen when each sprint starts, and completed when it closes.
- **Capacity calendar**: a month of weekdays with each person's booked hours against their plannable hours, per pod, and each pod's on the all-pods calendar.
  Hours are 8 a day, Monday to Friday, at the focus factor.
  Tickets have no dates in Jira, so each sprint's work and leave spread evenly over its working days.

Every lead sees every pod; leads edit only their own, enforced on the server.
The admin manages the Jira connection, focus factor, holidays, allowlist, pod membership and snapshots in Settings and on the Trends pages.

## Code map

- `src/server/planning.ts`: the planning engine, every capacity rule as pure functions with no I/O.
- `src/server/sync.ts` and `jira-client.ts`: the Jira sync, the only code that talks to Jira.
- `src/server/*.ts`: services that load data, call the planning engine and check permissions.
- `src/app/`: Next.js App Router pages and server actions.
- `tests/`: a fake Jira client serving trimmed real DTP responses, used by the service tests.

## Local development

Needs Node 22, pnpm and a local Postgres.

```sh
pnpm install
createdb podcap && createdb podcap_test && createdb podcap_e2e
cp .env.example .env        # fill in AUTH_SECRET, ENCRYPTION_KEY and the Google client
pnpm db:deploy              # migrate and seed the roster
pnpm dev
```

Set `E2E_TEST_LOGIN=1` in `.env` to sign in locally with just an email, without a Google client.
That path is never enabled on Vercel.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test       # service tests against podcap_test
pnpm test:e2e   # Playwright specs against a production build on podcap_e2e
```

## Schema changes

Edit `src/db/schema.ts`, then run `pnpm db:generate` and commit the new file in `drizzle/`.
`pnpm db:deploy` applies it.

## Hosting (Vercel + Neon)

1. Import the repo into Vercel.
2. Add Neon Postgres from the Vercel Marketplace and connect it to the project.
   This sets `DATABASE_URL`.
3. Create a Google OAuth client (Web application) in Google Cloud.
   Add `https://<your-vercel-domain>/api/auth/callback/google` as an authorized redirect URI.
4. Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `ENCRYPTION_KEY` in the Vercel project environment variables.
   `ENCRYPTION_KEY` (`openssl rand -base64 32`) encrypts the Jira API token; keep it stable, or the admin must re-enter the token.
   Also set `CRON_SECRET` (`openssl rand -hex 32`); Vercel Cron sends it to `/api/cron/sync`, which syncs Jira daily at 08:00 IST (see `vercel.json`; the Hobby plan allows only daily crons, so leads press "Sync now" for fresher data).
5. Deploy, then open Settings as the admin to connect Jira and manage who can sign in.
   The build runs `pnpm db:deploy` first (see `vercel.json`), which migrates and seeds the roster.
   Seeding only happens when no pods exist yet, so it is safe on every deploy.

Preview deployments also run migrations against their own `DATABASE_URL`.
Point previews at a Neon branch, not the production database.

## Dev and production

Work lands on the `dev` branch first and is checked on https://pod-cap-dev.vercel.app before it reaches production.

```sh
pnpm deploy:dev     # what is committed on dev, to pod-cap-dev.vercel.app
pnpm deploy:prod    # what is committed on main, to pod-cap.vercel.app
```

Ship a change by merging `dev` into `main`, then running `pnpm deploy:prod`.
Both upload `git archive` of the branch rather than the working folder, so uncommitted work and local files like `.env` never go up.

The dev site is a Vercel preview deployment with Preview environment variables.
Its `DATABASE_URL` points at the Neon branch `dev`, a copy of production, so nothing done on dev touches production data.
Reset it to a fresh copy of production from the Neon console.
Preview deployments sit behind Vercel Authentication, so only members of the Vercel team can open the dev site.

## Agent skills

`.agents/skills/` holds the Neon skills for coding agents, installed from `neondatabase/agent-skills` and pinned in `skills-lock.json`.
`.claude/skills/` links to them, so Claude Code picks them up too.
