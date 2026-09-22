'use client';
import { useEffect, useState } from 'react';

export function formatTime(value) {
  const n = Math.max(0, value || 0);
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export function secondsLeft(game) {
  if (game?.status !== 'running' || !game.started_at) return game?.remaining_seconds || 0;
  const deadline = new Date(game.started_at).getTime() + game.duration_seconds * 1000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

export function Timer({ game, big = false }) {
  const [remaining, setRemaining] = useState(game?.remaining_seconds || 0);
  useEffect(() => {
    setRemaining(secondsLeft(game));
    if (game?.status !== 'running') return;
    const timer = setInterval(() => setRemaining(secondsLeft(game)), 1000);
    return () => clearInterval(timer);
  }, [game]);
  const status = game?.status;
  return <div><div className={'timer ' + (big ? 'big' : '')}>{status === 'paused' ? 'PAUSED' : status === 'ended' || (status === 'running' && remaining === 0) ? 'GAME ENDED' : formatTime(remaining)}</div>{!big && <div className="state">{status === 'running' && remaining > 0 ? 'Time remaining' : status === 'not_started' ? 'Awaiting organizer start' : status === 'running' ? 'ended' : status}</div>}</div>;
}

export function usePoll(url, initial, interval = 10000) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const next = await response.json();
          if (active) { setData(next); setError(''); }
        } else if (active) setError(`Request failed (${response.status}).`);
      } catch { if (active) setError('Network error. Please try again.'); }
      finally { pending = false; }
    };
    load();
    const timer = setInterval(load, interval);
    const onVisibility = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [url, interval]);
  return [data, async () => {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) { setData(await response.json()); setError(''); }
    else setError(`Request failed (${response.status}).`);
  }, error];
}
