'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Timer, usePoll } from '@/components/live';

export default function Home() {
  const [state, , stateError] = usePoll('/api/state', null);
  const [join, setJoin] = useState({ name: '', joinCode: '' });
  const [createName, setCreateName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(path, payload) {
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    return data;
  }
  async function joinTeam(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const data = await send('/api/join', join); location.href = '/team/' + data.joinCode; }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function createTeam(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const data = await send('/api/team/create', { name: createName }); setMessage(`Team created. Your join code is ${data.join_code}. Opening dashboard…`); setTimeout(() => { location.href = '/team/' + data.join_code; }, 900); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <main className="shell"><nav className="nav"><Link className="brand" href="/">BLUE HOUR</Link><div className="navlinks"><Link href="/">Join</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/organizer">Organizer</Link></div></nav><section className="hero"><div><div className="eyebrow">Live vulnerability discovery & reporting</div><h1>BLUE<br/>HOUR</h1><p className="tagline">“You found it. Now prove it.”</p><p className="meta">A 40-minute cyber investigation game. Find the flaw in QuickCart, capture your team flag, and file a sharp report.</p></div><div className="card"><Timer game={state}/>{stateError && <div className="notice error">Game status unavailable: {stateError}</div>}<hr/><h2>Create or join</h2><form className="join" onSubmit={createTeam}><label>New Team Name<input required value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Cyber Hawks"/></label><button className="btn" disabled={busy}>{busy ? 'Working…' : 'Create a Team'}</button></form><p className="meta">Already have a code? Join below.</p><form className="join" onSubmit={joinTeam}><label>Team Name<input required value={join.name} onChange={e => setJoin({ ...join, name: e.target.value })}/></label><label>Join Code<input required placeholder="BLUE7A" value={join.joinCode} onChange={e => setJoin({ ...join, joinCode: e.target.value.toUpperCase() })}/></label><button className="btn secondary" disabled={busy}>{busy ? 'Working…' : 'Join Existing Team'}</button></form>{message && <div className={'notice ' + (message.startsWith('Team created') ? 'success' : 'error')} style={{ marginTop: 12 }}>{message}</div>}<p><Link href="/leaderboard">View Live Leaderboard →</Link></p></div></section></main>;
}
