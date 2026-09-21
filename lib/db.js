import { neon, neonConfig } from '@neondatabase/serverless';
import crypto from 'crypto';
import { createTeamSessionToken, hashSessionToken, verifyTeamSessionToken } from '@/lib/auth';

// Neon pooled connection strings use the database host itself for HTTP queries.
// Pin this explicitly because the Node 18-compatible driver otherwise derives
// the legacy api.<region> endpoint for newer pooler hostnames.
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

const challengeSeed = [
  ['info_disclosure', 'Information Disclosure', 'easy', 50, 'Read what the application accidentally leaves behind.', 'The homepage has more than the visible page.'],
  ['idor', 'IDOR', 'easy', 50, 'Look at numeric identifiers in the order URL.', 'Does the application verify that the requested order belongs to you?'],
  ['xss', 'Reflected XSS', 'medium', 75, 'Try making feedback behave as markup, not prose.', 'The response reflects your message without encoding HTML.'],
  ['cookie_tamper', 'Cookie Tampering', 'medium', 75, 'Inspect the cookies QuickCart sets for this team.', 'Authorization trusts a browser-controlled role value.'],
  ['sqli', 'SQL Injection', 'hard', 100, 'Treat the login fields as part of a database query.', 'A quote can change the meaning of a concatenated SQL query.']
];
export const safeCode = (code) => /^[A-Z0-9]{4,12}$/.test(code || '');
const sql = () => {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is not configured. Run the PostgreSQL migration and configure Neon first.');
  return neon(process.env.DATABASE_URL);
};
const quoteIdentifier = (value) => `"${value.replace(/"/g, '""')}"`;
const tableFor = (prefix, code) => { if (!safeCode(code)) throw Error('Invalid team code.'); return quoteIdentifier(`${prefix}_${code}`); };
const randomFlag = (slug) => `FLAG{${slug}_${crypto.randomBytes(9).toString('base64url')}}`;
const uniqueCode = () => crypto.randomBytes(5).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export async function challenges() { return sql()('SELECT * FROM vulnerabilities ORDER BY id'); }
export async function teamByCode(code) { return safeCode(code) ? (await sql()('SELECT * FROM teams WHERE join_code=$1', [code]))[0] : undefined; }
export async function getGameState() {
  const db = sql();
  await db(`UPDATE game_state SET status='ended', duration_seconds=0, started_at=NULL WHERE id=1 AND status='running' AND duration_seconds - FLOOR(EXTRACT(EPOCH FROM (now() - started_at))) <= 0`);
  const [row] = await db(`SELECT status, started_at, duration_seconds, CASE WHEN status='running' THEN GREATEST(0, duration_seconds - FLOOR(EXTRACT(EPOCH FROM (now() - started_at)))) ELSE duration_seconds END::int AS remaining_seconds FROM game_state WHERE id=1`);
  return row;
}
export async function controlGame(action) {
  const db = sql();
  let rows;
  if (action === 'start') { rows = await db(`UPDATE game_state SET status='running', started_at=now() WHERE id=1 AND status IN ('not_started','paused') RETURNING status`); if (rows.length) await db(`UPDATE team_progress SET recommended_at=now()`); }
  else if (action === 'pause') rows = await db(`UPDATE game_state SET status='paused', duration_seconds=GREATEST(0, duration_seconds - FLOOR(EXTRACT(EPOCH FROM (now() - started_at)))::int), started_at=NULL WHERE id=1 AND status='running' RETURNING status`);
  else if (action === 'reset') { await db(`UPDATE game_state SET status='not_started', duration_seconds=2100, started_at=NULL WHERE id=1`); return getGameState(); }
  else throw Error('Unknown timer action.');
  if (!rows.length) throw Error(action === 'start' ? 'The timer is already running or must be reset after ending.' : 'The timer is not running.');
  return getGameState();
}
export async function createTeam(name) {
  const clean = String(name || '').trim();
  if (clean.length < 2 || clean.length > 60) throw Error('Team name must be 2–60 characters.');
  const flags = Object.fromEntries(challengeSeed.map(([slug]) => [slug, randomFlag(slug)]));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const code = uniqueCode();
      const [team] = await sql()('SELECT * FROM provision_team($1, $2, $3::jsonb)', [clean, code, JSON.stringify(flags)]);
      return { id: Number(team.id), name: team.name, join_code: team.join_code };
    } catch (error) {
      if (!String(error.message).includes('duplicate key')) throw error;
    }
  }
  throw Error('Could not generate a unique join code. Please try again.');
}
export async function createTeamSession(teamId) {
  const session = createTeamSessionToken(teamId);
  await sql()(`INSERT INTO team_sessions(team_id, token_hash, expires_at) VALUES($1,$2,now() + interval '24 hours')`, [teamId, hashSessionToken(session.raw)]);
  return session.token;
}
export async function teamFromSession(cookieValue) {
  const session = verifyTeamSessionToken(cookieValue);
  if (!session) return null;
  const [team] = await sql()(`SELECT t.* FROM team_sessions s JOIN teams t ON t.id=s.team_id WHERE s.team_id=$1 AND s.token_hash=$2 AND s.expires_at>now()`, [session.teamId, hashSessionToken(session.raw)]);
  return team || null;
}
export async function teamDashboard(teamId) {
  const db = sql();
  await db(`INSERT INTO team_progress(team_id,recommended_vulnerability_id,recommended_at) SELECT $1,MIN(id),now() FROM vulnerabilities ON CONFLICT(team_id) DO NOTHING`, [teamId]);
  await db(`UPDATE team_progress p SET recommended_vulnerability_id=COALESCE((SELECT v.id FROM vulnerabilities v WHERE v.id>p.recommended_vulnerability_id AND NOT EXISTS(SELECT 1 FROM team_solutions s WHERE s.team_id=p.team_id AND s.vulnerability_id=v.id) ORDER BY v.id LIMIT 1),p.recommended_vulnerability_id),recommended_at=now() WHERE p.team_id=$1 AND (EXISTS(SELECT 1 FROM team_solutions s WHERE s.team_id=p.team_id AND s.vulnerability_id=p.recommended_vulnerability_id) OR ((SELECT status FROM game_state WHERE id=1)='running' AND p.recommended_at<=now()-interval '8 minutes'))`, [teamId]);
  const [team] = await db(`WITH points AS (SELECT COALESCE(SUM(base_points_awarded + first_blood_bonus + quality_bonus),0)::int AS earned FROM submissions WHERE team_id=$1 AND is_correct=true), hints AS (SELECT COUNT(*)::int AS used FROM hints_used WHERE team_id=$1), challenge_data AS (SELECT jsonb_agg(jsonb_build_object('id',v.id,'slug',v.slug,'name',v.name,'difficulty',v.difficulty,'base_points',v.base_points,'status',CASE WHEN EXISTS(SELECT 1 FROM submissions s WHERE s.team_id=$1 AND s.vulnerability_id=v.id AND s.is_correct) THEN 'Solved' WHEN EXISTS(SELECT 1 FROM submissions s WHERE s.team_id=$1 AND s.vulnerability_id=v.id) THEN 'Attempted' ELSE 'Not Started' END,'hints',COALESCE((SELECT jsonb_agg(h.tier ORDER BY h.tier) FROM hints_used h WHERE h.team_id=$1 AND h.vulnerability_id=v.id),'[]'::jsonb)) ORDER BY v.id) AS items FROM vulnerabilities v) SELECT t.name,t.join_code,p.recommended_vulnerability_id AS "recommendedId",((SELECT earned FROM points)-((SELECT used FROM hints)*10))::int AS score,(SELECT items FROM challenge_data) AS challenges FROM teams t JOIN team_progress p ON p.team_id=t.id WHERE t.id=$1`, [teamId]);
  return { team: { name: team.name, joinCode: team.join_code }, score: team.score, game: await getGameState(), recommendedId: team.recommendedId, challenges: team.challenges };
}
export async function leaderboard() {
  const game = await getGameState();
  if (game.status === 'not_started') return { game, showScoreboard: false, teams: [], firstBlood: [] };
  const rows = await sql()(`WITH scores AS (SELECT t.id,COALESCE(SUM(s.base_points_awarded+s.first_blood_bonus+s.quality_bonus) FILTER (WHERE s.is_correct),0)::int - COALESCE((SELECT COUNT(*)*10 FROM hints_used h WHERE h.team_id=t.id),0)::int AS score FROM teams t LEFT JOIN submissions s ON s.team_id=t.id GROUP BY t.id), statuses AS (SELECT t.id,jsonb_agg(CASE WHEN EXISTS(SELECT 1 FROM submissions s WHERE s.team_id=t.id AND s.vulnerability_id=v.id AND s.is_correct) THEN 'Solved' WHEN EXISTS(SELECT 1 FROM submissions s WHERE s.team_id=t.id AND s.vulnerability_id=v.id) THEN 'Attempted' ELSE 'Not Started' END ORDER BY v.id) AS values FROM teams t CROSS JOIN vulnerabilities v GROUP BY t.id) SELECT t.name,t.join_code AS "joinCode",scores.score,statuses.values AS statuses FROM teams t JOIN scores ON scores.id=t.id JOIN statuses ON statuses.id=t.id ORDER BY scores.score DESC,t.name ASC`);
  const firstBlood = await sql()(`SELECT t.name,v.name AS vulnerability,f.awarded_at FROM first_bloods f JOIN teams t ON t.id=f.team_id JOIN vulnerabilities v ON v.id=f.vulnerability_id ORDER BY f.awarded_at DESC LIMIT 3`);
  return { game, showScoreboard: true, teams: rows, firstBlood };
}
export async function submit(teamId, body) {
  for (const field of ['vulnType', 'location', 'cause', 'impact', 'severity', 'reproduction']) if (!String(body[field] || '').trim()) throw Error('Please complete all required report fields.');
  if (!['low', 'medium', 'high'].includes(body.severity)) throw Error('Choose a valid severity.');
  const rows = await sql()(`SELECT * FROM submit_challenge($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [teamId, Number(body.vulnerabilityId), String(body.flag || '').trim(), body.vulnType, body.location, body.cause, body.impact, body.severity, body.reproduction, body.fixSuggestion || '']);
  const result = rows[0];
  return { id: result.id, correct: result.flag_was_valid, newlySolved: result.is_correct, base: result.base_points_awarded, firstBlood: result.first_blood_bonus, score: (await teamDashboard(teamId)).score };
}
export async function useHint(teamId, vulnerabilityId, tier) {
  tier = Number(tier); if (![1, 2].includes(tier)) throw Error('Invalid hint tier.');
  const inserted = await sql()(`INSERT INTO hints_used(team_id,vulnerability_id,tier,used_at) SELECT $1,$2,$3,now() FROM game_state WHERE id=1 AND status='running' ON CONFLICT DO NOTHING RETURNING tier`, [teamId, Number(vulnerabilityId), tier]);
  if (!inserted.length) throw Error((await getGameState()).status === 'running' ? 'That hint tier has already been used.' : 'Hints are locked unless the game is running.');
  const [vulnerability] = await sql()('SELECT hint_tier_1,hint_tier_2 FROM vulnerabilities WHERE id=$1', [Number(vulnerabilityId)]);
  if (!vulnerability) throw Error('Invalid challenge.');
  return { hint: tier === 1 ? vulnerability.hint_tier_1 : vulnerability.hint_tier_2, score: (await teamDashboard(teamId)).score };
}
export async function setQualityBonus(submissionId, qualityBonus) {
  const n = Number(qualityBonus); if (!Number.isInteger(n) || n < 0 || n > 20) throw Error('Quality bonus must be an integer from 0 to 20.');
  await sql()('UPDATE submissions SET quality_bonus=$1 WHERE id=$2', [n, Number(submissionId)]);
}
export async function organizerData() {
  const db = sql(); const [game, board, submissions, hints] = await Promise.all([getGameState(), leaderboard(), db(`SELECT s.*,t.name AS team_name,v.name AS vulnerability FROM submissions s JOIN teams t ON t.id=s.team_id JOIN vulnerabilities v ON v.id=s.vulnerability_id ORDER BY s.submitted_at DESC`), db(`SELECT h.*,t.name AS team_name,v.name AS vulnerability FROM hints_used h JOIN teams t ON t.id=h.team_id JOIN vulnerabilities v ON v.id=h.vulnerability_id ORDER BY h.used_at DESC`)]);
  return { game, leaderboard: board, submissions, hints };
}
export async function resetEvent() { await sql()('SELECT reset_event_data()'); }
export async function flagFor(teamId, slug) { const [row] = await sql()(`SELECT expected_flag FROM team_flags tf JOIN vulnerabilities v ON v.id=tf.vulnerability_id WHERE tf.team_id=$1 AND v.slug=$2`, [teamId, slug]); return row?.expected_flag; }
export async function orderFor(teamId, requestedId) { const [row] = await sql()('SELECT * FROM orders WHERE team_id=$1 AND order_number=$2', [teamId, Number(requestedId)]); return row; }
export async function attemptSqlInjection(teamCode, username, password) {
  const users = tableFor('users', teamCode);
  const query = `SELECT id, username, password, display_name, NULL::text AS secret FROM ${users} WHERE username = '${username}' AND password = '${password}'`;
  const rows = await sql()(query); // Intentionally vulnerable training query. Do not parameterize.
  const secret = rows.find((row) => typeof row.secret === 'string' && row.secret.startsWith('FLAG{'))?.secret;
  return { rows, secret };
}
