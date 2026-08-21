import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, CheckCircle2, Database, ExternalLink, FileCheck2, History, Link2, Radio, Rss, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Empty, ErrorState, Loading, PageTitle, StatCard } from '../components/Ui';
import { api } from '../services/api';

type EntryType='release'|'source'|'correction'|'incident';
type Entry={id:string;type:EntryType;status:'published'|'investigating'|'monitoring'|'resolved';publishedAt:string;title:string;summary:string;coverage:string[];links:Array<{label:string;href:string}>;releaseVersion:string|null};
type ArchiveStatus={
  status:{level:'operational'|'incident';title:string;message:string;lastUpdatedAt:string};
  dataset:{version:string;generatedAt:string;schemaVersion:number;databaseSha256:string;counts:{seasons:number;matches:number;players:number;playerSeasons:number;sourceReferences:number};coverage:{scopeVersion:number;complete:number;partial:number;unknown:number}};
  summary:{releases:number;sources:number;corrections:number;incidents:number};
  entries:Entry[];
};

const entryMeta:Record<EntryType,{label:string;icon:typeof Database;classes:string}>={
  release:{label:'Release',icon:Database,classes:'border-neroverde-400/35 bg-neroverde-400/10 text-neroverde-200'},
  source:{label:'Nuova fonte',icon:BookOpenCheck,classes:'border-sky-400/35 bg-sky-400/10 text-sky-200'},
  correction:{label:'Correzione',icon:FileCheck2,classes:'border-amber-400/35 bg-amber-400/10 text-amber-100'},
  incident:{label:'Incidente',icon:AlertTriangle,classes:'border-red-400/35 bg-red-400/10 text-red-100'},
};
const filters:Array<'all'|EntryType>=['all','release','source','correction','incident'];
const filterLabel:Record<(typeof filters)[number],string>={all:'Tutto',release:'Release',source:'Fonti',correction:'Correzioni',incident:'Incidenti'};

function formatDate(value:string){return new Date(value).toLocaleString('it-IT',{dateStyle:'long',timeStyle:'short'});}

export default function Status(){
  const[data,setData]=useState<ArchiveStatus|null>(null),[error,setError]=useState(''),[params,setParams]=useSearchParams();
  const requested=params.get('type'),filter=filters.includes(requested as any)?requested as (typeof filters)[number]:'all';
  const load=useCallback(()=>{setError('');setData(null);void api<ArchiveStatus>('/status').then(setData).catch(reason=>setError(reason instanceof Error?reason.message:String(reason)));},[]);
  useEffect(load,[load]);
  const entries=useMemo(()=>data?.entries.filter(entry=>filter==='all'||entry.type===filter)??[],[data,filter]);
  const selectFilter=(next:(typeof filters)[number])=>{const updated=new URLSearchParams(params);if(next==='all')updated.delete('type');else updated.set('type',next);setParams(updated,{replace:true});};
  if(error)return <ErrorState message={`Stato pubblico non disponibile: ${error}`} retry={load}/>;
  if(!data)return <Loading/>;
  const totalCoverage=data.dataset.coverage.complete+data.dataset.coverage.partial+data.dataset.coverage.unknown;
  const operational=data.status.level==='operational';
  return <>
    <PageTitle title="Stato e novità" subtitle="Versioni del dataset, nuove fonti, correzioni e incidenti raccontati con perimetro e collegamenti verificabili." eyebrow="Archivio trasparente" action={<a className="btn-secondary" href="/api/status/feed.xml" target="_blank" rel="noreferrer"><Rss aria-hidden="true" className="h-4 w-4"/>Feed RSS</a>}/>
    <section role="status" aria-live="polite" className={`card mb-5 border-l-4 p-5 ${operational?'border-l-neroverde-400':'border-l-red-400'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3">{operational?<CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-neroverde-300"/>:<AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-red-300"/>}<div><h2 className="text-xl font-black">{data.status.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">{data.status.message}</p></div></div><div className="shrink-0 text-xs text-zinc-400">Aggiornato<br/><time dateTime={data.status.lastUpdatedAt}>{formatDate(data.status.lastUpdatedAt)}</time></div></div>
    </section>
    <section aria-label="Riepilogo dataset" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Dataset corrente" value={data.dataset.version} hint={`Schema v${data.dataset.schemaVersion} · ${formatDate(data.dataset.generatedAt)}`}/>
      <StatCard label="Partite archiviate" value={data.dataset.counts.matches.toLocaleString('it-IT')} hint={`${data.dataset.counts.seasons} stagioni/competizioni · ${data.dataset.counts.players} giocatori`}/>
      <StatCard label="Copertura completa" value={`${data.dataset.coverage.complete}/${totalCoverage}`} hint={`${data.dataset.coverage.partial} parziali · ${data.dataset.coverage.unknown} da completare`}/>
      <StatCard label="Evidenze di fonte" value={data.dataset.counts.sourceReferences.toLocaleString('it-IT')} hint={`${data.dataset.counts.playerSeasons} righe statistiche stagionali`}/>
    </section>
    <section className="card mb-5 p-5"><div className="flex items-start gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neroverde-300"/><div><h2 className="font-bold">Identità verificabile della release</h2><p className="mt-1 text-sm text-zinc-400">Il checksum identifica esattamente il database pubblicato. Se cambia anche un solo byte, cambia questa impronta.</p><code className="mt-3 block overflow-x-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-300">{data.dataset.databaseSha256}</code></div></div></section>
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black">Cronologia pubblica</h2><p className="mt-1 text-sm text-zinc-400">Ogni voce dichiara cosa è cambiato, dove e come verificarlo.</p></div><nav aria-label="Filtra il changelog" className="flex gap-2 overflow-x-auto pb-1">{filters.map(value=>{const count=value==='all'?data.entries.length:value==='release'?data.summary.releases:value==='source'?data.summary.sources:value==='correction'?data.summary.corrections:data.summary.incidents;return <button type="button" aria-pressed={filter===value} className={`btn-secondary whitespace-nowrap !min-h-9 !px-3 !py-1.5 text-xs ${filter===value?'!border-neroverde-400/60 !bg-neroverde-400/10 !text-neroverde-200':''}`} key={value} onClick={()=>selectFilter(value)}>{filterLabel[value]} <span aria-hidden="true">{count}</span></button>})}</nav></div>
    {entries.length?<ol className="relative space-y-4 before:absolute before:bottom-5 before:left-[1.15rem] before:top-5 before:w-px before:bg-zinc-700">{entries.map(entry=>{const meta=entryMeta[entry.type],Icon=meta.icon;return <li id={entry.id} className="relative grid grid-cols-[2.3rem_1fr] gap-3" key={entry.id}><div className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border bg-zinc-950 ${meta.classes}`}><Icon aria-hidden="true" className="h-4 w-4"/></div><article className="card p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`badge ${meta.classes}`}>{meta.label}</span>{entry.releaseVersion&&<span className="badge">{entry.releaseVersion}</span>}{entry.type==='incident'&&<span className="badge">{entry.status}</span>}</div><h3 className="mt-3 text-lg font-black">{entry.title}</h3></div><time className="shrink-0 text-xs text-zinc-400" dateTime={entry.publishedAt}>{formatDate(entry.publishedAt)}</time></div><p className="mt-3 text-sm leading-6 text-zinc-300">{entry.summary}</p><div className="mt-4 flex flex-wrap gap-2" aria-label="Copertura interessata">{entry.coverage.map(scope=><span className="badge !font-medium text-zinc-300" key={scope}><Radio aria-hidden="true" className="h-3 w-3"/>{scope}</span>)}</div><div className="mt-4 flex flex-wrap gap-2">{entry.links.map(link=>link.href.startsWith('/')?<Link className="btn-secondary !min-h-9 !px-3 !py-1.5 text-xs" to={link.href} key={`${entry.id}-${link.href}`}><Link2 aria-hidden="true" className="h-3.5 w-3.5"/>{link.label}</Link>:<a className="btn-secondary !min-h-9 !px-3 !py-1.5 text-xs" href={link.href} target="_blank" rel="noreferrer" key={`${entry.id}-${link.href}`}><ExternalLink aria-hidden="true" className="h-3.5 w-3.5"/>{link.label}</a>)}</div></article></li>})}</ol>:<Empty title="Nessuna voce per questo filtro" text="Le categorie senza pubblicazioni restano a zero: non vengono creati aggiornamenti fittizi." action={<button className="btn-secondary" onClick={()=>selectFilter('all')}><History aria-hidden="true" className="h-4 w-4"/>Mostra tutta la cronologia</button>}/>}
  </>;
}
