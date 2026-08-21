import { useCallback,useEffect,useMemo,useRef,useState,type ReactElement } from 'react';
import { ArrowRight,CalendarRange,ChevronLeft,ChevronRight,ExternalLink,Flag,MapPin,Sparkles,Trophy,Users } from 'lucide-react';
import { Link,useSearchParams } from 'react-router-dom';
import { useExperience } from '../context/ExperienceContext';
import { api } from '../services/api';
import { CompetitionBadge,ErrorState,SourceBadge,competitionAccent,fmt } from './Ui';

type JourneyPoint={matchId:number;date:string;round:string|null;result:'W'|'D'|'L';cumulativePoints:number;opponent:string;home:boolean;goalsFor:number;goalsAgainst:number};
type TimeSeason={
  season:string;headline:string;primaryCompetition:string|null;competitions:string[];finalPosition:number|null;manager:string|null;stadium:string|null;
  record:{matches:number|null;wins:number|null;draws:number|null;losses:number|null;goalsFor:number|null;goalsAgainst:number|null;points:number|null};
  keyPlayers:Array<{id:number;name:string;position:string|null;appearances:number|null;minutes:number|null;goals:number|null;assists:number|null;lastVerifiedAt:string|null}>;
  bestWin:{id:number;date:string;competition:string;homeTeam:string;awayTeam:string;homeScore:number;awayScore:number;margin:number;sourceProvider:string|null;sourceUrl:string|null}|null;
  journey:{finalPoints:number|null;points:JourneyPoint[]};
  milestones:Array<{date:string;season:string;type:string;title:string;detail:string;sourceUrl:string}>;
  honours:Array<{competition:string;season:string;kind:string;sourceUrl:string}>;
  coverage:{status:'complete'|'partial'|'unknown';expectedMatches:number|null;foundMatches:number;completedMatches:number;gapReason:string|null};
  source:{provider:string|null;url:string|null;lastVerifiedAt:string|null};
};
type TimeMachineData={generatedAt:string;range:{from:string|null;to:string|null;total:number};methodology:string;seasons:TimeSeason[]};

const tone=(competition:string|null)=>{
  if(/serie b/i.test(competition??''))return {panel:'from-sky-950/90 via-zinc-950 to-cyan-950/70',glow:'bg-sky-400/20',text:'text-sky-300'};
  if(/serie c/i.test(competition??''))return {panel:'from-rose-950/80 via-zinc-950 to-orange-950/50',glow:'bg-rose-400/20',text:'text-rose-300'};
  return {panel:'from-emerald-950/85 via-zinc-950 to-lime-950/55',glow:'bg-emerald-400/20',text:'text-emerald-300'};
};
const civilDate=(value:string)=>new Date(value).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});
const coverageLabel={complete:'Completa',partial:'Parziale',unknown:'Da costruire'} as const;

function JourneyChart({season,points,color,reducedMotion}:{season:string;points:JourneyPoint[];color:string;reducedMotion:boolean}){
  if(!points.length)return <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 bg-black/15 p-6 text-center text-sm text-zinc-400">Il percorso punti non è ancora ricostruibile dalle partite presenti.</div>;
  const maximum=Math.max(10,Math.ceil(Math.max(...points.map(point=>point.cumulativePoints))/10)*10);
  const coordinates=[{x:20,y:150},...points.map((point,index)=>({x:20+(index+1)*(560/points.length),y:150-(point.cumulativePoints/maximum)*118}))];
  const polyline=coordinates.map(point=>`${point.x},${point.y}`).join(' ');
  const area=`M ${coordinates.map(point=>`${point.x} ${point.y}`).join(' L ')} L 580 150 L 20 150 Z`;
  const final=coordinates.at(-1)!;
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
    <svg className="h-auto w-full" viewBox="0 0 600 180" role="img" aria-labelledby={`journey-title-${season.replace('/','-')}`} aria-describedby={`journey-desc-${season.replace('/','-')}`}>
      <title id={`journey-title-${season.replace('/','-')}`}>Percorso punti {season}</title>
      <desc id={`journey-desc-${season.replace('/','-')}`}>{points.length} partite ricostruite, da 0 a {points.at(-1)?.cumulativePoints} punti.</desc>
      {[32,91,150].map((y,index)=><g key={y}><line x1="20" x2="580" y1={y} y2={y} stroke="rgba(255,255,255,.09)"/><text x="4" y={y+4} fill="#a1a1aa" fontSize="10">{maximum-Math.round(index*maximum/2)}</text></g>)}
      <path d={area} fill={color} opacity=".12"/>
      <polyline className={reducedMotion?'':'time-machine-line'} points={polyline} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <circle cx={final.x} cy={final.y} r="6" fill={color}/><circle cx={final.x} cy={final.y} r="11" fill="none" stroke={color} opacity=".35"/>
      <text x="20" y="172" fill="#a1a1aa" fontSize="10">Inizio</text><text x="580" y="172" textAnchor="end" fill="#a1a1aa" fontSize="10">{points.at(-1)?.round??civilDate(points.at(-1)!.date)}</text>
    </svg>
    <p className="sr-only">{points.map(point=>`${point.round??civilDate(point.date)}: ${point.cumulativePoints} punti`).join('. ')}</p>
  </div>;
}

export default function TimeMachine(){
  const[data,setData]=useState<TimeMachineData|null>(null),[failed,setFailed]=useState(false),[index,setIndex]=useState(0);
  const[params,setParams]=useSearchParams(),{reducedMotion}=useExperience(),touchStart=useRef<number|null>(null);
  const load=useCallback(()=>{setFailed(false);void api<TimeMachineData>('/time-machine').then(result=>{
    setData(result);
    const requested=params.get('era');
    const requestedIndex=result.seasons.findIndex(item=>item.season===requested);
    const latestWithData=result.seasons.reduce((latest,item,position)=>(item.record.matches??0)>0||item.milestones.length>0?position:latest,-1);
    setIndex(requestedIndex>=0?requestedIndex:Math.max(0,latestWithData));
  }).catch(()=>setFailed(true));},[]);
  useEffect(load,[load]);
  const season=data?.seasons[index]??null,colors=tone(season?.primaryCompetition??null);
  const select=useCallback((next:number)=>{
    if(!data)return;
    const bounded=Math.max(0,Math.min(data.seasons.length-1,next));setIndex(bounded);
    const query=new URLSearchParams(params);query.set('era',data.seasons[bounded].season);setParams(query,{replace:true});
  },[data,params,setParams]);
  useEffect(()=>{if(!data)return;const requested=data.seasons.findIndex(item=>item.season===params.get('era'));if(requested>=0)setIndex(requested)},[data,params]);
  const chartColor=competitionAccent(season?.primaryCompetition).line;
  const compactSeasons=useMemo(()=>data?.seasons.filter((_,position)=>position===0||position===data.seasons.length-1||Math.abs(position-index)<=2)??[],[data,index]);

  if(failed)return <section className="mb-8" aria-labelledby="time-machine-title"><ErrorState message="La Time Machine non è disponibile; il resto della storia del club resta consultabile." retry={load}/></section>;
  if(!data||!season)return <section className="card mb-8 min-h-72 animate-pulse p-6" aria-label="Caricamento Sassuolo Time Machine"><div className="h-4 w-36 rounded bg-zinc-800"/><div className="mt-5 h-12 w-52 rounded bg-zinc-800"/><div className="mt-8 h-32 rounded-2xl bg-zinc-800/70"/></section>;
  const max=data.seasons.length-1;
  return <section id="time-machine" className="mb-9" aria-labelledby="time-machine-title">
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.2em] text-neroverde-300"><Sparkles aria-hidden="true" className="h-4 w-4"/>Archivio interattivo</div><h2 id="time-machine-title" className="mt-1 text-2xl font-black text-white md:text-3xl">Sassuolo Time Machine</h2><p className="mt-1 max-w-2xl text-sm text-zinc-400">Scorri le stagioni: ogni numero nasce dall’archivio e ogni lacuna resta visibile.</p></div><Link className="text-sm font-bold text-neroverde-300 hover:underline" to="/seasons">Tutto l’archivio <ArrowRight aria-hidden="true" className="inline h-4 w-4"/></Link></div>
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${colors.panel} shadow-2xl`} onTouchStart={event=>{touchStart.current=event.touches[0]?.clientX??null}} onTouchEnd={event=>{const start=touchStart.current,end=event.changedTouches[0]?.clientX??start;touchStart.current=null;if(start!=null&&end!=null&&Math.abs(end-start)>55)select(index+(end<start?1:-1))}}>
      <div className={`pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full ${colors.glow} blur-3xl`}/><div aria-hidden="true" className="pointer-events-none absolute -right-3 top-12 select-none text-[5.5rem] font-black leading-none text-white/[.035] sm:text-[9rem]">{season.season}</div>
      <div className="relative border-b border-white/10 p-4 sm:p-6">
        <div className="flex items-center gap-3"><button className="btn-secondary !px-3" aria-label="Stagione precedente" disabled={index===0} onClick={()=>select(index-1)}><ChevronLeft aria-hidden="true" className="h-5 w-5"/></button><div className="min-w-0 flex-1 text-center" aria-live="polite"><CompetitionBadge competition={season.primaryCompetition}/><div className="mt-2 text-4xl font-black tracking-tight text-white sm:text-6xl">{season.season}</div><div className={`mt-1 truncate text-sm font-bold ${colors.text}`}>{season.headline}</div></div><button className="btn-secondary !px-3" aria-label="Stagione successiva" disabled={index===max} onClick={()=>select(index+1)}><ChevronRight aria-hidden="true" className="h-5 w-5"/></button></div>
        <label htmlFor="season-time-machine" className="sr-only">Seleziona stagione</label><input id="season-time-machine" className="time-machine-range mt-6 w-full" type="range" min="0" max={max} value={index} onChange={event=>select(Number(event.target.value))} aria-valuetext={season.season}/>
        <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-zinc-400"><span>{data.range.from}</span><div className="hidden items-center gap-1 sm:flex">{compactSeasons.map(item=><button key={item.season} className={`rounded-full px-2 py-1 ${item.season===season.season?'bg-white/10 text-white':'hover:text-white'}`} onClick={()=>select(data.seasons.indexOf(item))}>{item.season}</button>)}</div><span>{data.range.to}</span></div>
      </div>
      <div className="relative grid gap-5 p-4 sm:p-6 xl:grid-cols-[1.12fr_.88fr]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Posizione" value={season.finalPosition==null?'N/D':`${season.finalPosition}ª`}/><Metric label="Punti" value={fmt(season.record.points)}/><Metric label="V-N-P" value={season.record.wins==null?'N/D':`${season.record.wins}-${season.record.draws??0}-${season.record.losses??0}`}/><Metric label="Gol" value={season.record.goalsFor==null?'N/D':`${season.record.goalsFor}-${season.record.goalsAgainst??0}`}/></div>
          <section aria-labelledby={`journey-heading-${index}`}><div className="mb-2 flex items-center justify-between gap-2"><h3 id={`journey-heading-${index}`} className="flex items-center gap-2 font-black"><CalendarRange aria-hidden="true" className="h-4 w-4"/>Il viaggio in campionato</h3><span className="text-xs text-zinc-400">{season.journey.points.length?`${season.journey.points.length} gare ricostruite`:'N/D'}</span></div><JourneyChart season={season.season} points={season.journey.points} color={chartColor} reducedMotion={reducedMotion}/></section>
          <div className="grid gap-3 sm:grid-cols-2"><Info icon={<Users/>} label="Allenatore" value={season.manager}/><Info icon={<MapPin/>} label="Stadio" value={season.stadium}/></div>
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="flex items-center gap-2 font-black"><Trophy aria-hidden="true" className="h-4 w-4 text-amber-300"/>La vittoria simbolo</h3>{season.bestWin?<Link className="mt-3 block rounded-xl border border-white/10 bg-white/[.04] p-4 transition hover:border-white/20" to={`/matches/${season.bestWin.id}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{season.bestWin.homeTeam}</div><div className="truncate text-sm font-bold">{season.bestWin.awayTeam}</div></div><div className="text-3xl font-black tabular-nums">{season.bestWin.homeScore}–{season.bestWin.awayScore}</div></div><div className="mt-2 text-xs text-zinc-400">{civilDate(season.bestWin.date)} · {season.bestWin.competition}</div></Link>:<p className="mt-3 text-sm text-zinc-400">Nessuna vittoria verificata disponibile per questa stagione.</p>}</section>
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="flex items-center gap-2 font-black"><Users aria-hidden="true" className="h-4 w-4 text-neroverde-300"/>Protagonisti</h3>{season.keyPlayers.length?<div className="mt-3 space-y-2">{season.keyPlayers.map((player,position)=><Link className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.035] p-3 hover:border-neroverde-400/30" to={`/players/${player.id}`} key={player.id}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neroverde-400/15 text-xs font-black text-neroverde-300">{position+1}</span><span className="min-w-0 flex-1"><b className="block truncate">{player.name}</b><span className="text-xs text-zinc-400">{player.position??'Ruolo N/D'} · {fmt(player.appearances)} pres.</span></span><span className="text-right"><b className="block">{fmt(player.goals)}</b><span className="text-[10px] uppercase text-zinc-400">gol</span></span></Link>)}</div>:<p className="mt-3 text-sm text-zinc-400">Statistiche individuali non disponibili: nessun protagonista viene stimato.</p>}</section>
          {(season.milestones.length>0||season.honours.length>0)&&<section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="flex items-center gap-2 font-black"><Flag aria-hidden="true" className="h-4 w-4 text-neroverde-300"/>Momenti da ricordare</h3><div className="mt-3 space-y-3">{season.milestones.map(item=><article key={`${item.date}-${item.title}`}><div className="text-sm font-bold">{item.title}</div><p className="mt-1 text-xs leading-5 text-zinc-400">{item.detail}</p><a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-neroverde-300 hover:underline" href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte <ExternalLink aria-hidden="true" className="h-3 w-3"/></a></article>)}</div></section>}
        </div>
      </div>
      <footer className="relative flex flex-col gap-3 border-t border-white/10 bg-black/15 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex flex-wrap items-center gap-2"><span className={`badge ${season.coverage.status==='complete'?'border-emerald-400/30 text-emerald-200':season.coverage.status==='partial'?'border-amber-400/30 text-amber-100':'text-zinc-400'}`}>Copertura {coverageLabel[season.coverage.status]}</span><span className="text-zinc-400">{season.coverage.completedMatches}/{season.coverage.expectedMatches??'?'} gare concluse</span><SourceBadge provider={season.source.provider} url={season.source.url} verifiedAt={season.source.lastVerifiedAt}/></div><Link className="btn-secondary whitespace-nowrap" to={`/seasons/${encodeURIComponent(season.season)}${season.primaryCompetition?`?competition=${encodeURIComponent(season.primaryCompetition)}`:''}`}>Apri la stagione <ArrowRight aria-hidden="true" className="h-4 w-4"/></Link></footer>
    </div>
    <p className="mt-2 text-xs leading-5 text-zinc-400">{data.methodology} Su mobile puoi anche scorrere lateralmente.</p>
  </section>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</div><div className="mt-1 text-xl font-black text-white">{value}</div></div>}
function Info({icon,label,value}:{icon:ReactElement;label:string;value:string|null}){return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-neroverde-300 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">{icon}</span><span><span className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</span><b className="mt-1 block">{value??'N/D'}</b></span></div>}
