import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CirclePause, CirclePlay, Clapperboard, Copy, Expand, Minimize, Share2, Sparkles, X } from 'lucide-react';
import { useExperience } from '../context/ExperienceContext';
import { useModalA11y } from '../hooks/useModalA11y';
import type { Match } from '../types';
import { RemoteImage } from './Ui';
import { buildCinemaStory, type CinemaChapter, type CinemaEventInput, type CinemaSpecialEventInput } from './matchCinemaModel';

type CinemaDetails={home_team_logo?:string|null;away_team_logo?:string|null;venue_name?:string|null;venue_city?:string|null;league_round?:string|null};
type CinemaLineupPlayer={player?:{name?:string;number?:number|null;pos?:string|null}};
type CinemaLineup={id:number;team_name:string|null;formation:string|null;coach_name:string|null;startXI:CinemaLineupPlayer[]};
type CinemaTeamStats={id:number;team_name:string|null;statistics:{type:string;value:unknown}[]};
type Props={
  match:Match;
  details:CinemaDetails|null;
  events:CinemaEventInput[];
  specialEvents:CinemaSpecialEventInput[];
  lineups:CinemaLineup[];
  teamStats:CinemaTeamStats[];
  initialChapter?:string|null;
  onChapterChange:(chapter:string)=>void;
  onClose:()=>void;
};

const kindLabel:Record<CinemaChapter['kind'],string>={
  kickoff:'Kick-off',goal:'Gol','yellow-card':'Giallo','red-card':'Rosso',substitution:'Cambio',var:'VAR',special:'Evento speciale',event:'Azione',finish:'Finale',
};
const kindSymbol:Record<CinemaChapter['kind'],string>={
  kickoff:'▶',goal:'⚽','yellow-card':'■','red-card':'■',substitution:'↔',var:'VAR',special:'!',event:'•',finish:'■',
};
const speeds=[.75,1,1.5,2];

function numberOrNull(value:unknown){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  const parsed=Number.parseFloat(String(value??'').replace('%','').replace(',','.'));
  return Number.isFinite(parsed)?parsed:null;
}

function shortStatLabel(value:string){
  const normalized=value.toLowerCase();
  if(normalized.includes('possession')||normalized.includes('possesso'))return 'Possesso';
  if(normalized.includes('shots on')||normalized.includes('tiri in porta'))return 'Tiri in porta';
  if(normalized.includes('total shots')||normalized==='shots'||normalized.includes('tiri totali'))return 'Tiri';
  if(normalized.includes('corner'))return 'Corner';
  return value.replace(/_/g,' ');
}

export default function MatchCinema({match,details,events,specialEvents,lineups,teamStats,initialChapter,onChapterChange,onClose}:Props){
  const {reducedMotion}=useExperience();
  const story=useMemo(()=>buildCinemaStory({homeTeam:match.home_team,awayTeam:match.away_team,homeScore:match.home_score,awayScore:match.away_score,events,specialEvents}),[events,match.away_score,match.away_team,match.home_score,match.home_team,specialEvents]);
  const initialIndex=Math.max(0,story.chapters.findIndex(chapter=>chapter.id===initialChapter));
  const [index,setIndex]=useState(initialIndex);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [copied,setCopied]=useState(false);
  const [fullscreen,setFullscreen]=useState(Boolean(document.fullscreenElement));
  const shellRef=useRef<HTMLDivElement>(null);
  const dialogRef=useModalA11y(onClose);
  const chapter=story.chapters[index];

  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
  useEffect(()=>{const next=story.chapters.findIndex(item=>item.id===initialChapter);if(next>=0)setIndex(next);},[initialChapter,story.chapters]);
  useEffect(()=>{onChapterChange(chapter.id);},[chapter.id,onChapterChange]);
  useEffect(()=>{
    if(!playing)return;
    const timer=window.setInterval(()=>setIndex(current=>{
      if(current>=story.chapters.length-1){setPlaying(false);return current;}
      return current+1;
    }),Math.round(2600/speed));
    const pause=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',pause);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',pause);};
  },[playing,speed,story.chapters.length]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const textControl=target?.closest('input,select,textarea');
      const interactive=target?.closest('button,a,input,select,textarea');
      if(textControl)return;
      if(event.key==='ArrowLeft'){event.preventDefault();setPlaying(false);setIndex(value=>Math.max(0,value-1));}
      if(event.key==='ArrowRight'){event.preventDefault();setPlaying(false);setIndex(value=>Math.min(story.chapters.length-1,value+1));}
      if(event.key===' '&&!interactive){event.preventDefault();setPlaying(value=>!value);}
    };
    document.addEventListener('keydown',key);
    return()=>document.removeEventListener('keydown',key);
  },[story.chapters.length]);
  useEffect(()=>{const change=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);

  const go=(next:number)=>{setPlaying(false);setIndex(Math.max(0,Math.min(story.chapters.length-1,next)));};
  const toggleFullscreen=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await shellRef.current?.requestFullscreen();}catch{/* The browser can deny fullscreen without breaking the cinema. */}
  };
  const share=async()=>{
    try{await navigator.clipboard.writeText(window.location.href);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}
  };
  const cycleSpeed=()=>setSpeed(current=>speeds[(speeds.indexOf(current)+1)%speeds.length]);
  const stats=useMemo(()=>{
    if(teamStats.length>=2){
      const types=[...new Set(teamStats.flatMap(block=>block.statistics.map(stat=>stat.type)))];
      return types.filter(type=>/possession|possesso|shots|tiri|corner/i.test(type)).slice(0,3).map(type=>({
        label:shortStatLabel(type),values:teamStats.slice(0,2).map(block=>block.statistics.find(stat=>stat.type===type)?.value??'—'),
      }));
    }
    return [
      {label:'Possesso',values:[match.possession_home==null?'—':`${match.possession_home}%`,match.possession_away==null?'—':`${match.possession_away}%`]},
      {label:'Tiri',values:[match.shots_home??'—',match.shots_away??'—']},
      {label:'Tiri in porta',values:[match.shots_on_target_home??'—',match.shots_on_target_away??'—']},
    ].filter(row=>row.values.some(value=>value!=='—'));
  },[match,teamStats]);
  const progress=Math.round((index/(story.chapters.length-1))*100);
  const minuteProgress=chapter.kind==='finish'?100:Math.min(100,Math.max(0,((chapter.minute??0)/story.regulationMinutes)*100));
  const chapterKey=`${chapter.id}-${index}`;

  return createPortal(<div className="match-cinema fixed inset-0 z-[100] bg-black" role="presentation">
    <div ref={shellRef} className="match-cinema-shell relative flex h-[100dvh] min-h-[34rem] flex-col overflow-hidden bg-[#040605] text-white">
      <div className="match-cinema-lights pointer-events-none absolute inset-0" aria-hidden="true"/>
      <div className="match-cinema-grain pointer-events-none absolute inset-0 opacity-25" aria-hidden="true"/>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="match-cinema-title" tabIndex={-1} className="relative z-10 flex h-full min-h-0 flex-col outline-none">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300"><Clapperboard className="h-4.5 w-4.5" aria-hidden="true"/></span>
            <div className="min-w-0"><div id="match-cinema-title" className="truncate text-xs font-black uppercase tracking-[.22em] text-emerald-300">Match Cinema</div><div className="truncate text-[11px] text-zinc-400">{match.competition??'Competizione N/D'} · {match.season??'Stagione N/D'}</div></div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="match-cinema-icon" onClick={share} aria-label="Copia il link a questo capitolo" title="Condividi capitolo">{copied?<Copy className="h-4 w-4 text-emerald-300"/>:<Share2 className="h-4 w-4"/>}<span className="hidden text-xs sm:inline">{copied?'Copiato':'Condividi'}</span></button>
            {document.fullscreenEnabled&&<button className="match-cinema-icon hidden sm:inline-flex" onClick={toggleFullscreen} aria-label={fullscreen?'Esci da schermo intero':'Apri a schermo intero'} title={fullscreen?'Esci da schermo intero':'Schermo intero'}>{fullscreen?<Minimize className="h-4 w-4"/>:<Expand className="h-4 w-4"/>}</button>}
            <button className="match-cinema-icon" onClick={onClose} aria-label="Chiudi Match Cinema"><X className="h-5 w-5"/></button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 lg:overflow-hidden lg:px-7 lg:py-5">
          <div className="mx-auto grid min-h-full max-w-[1500px] content-center gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(21rem,.72fr)] lg:gap-6">
            <section className="relative flex min-h-[24rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/30 shadow-2xl sm:min-h-[30rem] lg:min-h-0" aria-label="Scena della partita">
              <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-zinc-300 backdrop-blur-lg">{kindLabel[chapter.kind]}</div>
                <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 font-black tabular-nums text-white backdrop-blur-lg">{chapter.minuteLabel}</div>
              </div>
              <CinemaPitch chapter={chapter} chapterKey={chapterKey} reducedMotion={reducedMotion}/>
              <div className="relative z-20 mt-auto bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-5 pt-24 sm:px-7 sm:pb-7">
                <div key={chapterKey} className={reducedMotion?'':'match-cinema-reveal'}>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">Capitolo {index+1} di {story.chapters.length}</div>
                  <h2 className="max-w-3xl text-3xl font-black leading-[.95] tracking-[-.04em] text-white sm:text-5xl lg:text-6xl">{chapter.title}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">{chapter.narration}</p>
                </div>
              </div>
            </section>

            <aside className="flex min-h-0 flex-col gap-3 lg:overflow-hidden" aria-label="Tabellone e approfondimenti">
              <section className="match-cinema-scoreboard shrink-0 rounded-[1.5rem] border border-white/10 bg-white/[.055] p-4 backdrop-blur-xl sm:p-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TeamIdentity name={match.home_team} logo={details?.home_team_logo} align="right"/>
                  <div className="text-center"><div className="text-4xl font-black tracking-[-.08em] tabular-nums sm:text-5xl">{chapter.homeScore==null||chapter.awayScore==null?'—':`${chapter.homeScore}–${chapter.awayScore}`}</div><div className="mt-1 text-[9px] font-black uppercase tracking-[.2em] text-zinc-400">{chapter.id==='finish'?'Finale':'Live story'}</div></div>
                  <TeamIdentity name={match.away_team} logo={details?.away_team_logo} align="left"/>
                </div>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Avanzamento della partita" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(minuteProgress)} aria-valuetext={chapter.minuteLabel}><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-200 transition-[width] duration-500" style={{width:`${minuteProgress}%`}}/></div>
              </section>

              {chapter.id==='start'&&lineups.length>0?<LineupPreview lineups={lineups}/>:chapter.id==='finish'&&stats.length>0?<StatsPreview stats={stats}/>:<StoryChapters chapters={story.chapters} current={index} onSelect={go}/>} 
              {story.coverage==='basic'&&<div className="shrink-0 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100"><b>Edizione essenziale.</b> Nessuna azione è stata ricostruita: vedi solo i dati verificati disponibili per questa gara.</div>}
            </aside>
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-black/55 px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl sm:px-5">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-2 flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Capitoli della partita">{story.chapters.map((item,itemIndex)=><button key={item.id} role="tab" aria-selected={itemIndex===index} aria-label={`${item.minuteLabel}: ${item.title}`} className={`group relative min-w-9 flex-1 py-1 ${itemIndex===index?'text-emerald-300':'text-zinc-400 hover:text-zinc-300'}`} onClick={()=>go(itemIndex)}><span className={`mx-auto block h-1.5 rounded-full transition ${itemIndex<=index?'bg-emerald-400':item.kind==='goal'?'bg-white/35':'bg-white/15'}`}/></button>)}</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[.16em] text-zinc-400"><span className="text-zinc-300">{progress}%</span><span className="hidden sm:inline"> · frecce per navigare</span></div>
              <div className="flex items-center gap-2">
                <button className="match-cinema-control" disabled={index===0} onClick={()=>go(index-1)} aria-label="Capitolo precedente"><ChevronLeft className="h-5 w-5"/></button>
                <button className="grid h-11 w-11 place-items-center rounded-full bg-white text-black transition hover:scale-105 disabled:opacity-50" onClick={()=>{if(index===story.chapters.length-1)setIndex(0);setPlaying(value=>!value);}} aria-label={playing?'Metti in pausa':'Riproduci la storia'}>{playing?<CirclePause className="h-6 w-6"/>:<CirclePlay className="h-6 w-6"/>}</button>
                <button className="match-cinema-control" disabled={index===story.chapters.length-1} onClick={()=>go(index+1)} aria-label="Capitolo successivo"><ChevronRight className="h-5 w-5"/></button>
              </div>
              <div className="flex justify-end"><button onClick={cycleSpeed} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-black tabular-nums text-zinc-300 hover:bg-white/10" aria-label={`Velocità ${speed} per. Cambia velocità`}>{speed}×</button></div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  </div>,document.body);
}

function TeamIdentity({name,logo,align}:{name:string;logo?:string|null;align:'left'|'right'}){
  return <div className={`flex min-w-0 flex-col gap-2 ${align==='right'?'items-end text-right':'items-start text-left'}`}><RemoteImage src={logo} alt={`Stemma ${name}`} className="h-10 w-10 rounded-xl object-contain sm:h-12 sm:w-12" width={48} height={48}/><div className="line-clamp-2 text-xs font-black leading-tight sm:text-sm">{name}</div></div>;
}

function CinemaPitch({chapter,chapterKey,reducedMotion}:{chapter:CinemaChapter;chapterKey:string;reducedMotion:boolean}){
  const danger=chapter.kind==='red-card'||chapter.kind==='special';
  const accent=chapter.kind==='yellow-card'?'#facc15':danger?'#fb7185':'#34d399';
  return <div className="absolute inset-0 overflow-hidden bg-[#07130d]" aria-hidden="true">
    <div className="match-cinema-vignette absolute inset-0"/>
    <svg className="absolute left-1/2 top-1/2 h-[82%] w-[92%] -translate-x-1/2 -translate-y-1/2 opacity-45" viewBox="0 0 900 540" fill="none">
      <defs><linearGradient id="pitchGlow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6ee7a0" stopOpacity=".7"/><stop offset="1" stopColor="#15803d" stopOpacity=".18"/></linearGradient></defs>
      <rect x="18" y="18" width="864" height="504" rx="10" stroke="url(#pitchGlow)" strokeWidth="3"/>
      <path d="M450 18v504M450 207a63 63 0 1 0 0 126 63 63 0 0 0 0-126ZM18 147h130v246H18m864-246H752v246h130M18 211h54v118H18m864-118h-54v118h54" stroke="url(#pitchGlow)" strokeWidth="3"/>
      <circle cx="450" cy="270" r="4" fill="#6ee7a0"/><circle cx="108" cy="270" r="4" fill="#6ee7a0"/><circle cx="792" cy="270" r="4" fill="#6ee7a0"/>
    </svg>
    <div key={chapterKey} className={`absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2 ${reducedMotion?'':'match-cinema-orb'}`}>
      <div className="absolute inset-0 scale-[2.5] rounded-full opacity-20 blur-3xl" style={{backgroundColor:accent}}/>
      <div className="relative grid h-24 w-24 place-items-center rounded-full border border-white/20 bg-black/60 text-center shadow-2xl backdrop-blur-xl sm:h-32 sm:w-32" style={{boxShadow:`0 0 80px ${accent}55`}}>
        <div><div className="text-2xl font-black sm:text-4xl" style={{color:accent}}>{kindSymbol[chapter.kind]}</div>{chapter.playerName&&<div className="mt-1 max-w-[7rem] truncate px-2 text-[9px] font-black uppercase tracking-wider text-white">{chapter.playerName}</div>}</div>
      </div>
    </div>
    <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent"/>
  </div>;
}

function StoryChapters({chapters,current,onSelect}:{chapters:CinemaChapter[];current:number;onSelect:(index:number)=>void}){
  const activeRef=useRef<HTMLButtonElement>(null);
  const {reducedMotion}=useExperience();
  useEffect(()=>{activeRef.current?.scrollIntoView({block:'nearest',behavior:reducedMotion?'auto':'smooth'});},[current,reducedMotion]);
  return <section className="min-h-[12rem] flex-1 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[.035] p-2 lg:min-h-0" aria-label="Cronologia"><div className="h-full space-y-1 overflow-y-auto pr-1">{chapters.map((item,index)=><button ref={index===current?activeRef:null} key={item.id} onClick={()=>onSelect(index)} className={`grid w-full grid-cols-[3.2rem_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${index===current?'border-emerald-300/30 bg-emerald-300/10':'border-transparent hover:bg-white/[.06]'}`}><span className={`font-black tabular-nums ${index===current?'text-emerald-300':'text-zinc-400'}`}>{item.minuteLabel}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{item.title}</span><span className="block truncate text-[10px] uppercase tracking-wider text-zinc-400">{kindLabel[item.kind]}</span></span><span className="text-sm" aria-hidden="true">{kindSymbol[item.kind]}</span></button>)}</div></section>;
}

function LineupPreview({lineups}:{lineups:CinemaLineup[]}){
  return <section className="min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-emerald-300"><Sparkles className="h-3.5 w-3.5"/>Formazioni iniziali</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{lineups.slice(0,2).map(lineup=><div key={lineup.id}><div className="mb-2 text-sm font-black">{lineup.team_name??'Squadra'} <span className="text-xs text-zinc-400">{lineup.formation??''}</span></div><div className="space-y-1">{lineup.startXI.map((row,index)=><div key={`${row.player?.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs"><span className="w-5 text-right font-black tabular-nums text-emerald-300">{row.player?.number??'—'}</span><span className="min-w-0 flex-1 truncate text-zinc-200">{row.player?.name??'N/D'}</span><span className="text-[9px] text-zinc-400">{row.player?.pos??''}</span></div>)}</div></div>)}</div></section>;
}

function StatsPreview({stats}:{stats:{label:string;values:unknown[]}[]}){
  const max=(values:unknown[])=>Math.max(1,...values.map(value=>numberOrNull(value)??0));
  return <section className="min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[.035] p-4"><div className="mb-5 text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Numeri finali</div><div className="space-y-5">{stats.map(stat=><div key={stat.label}><div className="mb-2 grid grid-cols-[3rem_1fr_3rem] items-center gap-2 text-sm font-black tabular-nums"><span>{String(stat.values[0]??'—')}</span><span className="text-center text-[10px] uppercase tracking-wider text-zinc-400">{stat.label}</span><span className="text-right">{String(stat.values[1]??'—')}</span></div><div className="grid grid-cols-2 gap-1"><div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-white/10"><span className="h-full rounded-full bg-emerald-300" style={{width:`${((numberOrNull(stat.values[0])??0)/max(stat.values))*100}%`}}/></div><div className="h-1.5 overflow-hidden rounded-r-full bg-white/10"><span className="block h-full rounded-full bg-white/55" style={{width:`${((numberOrNull(stat.values[1])??0)/max(stat.values))*100}%`}}/></div></div></div>)}</div></section>;
}
