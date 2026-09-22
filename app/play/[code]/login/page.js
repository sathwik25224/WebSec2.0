import QuickCart from '@/components/quickcart';
import { attemptSqlInjection, safeCode, teamByCode } from '@/lib/db';
import { notFound } from 'next/navigation';
import { enforceRateLimitKey } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';

export default async function Login({ params, searchParams }) {
  const team = await teamByCode(params.code);
  if (!team || !safeCode(team.join_code)) return notFound();
  const username = String(searchParams.username || ''); const password = String(searchParams.password || '');
  let result; let error;
  if (username || password) { try { enforceRateLimitKey(`quickcart-login:team:${team.id}`, 60, 60_000); result = await attemptSqlInjection(team.join_code, username, password); } catch (caught) { error = caught.message; } }
  return <QuickCart code={team.join_code}><div className="qcmain"><div className="eyebrow">Account access</div><h1>Sign in to QuickCart</h1><form method="GET" className="card join" style={{ maxWidth: 520 }}><label>Username<input name="username" defaultValue={username}/></label><label>Password<input type="password" name="password" defaultValue={password}/></label><button className="btn">Sign in</button></form>{result?.rows?.length > 0 && <div className="notice success" style={{ marginTop: 16 }}>Authentication query returned {result.rows.length} record{result.rows.length === 1 ? '' : 's'}.</div>}{result?.secret && <div className="notice success" style={{ marginTop: 16 }}>A database query selected a protected secret:<br/><span className="flag">{result.secret}</span></div>}{error && <div className="notice error" style={{ marginTop: 16 }}>Database error: {error}</div>}</div></QuickCart>;
}
