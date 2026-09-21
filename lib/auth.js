import crypto from 'crypto';

const organizerName = 'blue_hour_organizer';
const teamName = 'blue_hour_team';
const organizerSecret = () => process.env.ORGANIZER_SESSION_SECRET || process.env.ORGANIZER_PASSCODE || '';
const teamSecret = () => process.env.TEAM_SESSION_SECRET || '';
const sign = (value, secret) => crypto.createHmac('sha256', secret).update(value).digest('base64url');

export function organizerCookie() { return organizerName; }
export function teamCookie() { return teamName; }
export function makeOrganizerToken() { return `v1.${sign('blue-hour-organizer', organizerSecret())}`; }
export function isOrganizer(value) {
  if (!value || !organizerSecret()) return false;
  const actual = Buffer.from(value);
  const expected = Buffer.from(makeOrganizerToken());
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
export function createTeamSessionToken(teamId) {
  if (!teamSecret()) throw Error('TEAM_SESSION_SECRET is not configured.');
  const raw = crypto.randomBytes(32).toString('base64url');
  const body = `v1.${teamId}.${raw}`;
  return { raw, token: `${body}.${sign(body, teamSecret())}` };
}
export function verifyTeamSessionToken(value) {
  if (!value || !teamSecret()) return null;
  const [version, teamId, raw, signature] = value.split('.');
  if (version !== 'v1' || !/^\d+$/.test(teamId) || !raw || !signature) return null;
  const body = `${version}.${teamId}.${raw}`;
  const expected = Buffer.from(sign(body, teamSecret()));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  return { teamId: Number(teamId), raw };
}
export function hashSessionToken(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
