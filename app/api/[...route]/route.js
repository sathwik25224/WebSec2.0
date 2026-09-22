import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { controlGame, createTeam, createTeamSession, getGameState, leaderboard, organizerData, resetEvent, setQualityBonus, submit, teamByCode, teamDashboard, teamFromSession, useHint } from '@/lib/db';
import { isOrganizer, makeOrganizerToken, organizerCookie, teamCookie } from '@/lib/auth';
import { enforceRateLimit, enforceRateLimitKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (error) => json({ error: error.message || 'Request failed.' }, error.message?.includes('Unauthorized') ? 401 : error.message?.includes('locked') ? 423 : error.message?.includes('Too many') ? 429 : 400);
const organizer = () => isOrganizer(cookies().get(organizerCookie())?.value);
async function body(request) { try { return await request.json(); } catch { return {}; } }
async function requireTeam(expectedCode) {
  const team = await teamFromSession(cookies().get(teamCookie())?.value);
  if (!team || (expectedCode && team.join_code !== expectedCode)) throw Error('Unauthorized team session. Join your team again.');
  return team;
}
function attachTeamCookie(response, token) { response.cookies.set(teamCookie(), token, { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 }); return response; }

export async function GET(request, { params }) {
  try {
    const route = params.route.join('/'); const url = new URL(request.url);
    if (route === 'state') return json(await getGameState());
    if (route === 'leaderboard') return json(await leaderboard());
    if (route === 'team') { const team = await requireTeam(url.searchParams.get('code')?.toUpperCase()); return json(await teamDashboard(team.id)); }
    if (route === 'organizer/data') { if (!organizer()) throw Error('Unauthorized.'); return json(await organizerData()); }
    return json({ error: 'Not found.' }, 404);
  } catch (error) { return fail(error); }
}
export async function POST(request, { params }) {
  try {
    const route = params.route.join('/'); const data = await body(request);
    if (route === 'join') {
      enforceRateLimit(request, 'join', 300, 60_000);
      const team = await teamByCode(String(data.joinCode || '').toUpperCase());
      if (!team || team.name.toLowerCase() !== String(data.name || '').trim().toLowerCase()) throw Error('Team name and join code do not match.');
      return attachTeamCookie(json({ joinCode: team.join_code }), await createTeamSession(team.id));
    }
    if (route === 'submit') { const team = await requireTeam(); enforceRateLimitKey(`submit:team:${team.id}`, 30, 60_000); return json(await submit(team.id, data)); }
    if (route === 'hint') { const team = await requireTeam(); return json(await useHint(team.id, Number(data.vulnerabilityId), Number(data.tier))); }
    if (route === 'organizer/login') {
      enforceRateLimit(request, 'organizer-login', 300, 15 * 60_000);
      if (!process.env.ORGANIZER_PASSCODE || process.env.ORGANIZER_PASSCODE.length < 16 || process.env.ORGANIZER_PASSCODE === 'change-this-before-the-event') throw Error('ORGANIZER_PASSCODE is not configured securely.');
      if (String(data.passcode || '') !== process.env.ORGANIZER_PASSCODE) return json({ error: 'Incorrect passcode.' }, 401);
      const response = json({ ok: true }); response.cookies.set(organizerCookie(), makeOrganizerToken(), { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 12 }); return response;
    }
    if (!organizer()) throw Error('Unauthorized.');
    if (route === 'organizer/team') return json(await createTeam(data.name));
    if (route === 'organizer/timer') return json(await controlGame(data.action));
    if (route === 'organizer/quality') { await setQualityBonus(data.submissionId, data.qualityBonus); return json({ ok: true }); }
    if (route === 'organizer/reset') { if (data.confirm !== true) throw Error('Confirmation is required.'); await resetEvent(); return json({ ok: true }); }
    return json({ error: 'Not found.' }, 404);
  } catch (error) { return fail(error); }
}
