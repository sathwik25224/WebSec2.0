import { NextResponse } from 'next/server';
import { createTeam, createTeamSession } from '@/lib/db';
import { teamCookie } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export async function POST(request) {
  try {
    enforceRateLimit(request, 'team-create', 5, 15 * 60_000);
    const { name } = await request.json();
    const team = await createTeam(name);
    const response = NextResponse.json(team);
    response.cookies.set(teamCookie(), await createTeamSession(team.id), { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not create team.' }, { status: error.message?.includes('Too many') ? 429 : 400 });
  }
}
