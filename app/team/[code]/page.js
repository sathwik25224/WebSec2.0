'use client';
import Link from 'next/link';import {useParams} from 'next/navigation';import {useEffect,useState} from 'react';import {Timer,usePoll} from '@/components/live';
export default function Team(){const {code}=useParams();const [data,refresh,error]=usePoll('/api/team?code='+code,null);const [selected,setSelected]=useState(null);if(!data)return <main className="shell">{error||'Loading team dashboard…'}</main>;const current=selected?data.challenges.find(x=>x.id===selected):null;return <main className="shell"><nav className="nav"><Link className="brand" href="/">BLUE HOUR</Link><div className="navlinks"><a target="_blank" href={'/play/'+data.team.joinCode}>QuickCart ↗</a><Link href="/leaderboard">Leaderboard</Link></div></nav><div className="dashboard-head"><div><div className="eyebrow">Team dashboard</div><h1 style={{margin:'7px 0'}}>Team: {data.team.name}</h1></div><div className="stats"><Timer game={data.game}/><div className="timer" style={{fontSize:'2.2rem'}}>Score: {data.score}</div></div></div><div className="grid">{data.challenges.map((c,i)=><button key={c.id} className={'card challenge '+(c.id===data.recommendedId?'recommended':'')} onClick={()=>setSelected(c.id)}><span className={'pill '+c.difficulty}>{c.difficulty}</span><div className="meta">CHALLENGE {i+1}{c.id===data.recommendedId&&' · RECOMMENDED NEXT'}</div><h3>{c.name}</h3><div className="mono">{c.base_points} points</div><div className={'status '+c.status.toLowerCase().replace(' ','-')}>{c.status}</div></button>)}</div>{current&&<Challenge key={current.id} challenge={current} code={data.team.joinCode} game={data.game} refresh={refresh} close={()=>setSelected(null)}/>}</main>}
function Challenge({challenge,code,game,refresh,close}){const [form,setForm]=useState({flag:'',fixSuggestion:''});const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[hint,setHint]=useState('');const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);const locked=game.status!=='running'||!game.started_at||now>=new Date(game.started_at).getTime()+game.duration_seconds*1000;const set=(k,v)=>setForm({...form,[k]:v});async function submit(e){
  e.preventDefault();setBusy(true);setMsg('');
  try{
    const r=await fetch('/api/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...form,vulnerabilityId:challenge.id})});
    const d=await r.json();
    if(r.ok){
      setMsg({good:true,text:d.correct?(d.newlySolved?`✅ Correct! +${d.base} pts${d.firstBlood?' · ⚡ FIRST BLOOD +10':''}`:'✅ Correct — this challenge was already solved.'):'❌ Incorrect, try again'});
    }else setMsg({good:false,text:d.error||'Submission failed. Please try again.'});
    void refresh().catch(()=>{});
  }catch(error){setMsg({good:false,text:'Network error. Please try again.'});}
  finally{setBusy(false);}
}
async function getHint(tier){
  try{
    const r=await fetch('/api/hint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vulnerabilityId:challenge.id,tier})});
    const d=await r.json();
    setHint(r.ok?`Tier ${tier}: ${d.hint}`:d.error||'Could not load hint.');
    if(r.ok)void refresh().catch(()=>{});
  }catch{setHint('Network error. Please try again.');}
}
return <section className="card panel"><div className="dashboard-head"><div><div className="eyebrow">Challenge detail</div><h2>{challenge.name}</h2></div><button className="btn secondary" onClick={close}>Close panel</button></div><div className="two"><div><a className="btn" target="_blank" href={'/play/'+code}>Open QuickCart ↗</a><div className="actions"><button className="btn secondary" disabled={locked||challenge.hints.includes(1)} onClick={()=>getHint(1)}>Get Hint — Tier 1 · Cost: -10</button><button className="btn secondary" disabled={locked||challenge.hints.includes(2)} onClick={()=>getHint(2)}>Get Hint — Tier 2 · Cost: -10</button></div>{hint&&<div className="notice" style={{marginTop:12}}>{hint}</div>}{locked&&<div className="notice error" style={{marginTop:12}}>Submissions and hints unlock only while the organizer’s game timer is running.</div>}</div><form className={'join '+(msg?.good?'flash-good':msg?'flash-bad':'')} onSubmit={submit}><label>Flag<input className="mono" required value={form.flag} onChange={e=>set('flag',e.target.value)} placeholder="FLAG{...}"/></label><label>Fix Suggestion <span className="meta">(optional)</span><textarea value={form.fixSuggestion} onChange={e=>set('fixSuggestion',e.target.value)}/></label>{msg&&<div className={'notice '+(msg.good?'success':'error')}>{msg.text}</div>}<button className="btn" disabled={busy||locked}>{busy?'Submitting…':'Submit Flag'}</button></form></div></section>}
