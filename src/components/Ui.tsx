import type { ReactNode } from 'react';
import { Database, ExternalLink, Inbox, Sparkles, TableProperties, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export type PageTone='green'|'sky'|'amber'|'violet';
const pageToneClasses:Record<PageTone,{panel:string;glow:string;eyebrow:string}>={
  green:{panel:'from-zinc-900 via-zinc-900 to-emerald-950/70',glow:'bg-emerald-400/15',eyebrow:'text-emerald-300'},
  sky:{panel:'from-zinc-900 via-sky-950/45 to-cyan-950/70',glow:'bg-sky-400/20',eyebrow:'text-sky-300'},
  amber:{panel:'from-zinc-900 via-red-950/35 to-amber-950/65',glow:'bg-amber-400/20',eyebrow:'text-amber-300'},
  violet:{panel:'from-zinc-900 via-violet-950/45 to-orange-950/55',glow:'bg-orange-400/20',eyebrow:'text-orange-300'},
};
export function competitionTone(competition?:string|null):PageTone{
  const value=competition??'';
  if(/serie b/i.test(value))return 'sky';
  if(/coppa italia/i.test(value))return 'amber';
  if(/europa|conference|champions/i.test(value))return 'violet';
  return 'green';
}
export function PageTitle({title,subtitle,action,eyebrow='Sassuolo History',tone='green'}:{title:string;subtitle?:string;action?:ReactNode;eyebrow?:string;tone?:PageTone}){
  const resolvedTone=tone==='green'?competitionTone(subtitle):tone;
  const colors=pageToneClasses[resolvedTone];
  return <div className={`relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br ${colors.panel} px-5 py-6 shadow-panel md:px-7 md:py-7`}><div className={`pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full ${colors.glow} blur-3xl`}/><div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className={`mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.18em] ${colors.eyebrow}`}><Sparkles className="h-3.5 w-3.5"/>{eyebrow}</div><h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">{title}</h1>{subtitle&&<p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{subtitle}</p>}</div>{action}</div></div>;
}
export function Breadcrumb({items}:{items:{label:string;to?:string}[]}){return <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">{items.map((item,index)=><span className="flex items-center gap-2" key={`${item.label}-${index}`}>{index>0&&<span aria-hidden="true">/</span>}{item.to?<Link className="hover:text-neroverde-300" to={item.to}>{item.label}</Link>:<span className="text-zinc-300">{item.label}</span>}</span>)}</nav>}

export function competitionAccent(competition?:string|null){
  const value=competition||'';
  if(/serie a/i.test(value)) return {badge:'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',card:'border-l-2 border-l-emerald-400',line:'#34d399'};
  if(/serie b/i.test(value)) return {badge:'border-sky-400/35 bg-sky-400/10 text-sky-200',card:'border-l-2 border-l-sky-400',line:'#38bdf8'};
  if(/serie c/i.test(value)) return {badge:'border-rose-400/35 bg-rose-400/10 text-rose-200',card:'border-l-2 border-l-rose-400',line:'#fb7185'};
  if(/coppa italia/i.test(value)) return {badge:'border-amber-400/35 bg-amber-400/10 text-amber-100',card:'border-l-2 border-l-amber-400',line:'#fbbf24'};
  if(/europa|conference|champions/i.test(value)) return {badge:'border-violet-400/35 bg-violet-400/10 text-violet-200',card:'border-l-2 border-l-violet-400',line:'#a78bfa'};
  return {badge:'border-zinc-700 bg-zinc-800 text-zinc-300',card:'',line:'#a1a1aa'};
}
export function CompetitionBadge({competition,compact=false}:{competition?:string|null;compact?:boolean}){const value=competition||'N/D';return <span className={`badge ${competitionAccent(value).badge} ${compact?'max-w-24 truncate':''}`}>{value}</span>}
export function StatCard({label,value,hint,competition,title}:{label:string;value:ReactNode;hint?:string;competition?:string|null;title?:string}){return <div title={title} className={`card p-4 ${competition?competitionAccent(competition).card:''}`}><div className="flex items-start justify-between gap-2"><div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>{competition&&<CompetitionBadge competition={competition} compact/>}</div><div className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">{value ?? 'N/D'}</div>{hint&&<div className="mt-1.5 text-xs text-zinc-500">{hint}</div>}</div>}
export function Empty({title='Nessun dato disponibile',text='Importa i dati storici o usa Data Manager per aggiornare le fonti disponibili.',action}:{title?:string;text?:string;action?:ReactNode}){return <div className="card flex min-h-48 flex-col items-center justify-center p-8 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-neroverde-400/20 bg-neroverde-400/10 text-neroverde-300"><Inbox className="h-5 w-5"/></div><h3 className="font-bold text-white">{title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">{text}</p>{action&&<div className="mt-4">{action}</div>}</div>}
export const EmptyState=Empty;
export function Loading(){return <div className="card min-h-48 p-6" aria-live="polite" aria-label="Caricamento"><div className="mb-5 flex items-center gap-3 text-sm text-zinc-400"><Database className="animate-pulse text-neroverde-400"/>Caricamento dati…</div><div className="space-y-3"><div className="h-5 w-2/5 animate-pulse rounded bg-zinc-800"/><div className="h-4 w-full animate-pulse rounded bg-zinc-800"/><div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800"/></div></div>}
export function ErrorState({message='Non è stato possibile caricare questi dati.',retry}:{message?:string;retry?:()=>void}){return <div className="card flex min-h-48 flex-col items-center justify-center p-8 text-center"><h3 className="font-bold text-white">Qualcosa non ha funzionato</h3><p className="mt-2 text-sm text-zinc-500">{message}</p>{retry&&<button className="btn-secondary mt-4" onClick={retry}>Riprova</button>}</div>}
export function Score({home,away}:{home:number|null;away:number|null}){return <span className="font-black tabular-nums">{home==null||away==null?'N/D':`${home}–${away}`}</span>}
export const fmt=(v:unknown)=>v==null||v===''?'N/D':String(v);
export function CompletenessBadge({level,prefix=false}:{level?:'BASIC'|'STANDARD'|'DETAILED'|null;prefix?:boolean}){const value=level||'BASIC';return <Link aria-label={`${prefix?'Copertura ':''}${value}: leggi la definizione`} className={`badge text-[10px] hover:border-neroverde-400/50 ${value==='DETAILED'?'text-neroverde-300':value==='STANDARD'?'text-amber-200':'text-zinc-400'}`} to="/methodology#detail-levels">{prefix?'Copertura: ':''}{value}</Link>}
export function SourceBadge({provider,url,verifiedAt}:{provider?:string|null;url?:string|null;verifiedAt?:string|null}){if(!provider&&!verifiedAt)return null;return <span className="inline-flex items-center gap-1"><Link className="badge text-[10px] font-medium hover:border-neroverde-400/50" to="/methodology#sources" title="Come interpretiamo fonti e date di verifica">{provider||'Fonte'}{verifiedAt?` · ${new Date(verifiedAt).toLocaleDateString('it-IT')}`:''}</Link>{url&&<a aria-label={`Apri la fonte esterna ${provider||''}`.trim()} className="rounded p-1 text-zinc-500 hover:text-neroverde-300" href={url} target="_blank" rel="noreferrer" title="Apri la fonte esterna"><ExternalLink className="h-3.5 w-3.5"/></a>}</span>}
export function FilterBar({children,className='' }:{children:ReactNode;className?:string}){return <div className={`card mb-5 grid gap-3 p-3.5 md:p-4 ${className}`}>{children}</div>}
export function DataTable({children,label='Tabella dati'}:{children:ReactNode;label?:string}){return <div className="table-wrap" role="region" aria-label={label} tabIndex={0}><TableProperties className="sr-only"/>{children}</div>}
export function SectionTabs({children}:{children:ReactNode}){return <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{children}</div>}
export function SeasonHeader({season,competition,children}:{season:string;competition?:string|null;children?:ReactNode}){return <section className={`card mb-5 overflow-hidden p-5 md:p-6 ${competitionAccent(competition).card}`}><div className="mb-3"><CompetitionBadge competition={competition}/></div><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-zinc-500">Archivio stagione</div><h2 className="mt-1 text-3xl font-black text-white">{season}</h2></div>{children}</div></section>}
export function PlayerCard({name,photo,meta,children}:{name:string;photo?:string|null;meta?:ReactNode;children?:ReactNode}){return <article className="card flex items-center gap-3 p-4"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-zinc-800 font-black text-neroverde-300">{photo?<img className="h-full w-full object-cover" src={photo} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<UserRound className="h-5 w-5"/>}</div><div className="min-w-0"><div className="truncate font-bold text-white">{name}</div>{meta&&<div className="mt-1 text-xs text-zinc-500">{meta}</div>}{children}</div></article>}
