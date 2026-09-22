# Blue Hour

Blue Hour is a 40-minute live vulnerability discovery and reporting event site. It runs on Next.js with Neon Serverless Postgres. QuickCart deliberately contains training-only vulnerabilities; deploy it only to an event-scoped environment with a dedicated database.

## Requirements

- Node.js 20+ for production (Node 18 is supported by the pinned local Neon driver)
- npm
- A Neon Postgres project

## Configure

```bash
npm ci
cp .env.example .env.local
```

Set all values in `.env.local`:

```env
DATABASE_URL=<Neon pooled PostgreSQL connection string>
ORGANIZER_PASSCODE=<strong, unique password>
ORGANIZER_SESSION_SECRET=<long random secret>
TEAM_SESSION_SECRET=<different long random secret>
```

Never commit `.env.local`, `blue-hour.sqlite`, or `blue-hour-backup.sqlite`.

## Create/update the database schema

```bash
npm run migrate
npm run verify-db
```

The migration is idempotent. It creates the schema, database-enforced indexes, team provisioning functions, and exactly five challenge definitions. It also updates an unstarted event from the old 35- or 50-minute default to 40 minutes. It does not create demo teams or scoreboard entries. `verify-db` checks the connected Neon database without changing data.

## Run locally

```bash
npm run dev
```

For an event LAN, use:

```bash
npm run dev -- -H 0.0.0.0
```

## Production environment variables

Configure the same four variables in Vercel for Production. Use the Neon/Vercel integration or add the pooled `DATABASE_URL` manually. Check the Production environment specifically; a Preview connection does not configure Production. Do not prefix these secrets with `NEXT_PUBLIC_`.

Deploy from this directory as a Next.js project with the default `npm run build` command. Database migrations are deliberately separate from Vercel builds, so Preview deployments cannot modify the event database. Before the event, run `npm run migrate` and `npm run verify-db` with the **same Neon connection string** used by Vercel Production. Then deploy or redeploy the application and confirm `/api/state` returns a `not_started` game with `duration_seconds: 2400`.

## Operational notes

- Participants can create a new team on `/` or join an existing one with the team name and join code.
- Team dashboard, hint, and submission APIs require a signed HttpOnly team-session cookie.
- The organizer controls the timer at `/organizer`.
- A paused or expired timer rejects flag submissions in the database, even when an old browser tab still shows an enabled form.
- **Clear Event Data** removes all event teams, flags, reports, hints, sessions, and per-team QuickCart tables. It retains the five challenge definitions.
- QuickCart has intentional information disclosure, IDOR, XSS, cookie tampering, and SQL injection challenges. The SQL injection query runs in a read-only transaction, but it can still read data accessible to the event database user. Do not connect it to unrelated data or expose it beyond the event audience.
- Use a separate browser profile for the organizer account and do not open participant-submitted QuickCart links from that profile. The reflected XSS challenge shares the site's origin with the organizer console.
- Before hosting 200 participants, load-test the actual Vercel deployment and Neon plan with a separate test database or Neon branch. Database throughput and function limits depend on the provisioned plans; this repository cannot certify a particular plan's capacity.
