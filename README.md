# Pod capacity

Capacity, load and pick-up planning for Delightree pod leads, on top of Jira.
See `SPEC.md` for the full spec.

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
pnpm test:e2e   # Playwright sign-in test against a production build on podcap_e2e
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
   Also set `CRON_SECRET` (`openssl rand -hex 32`); Vercel Cron sends it to `/api/cron/sync`, which syncs Jira hourly (see `vercel.json`).
5. Deploy, then open Settings as the admin to connect Jira and manage who can sign in.
   The build runs `pnpm db:deploy` first (see `vercel.json`), which migrates and seeds the roster.
   Seeding only happens when no pods exist yet, so it is safe on every deploy.

Preview deployments also run migrations against their own `DATABASE_URL`.
Point previews at a Neon branch, not the production database.
