import { useEffect,useState } from 'react';
import { api } from '../services/api';
import { Loading, PageTitle, fmt } from '../components/Ui';
import { CalculationContext, MetricMethod, type StatisticDefinition } from '../components/CalculationDisclosure';
import type { Match } from '../types';

type Meta={lastRecalculation:string|null;filters:{competition:string|null;from:string|null;to:string|null};coverage:{matches:number;seasons:number;competitions:string[];fromDate:string|null;toDate:string|null};definitions:StatisticDefinition[]};
type D={biggestWin:Match|null;biggestHomeWin:Match|null;biggestAwayWin:Match|null;biggestDefeat:Match|null;longestWinningStreak:number|null;longestUnbeatenStreak:number|null;longestLosingStreak:number|null;mostGoalsInMatch:Match|null;meta:Meta};
const match=(m:Match|null)=>m?`${m.home_team} ${m.home_score ?? '?'}–${m.away_score ?? '?'} ${m.away_team}`:'N/D';

function RecordCard({label,value,definition}:{label:string;value:string|number|null;definition?:StatisticDefinition}){
  return <article className="card p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div><div className="mt-3 text-xl font-black tracking-tight text-white">{fmt(value)}</div><MetricMethod definition={definition}/></article>;
}

export default function Records(){
  const[d,setD]=useState<D|null>(null);const[competition,setCompetition]=useState('');const[from,setFrom]=useState('');const[to,setTo]=useState('');
  useEffect(()=>{const q=new URLSearchParams();if(competition)q.set('competition',competition);if(from)q.set('from',from);if(to)q.set('to',to);api<D>(`/records?${q}`).then(setD)},[competition,from,to]);
  if(!d)return <Loading/>;
  const definition=Object.fromEntries(d.meta.definitions.map(item=>[item.key,item]));
  const perimeter=[competition||'tutte le competizioni',from?`da ${from}`:'',to?`a ${to}`:''].filter(Boolean).join(' · ');
  const cards:[keyof Omit<D,'meta'>,string,(value:any)=>string|number|null][]=[['biggestWin','Vittoria più ampia',match],['biggestHomeWin','Miglior vittoria casa',match],['biggestAwayWin','Miglior vittoria fuori',match],['biggestDefeat','Sconfitta più ampia',match],['longestWinningStreak','Serie vittorie',value=>value],['longestUnbeatenStreak','Serie senza sconfitte',value=>value],['longestLosingStreak','Serie sconfitte',value=>value],['mostGoalsInMatch','Più gol in una gara',match]];
  return <><PageTitle title="Records" subtitle="Record calcolati esclusivamente dalle gare completate nel perimetro selezionato."/><div className="card mb-5 grid gap-3 p-4 md:grid-cols-3"><select aria-label="Competizione" className="input" value={competition} onChange={e=>setCompetition(e.target.value)}><option value="">Tutte le competizioni</option><option>Serie A</option><option>Serie B</option><option>Coppa Italia</option><option>Europa League</option></select><input aria-label="Stagione iniziale" className="input" value={from} onChange={e=>setFrom(e.target.value)} placeholder="Da stagione"/><input aria-label="Stagione finale" className="input" value={to} onChange={e=>setTo(e.target.value)} placeholder="A stagione"/></div><CalculationContext lastRecalculation={d.meta.lastRecalculation} perimeter={perimeter} items={[{label:'Gare concluse',value:d.meta.coverage.matches},{label:'Stagioni',value:d.meta.coverage.seasons},{label:'Competizioni trovate',value:d.meta.coverage.competitions.length},{label:'Intervallo gare',value:d.meta.coverage.fromDate&&d.meta.coverage.toDate?`${d.meta.coverage.fromDate.slice(0,10)} → ${d.meta.coverage.toDate.slice(0,10)}`:'N/D'}]}/><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map(([key,label,display])=><RecordCard key={key} label={label} value={display(d[key])} definition={definition[key]}/>)}</div></>;
}
