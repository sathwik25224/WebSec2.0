'use client';
import Link from 'next/link';
import { Timer, usePoll } from '@/components/live';

export default function Leaderboard() {
  const [data] = usePoll('/api/leaderboard', null);
  if (!data) return <main className="shell">Loading scoreboard…</main>;
  return <main className="shell"><nav className="nav"><Link className="brand" href="/">BLUE HOUR</Link><div className="navlinks"><Link href="/">Join</Link><Link href="/organizer">Organizer</Link></div></nav><Timer game={data.game} big/><p className="state" style={{ textAlign: 'center' }}>LIVE PUBLIC LEADERBOARD · Refreshes automatically</p>{!data.showScoreboard ? <div className="card" style={{ maxWidth: 700, margin: '36px auto', textAlign: 'center' }}><div className="eyebrow">Scoreboard offline</div><h2>No scoreboard — event not started</h2><p className="meta">Teams may create or join now. Scores and captures appear here once the organizer starts the game.</p></div> : <><>{data.firstBlood.slice(0, 3).map((x, i) => <div className="card firstblood" key={i}>⚡ <b>FIRST BLOOD</b> — {x.name} captured {x.vulnerability} first! <b>+10</b></div>)}</><div className="card tablewrap"><table className="table"><thead><tr><th>Rank</th><th>Team</th><th>Score</th><th>Information Disclosure</th><th>IDOR</th><th>Reflected XSS</th><th>Cookie Tampering</th><th>SQL Injection</th></tr></thead><tbody>{data.teams.map((t, i) => <tr key={t.joinCode}><td className="rank">#{i + 1}</td><td><b>{t.name}</b></td><td className="timer" style={{ fontSize: '1.4rem' }}>{t.score}</td>{t.statuses.map((s, j) => <td key={j} className={s === 'Solved' ? 'solved' : s === 'Attempted' ? 'attempted' : 'not-started'}>{s === 'Solved' ? '✓ Captured' : s === 'Attempted' ? '— Attempted' : '—'}</td>)}</tr>)}</tbody></table></div></>}</main>;
}
