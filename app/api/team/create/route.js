import { NextResponse } from 'next/server';
import { createTeam } from '@/lib/db';

export async function POST(request) {
  try {
    const { name } = await request.json();
    return NextResponse.json(createTeam(name));
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not create team.' }, { status: 400 });
  }
}
