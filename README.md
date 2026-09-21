# Blue Hour

Blue Hour is a live vulnerability discovery and reporting event site. It runs on Next.js with Neon Serverless Postgres. QuickCart deliberately contains training-only vulnerabilities; deploy it only to an event-scoped environment with a dedicated database.

## Requirements

- Node.js 20+ for production (Node 18 is supported by the pinned local Neon driver)
- npm
- A Neon Postgres project

## Configure

```bash
npm install
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
```

The migration is idempotent. It creates the schema, database-enforced indexes, team provisioning functions, and exactly five challenge definitions. It does not create demo teams or scoreboard entries.

## Run locally

```bash
npm run dev
```

For an event LAN, use:

```bash
npm run dev -- -H 0.0.0.0
```

## Production environment variables

Configure the same four variables in Vercel for Production. Use the Neon/Vercel integration or add the pooled `DATABASE_URL` manually. Deploy only after `npm run migrate` has successfully run against the production Neon database.

## Operational notes

- Participants can create a new team on `/` or join an existing one with the team name and join code.
- Team dashboard, hint, and submission APIs require a signed HttpOnly team-session cookie.
- The organizer controls the timer at `/organizer`.
- **Clear Event Data** removes all event teams, flags, reports, hints, sessions, and per-team QuickCart tables. It retains the five challenge definitions.
- QuickCart has intentional information disclosure, IDOR, XSS, cookie tampering, and SQL injection challenges. Do not connect it to production data or expose it beyond the event audience.
