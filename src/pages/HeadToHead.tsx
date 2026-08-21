import { FormEvent,useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Empty, PageTitle, StatCard } from '../components/Ui';
import MatchTable from '../components/MatchTable';
import type { Match } from '../types';

type H={opponent:string;played:number;wins:number;draws:number;losses:number;goalsFor:number;goalsAgainst:number;winPercentage:number;mostCommonScore:string|null;currentStreak:string;matches:Match[]};

export default function HeadToHead(){
  const[params,setParams]=useSearchParams();
  const[q,setQ]=useState(params.get('opponent')||'');
  const[d,setD]=useState<H|null>(null);
  const[suggestions,setSuggestions]=useState<{name:string}[]>([]);
  const[error,setError]=useState('');
  const opponent=params.get('opponent');

  useEffect(()=>{
    if(!opponent){setD(null);return;}
    const controller=new AbortController();setError('');
    void api<H>(`/h2h/${encodeURIComponent(opponent)}`,{signal:controller.signal}).then(setD).catch(cause=>{if((cause as Error).name!=='AbortError')setError(String(cause).replace(/^Error:\s*/,''));});
    return()=>controller.abort();
  },[opponent]);

  useEffect(()=>{
    if(!q.trim()){setSuggestions([]);return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>{void api<{name:string}[]>(`/h2h/suggestions?q=${encodeURIComponent(q)}`,{signal:controller.signal}).then(setSuggestions).catch(cause=>{if((cause as Error).name!=='AbortError')setSuggestions([]);});},180);
    return()=>{clearTimeout(timer);controller.abort();};
  },[q]);

  const submit=(event:FormEvent)=>{event.preventDefault();if(q.trim()){setSuggestions([]);setParams({opponent:q.trim()});}};
  return <>
    <PageTitle title="Head to Head" subtitle="Cerca un avversario: gli alias sono normalizzati prima del calcolo."/>
    <form onSubmit={submit} className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_auto]">
      <div className="relative"><input className="input" value={q} onChange={event=>setQ(event.target.value)} placeholder="Es. Milan o AC Milan" aria-label="Cerca avversario"/>{suggestions.length>0&&<div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">{suggestions.map(item=><button type="button" key={item.name} className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800" onClick={()=>{setQ(item.name);setSuggestions([]);}}>{item.name}</button>)}</div>}</div>
      <button className="btn-primary">Calcola</button>
    </form>
    {error&&<div role="alert" className="mb-5 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}
    {d&&<><p className="mb-3 text-sm text-zinc-400">Avversario normalizzato: <b className="text-white">{d.opponent}</b></p><div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8"><StatCard label="Partite" value={d.played}/><StatCard label="Vittorie" value={d.wins}/><StatCard label="Pareggi" value={d.draws}/><StatCard label="Sconfitte" value={d.losses}/><StatCard label="GF" value={d.goalsFor}/><StatCard label="GS" value={d.goalsAgainst}/><StatCard label="Vittorie %" value={`${d.winPercentage}%`}/><StatCard label="Serie" value={d.currentStreak}/></div>{d.matches.length?<MatchTable matches={d.matches}/>:<Empty title={`Nessun Sassuolo vs ${d.opponent}`} text="Importa lo storico partite per costruire automaticamente questo confronto."/>}</>}
  </>;
}
