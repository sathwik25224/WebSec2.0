import nextEnv from '@next/env';
import { neon, neonConfig } from '@neondatabase/serverless';

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is not configured.');
for (const [name, placeholder, minimum] of [
  ['ORGANIZER_PASSCODE', 'change-this-before-the-event', 16],
  ['ORGANIZER_SESSION_SECRET', 'replace-with-a-long-random-string', 32],
  ['TEAM_SESSION_SECRET', 'replace-with-a-separate-long-random-string', 32]
]) {
  const value = process.env[name];
  if (!value || value === placeholder || value.length < minimum) throw Error(`${name} must be set to a unique value of at least ${minimum} characters.`);
}
if (new Set([process.env.ORGANIZER_PASSCODE, process.env.ORGANIZER_SESSION_SECRET, process.env.TEAM_SESSION_SECRET]).size !== 3) throw Error('Organizer and team secrets must be different.');
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
const sql = neon(process.env.DATABASE_URL);
const [probe] = await sql.transaction([sql('SELECT 1 AS ok')], { readOnly: true });
if (probe[0]?.ok !== 1) throw Error('Neon read-only transactions are not working.');

const [schema] = await sql(`SELECT
  to_regclass('game_state') IS NOT NULL AS game_state,
  to_regclass('teams') IS NOT NULL AS teams,
  to_regclass('team_flags') IS NOT NULL AS team_flags,
  to_regclass('team_progress') IS NOT NULL AS team_progress,
  to_regclass('submissions') IS NOT NULL AS submissions,
  to_regclass('team_solutions') IS NOT NULL AS team_solutions,
  to_regclass('first_bloods') IS NOT NULL AS first_bloods,
  to_regclass('hints_used') IS NOT NULL AS hints_used,
  to_regclass('orders') IS NOT NULL AS orders,
  to_regclass('team_sessions') IS NOT NULL AS team_sessions`);
const missing = Object.entries(schema).filter(([, present]) => !present).map(([name]) => name);
if (missing.length) throw Error(`Missing database tables: ${missing.join(', ')}. Run npm run migrate.`);

const [game] = await sql(`SELECT status, duration_seconds FROM game_state WHERE id=1`);
if (!game) throw Error('The game_state row is missing. Run npm run migrate.');
if (game.status === 'not_started' && game.duration_seconds !== 2400) throw Error('The event timer is not set to 40 minutes. Run npm run migrate.');

const challenges = await sql(`SELECT slug FROM vulnerabilities ORDER BY slug`);
const expected = ['cookie_tamper', 'idor', 'info_disclosure', 'sqli', 'xss'];
if (JSON.stringify(challenges.map((row) => row.slug)) !== JSON.stringify(expected)) throw Error('The five challenge definitions are not installed correctly. Run npm run migrate.');

const functions = await sql(`SELECT proname, pg_get_functiondef(oid) AS definition FROM pg_proc WHERE proname IN ('submit_challenge', 'provision_team', 'reset_event_data') AND pg_function_is_visible(oid)`);
for (const name of ['submit_challenge', 'provision_team', 'reset_event_data']) {
  if (!functions.some((row) => row.proname === name)) throw Error(`Missing database function: ${name}. Run npm run migrate.`);
}
const submit = functions.find((row) => row.proname === 'submit_challenge').definition;
if (!submit.includes('clock_timestamp()') || !submit.includes('FOR SHARE')) throw Error('The flag submission timer guard is not installed. Run npm run migrate.');

console.log(`Neon database verified: ${challenges.length} challenges, timer ${game.duration_seconds}s (${game.status}), required tables and functions present.`);
