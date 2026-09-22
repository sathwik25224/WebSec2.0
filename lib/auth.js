import crypto from 'crypto';

const organizerName = 'blue_hour_organizer';
const teamName = 'blue_hour_team';
const organizerLifetimeMs = 12 * 60 * 60 * 1000;
const configuredSecret = (name, placeholder) => {
  const value = process.env[name];
  return value && value.length >= 32 && value !== placeholder ? value : '';
};
const organizerSecret = () => configuredSecret('ORGANIZER_SESSION_SECRET', 'replace-with-a-long-random-string');
const teamSecret = () => configuredSecret('TEAM_SESSION_SECRET', 'replace-with-a-separate-long-random-string');
const sign = (value, secret) => crypto.createHmac('sha256', secret).update(value).digest('base64url');

export function organizerCookie() { return organizerName; }
export function teamCookie() { return teamName; }
export function assertTeamSessionConfigured() { if (!teamSecret()) throw Error('TEAM_SESSION_SECRET is not configured.'); }
export function makeOrganizerToken() {
  if (!organizerSecret()) throw Error('ORGANIZER_SESSION_SECRET is not configured.');
  const body = `v2.${Date.now() + organizerLifetimeMs}`;
  return `${body}.${sign(body, organizerSecret())}`;
}
export function isOrganizer(value) {
  if (!value || !organizerSecret()) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [version, expiresAt, signature] = parts;
  if (version !== 'v2' || !/^\d+$/.test(expiresAt) || !signature || Number(expiresAt) <= Date.now()) return false;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(`${version}.${expiresAt}`, organizerSecret()));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
export function createTeamSessionToken(teamId) {
  assertTeamSessionConfigured();
  const raw = crypto.randomBytes(32).toString('base64url');
  const body = `v1.${teamId}.${raw}`;
  return { raw, token: `${body}.${sign(body, teamSecret())}` };
}
export function verifyTeamSessionToken(value) {
  if (!value || !teamSecret()) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [version, teamId, raw, signature] = parts;
  if (version !== 'v1' || !/^\d+$/.test(teamId) || !raw || !signature) return null;
  const body = `${version}.${teamId}.${raw}`;
  const expected = Buffer.from(sign(body, teamSecret()));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  return { teamId: Number(teamId), raw };
}
export function hashSessionToken(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
