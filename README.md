# Blue Hour

Local, single-server Next.js vulnerability discovery and reporting game. QuickCart intentionally contains five training-only vulnerabilities and must only be exposed on a trusted event network.

## Requirements

Node.js 18.17+ and npm. No cloud database or external service is required after dependencies are installed.

## Install and configure

```bash
npm install
cp .env.example .env.local
```

Set `ORGANIZER_PASSCODE` in `.env.local`; set a long unique `ORGANIZER_SESSION_SECRET` before the event.

## Initialize and run

```bash
npm run setup
npm run dev
```

Open `http://localhost:3000`. For a room network, run `npm run dev -- -H 0.0.0.0` and use the laptop’s LAN address. The SQLite file is `blue-hour.sqlite` in the project directory (or set `BLUE_HOUR_DB_PATH`).

The first setup starts with no teams and no public scoreboard. Participants can create their own team from `/`, or they can join an existing team with its team name and join code. Use `/organizer` to authenticate, control the timer, review reports, and clear event data. The game only accepts hints and submissions while the organizer has started the timer.

## Operational notes

QuickCart is deliberately vulnerable by design. Put this app on an isolated classroom/event LAN, do not deploy it to the public Internet, and change the organizer secrets before use. The reset action requires an in-browser confirmation and permanently clears the event’s team-specific flags and SQLite QuickCart tables.
