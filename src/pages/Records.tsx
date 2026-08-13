import { useEffect,useState } from 'react';
import { CalendarDays,ChevronRight,Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Loading, PageTitle, fmt } from '../components/Ui';
import { CalculationContext, MetricMethod, type StatisticDefinition } from '../components/CalculationDisclosure';
import type { Match } from '../types';

type Meta={lastRecalculation:string|null;filters:{competition:string|null;from:string|null;to:string|null};coverage:{matches:number;seasons:number;competitions:string[];fromDate:string|null;toDate:string|null};definitions:StatisticDefinition[]};
type RecordKey='biggestWin'|'biggestHomeWin'|'biggestAwayWin'|'biggestDefeat'|'longestWinningStreak'|'longestUnbeatenStreak'|'longestLosingStreak'|'mostGoalsInMatch';
type D={biggestWin:Match|null;biggestHomeWin:Match|null;biggestAwayWin:Match|null;biggestDefeat:Match|null;longestWinningStreak:number|null;longestUnbeatenStreak:number|null;longestLosingStreak:number|null;mostGoalsInMatch:Match|null;evidence:Record<RecordKey,Match[]>;meta:Meta};
const match=(m:Match|null)=>m?`${m.home_team} ${m.home_score ?? '?'}–${m.away_score ?? '?'} ${m.away_team}`:'N/D';
const date=(value:string)=>new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});

function Evidence({matches}:{matches:Match[]}){
  if(!matches.length)return <div className="mt-4 rounded-xl border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">Nessuna gara disponibile per questo perimetro.</div>;
  const first=matches[0],last=matches.at(-1)!;
  return <section className="mt-4 rounded-xl border border-neroverde-400/20 bg-neroverde-400/[.06] p-3" aria-label="Dati che determinano il record">
    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neroverde-300"><Database className="h-3.5 w-3.5"/>Dati del record</div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-300"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-zinc-500"/>{matches.length===1?date(first.date):`${date(first.date)} – ${date(last.date)}`}</span><span>{matches.length} {matches.length===1?'gara':'gare'}</span>{matches.length===1&&<span>{first.season||'Stagione N/D'} · {first.competition||'Competizione N/D'}</span>}</div>
    {matches.length===1?<Link className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-neroverde-300 hover:text-neroverde-200 hover:underline" to={`/matches/${first.id}`}>Apri la gara <ChevronRight className="h-3.5 w-3.5"/></Link>:<details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-neroverde-300 hover:text-neroverde-200">Mostra le {matches.length} gare della serie</summary><ol className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">{matches.map((item,index)=><li key={item.id}><Link className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded-lg bg-zinc-950/70 px-2.5 py-2 text-xs transition hover:bg-zinc-900" to={`/matches/${item.id}`}><span className="text-center font-black text-zinc-500">{index+1}</span><span className="min-w-0 truncate"><b className="text-zinc-100">{item.home_team} {item.home_score}–{item.away_score} {item.away_team}</b><span className="mt-0.5 block text-[10px] text-zinc-500">{item.season||'N/D'} · {item.competition||'N/D'}</span></span><span className="shrink-0 text-[10px] text-zinc-400">{date(item.date)}</span></Link></li>)}</ol></details>}
  </section>;
}

function RecordCard({label,value,definition,evidence}:{label:string;value:string|number|null;definition?:StatisticDefinition;evidence:Match[]}){
  return <article className="card flex min-h-full flex-col p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</div><div className="mt-3 text-xl font-black tracking-tight text-white">{fmt(value)}</div><div className="mt-auto"><Evidence matches={evidence}/><MetricMethod definition={definition}/></div></article>;
}

export default function Records(){
  const[d,setD]=useState<D|null>(null);const[competition,setCompetition]=useState('');const[from,setFrom]=useState('');const[to,setTo]=useState('');
  useEffect(()=>{const q=new URLSearchParams();if(competition)q.set('competition',competition);if(from)q.set('from',from);if(to)q.set('to',to);api<D>(`/records?${q}`).then(setD)},[competition,from,to]);
  if(!d)return <Loading/>;
  const definition=Object.fromEntries(d.meta.definitions.map(item=>[item.key,item]));
  const perimeter=[competition||'tutte le competizioni',from?`da ${from}`:'',to?`a ${to}`:''].filter(Boolean).join(' · ');
  const cards:[RecordKey,string,(value:any)=>string|number|null][]=[['biggestWin','Vittoria più ampia',match],['biggestHomeWin','Miglior vittoria casa',match],['biggestAwayWin','Miglior vittoria fuori',match],['biggestDefeat','Sconfitta più ampia',match],['longestWinningStreak','Serie vittorie',value=>value],['longestUnbeatenStreak','Serie senza sconfitte',value=>value],['longestLosingStreak','Serie sconfitte',value=>value],['mostGoalsInMatch','Più gol in una gara',match]];
  return <><PageTitle title="Records" subtitle="Record calcolati esclusivamente dalle gare completate nel perimetro selezionato."/><div className="card mb-5 grid gap-3 p-4 md:grid-cols-3"><select aria-label="Competizione" className="input" value={competition} onChange={e=>setCompetition(e.target.value)}><option value="">Tutte le competizioni</option><option>Serie A</option><option>Serie B</option><option>Coppa Italia</option><option>Europa League</option></select><input aria-label="Stagione iniziale" className="input" value={from} onChange={e=>setFrom(e.target.value)} placeholder="Da stagione"/><input aria-label="Stagione finale" className="input" value={to} onChange={e=>setTo(e.target.value)} placeholder="A stagione"/></div><CalculationContext lastRecalculation={d.meta.lastRecalculation} perimeter={perimeter} items={[{label:'Gare concluse',value:d.meta.coverage.matches},{label:'Stagioni',value:d.meta.coverage.seasons},{label:'Competizioni trovate',value:d.meta.coverage.competitions.length},{label:'Intervallo gare',value:d.meta.coverage.fromDate&&d.meta.coverage.toDate?`${d.meta.coverage.fromDate.slice(0,10)} → ${d.meta.coverage.toDate.slice(0,10)}`:'N/D'}]}/><div className="grid gap-3 lg:grid-cols-2">{cards.map(([key,label,display])=><RecordCard key={key} label={label} value={display(d[key])} evidence={d.evidence?.[key]??[]} definition={definition[key]}/>)}</div></>;
}
