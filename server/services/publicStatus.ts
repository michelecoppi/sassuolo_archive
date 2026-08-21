import fs from 'node:fs';
import path from 'node:path';

export type PublicChangelogType='release'|'source'|'correction'|'incident';
export type PublicChangelogState='published'|'investigating'|'monitoring'|'resolved';
export type PublicChangelogLink={label:string;href:string};
export type PublicChangelogEntry={
  id:string;
  type:PublicChangelogType;
  status:PublicChangelogState;
  publishedAt:string;
  title:string;
  summary:string;
  coverage:string[];
  links:PublicChangelogLink[];
  releaseVersion:string|null;
};

export type PublicArchiveStatus={
  status:{level:'operational'|'incident';title:string;message:string;lastUpdatedAt:string};
  dataset:{
    version:string;
    generatedAt:string;
    schemaVersion:number;
    databaseSha256:string;
    counts:{seasons:number;matches:number;players:number;playerSeasons:number;sourceReferences:number};
    coverage:{scopeVersion:number;complete:number;partial:number;unknown:number};
  };
  summary:{releases:number;sources:number;corrections:number;incidents:number};
  entries:PublicChangelogEntry[];
};

const releasePath=path.resolve('data/releases/current.json');
const changelogPath=path.resolve('data/releases/changelog.json');
const entryTypes=new Set<PublicChangelogType>(['release','source','correction','incident']);
const entryStates=new Set<PublicChangelogState>(['published','investigating','monitoring','resolved']);

function object(value:unknown,label:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} non valido`);
  return value as Record<string,unknown>;
}

function text(value:unknown,label:string,min:number,max:number){
  const normalized=String(value??'').trim();
  if(normalized.length<min||normalized.length>max)throw new Error(`${label} non valido`);
  return normalized;
}

function integer(value:unknown,label:string){
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error(`${label} non valido`);
  return parsed;
}

function isoDate(value:unknown,label:string){
  const normalized=text(value,label,20,40),date=new Date(normalized);
  if(Number.isNaN(date.getTime())||date.toISOString()!==normalized)throw new Error(`${label} non valida`);
  return normalized;
}

export function isPublicChangelogHref(value:string){
  if(/[\u0000-\u001f\u007f\\]/.test(value))return false;
  if(value.startsWith('/')&&!value.startsWith('//'))return true;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}

function changelogEntry(value:unknown,index:number):PublicChangelogEntry{
  const row=object(value,`Changelog #${index+1}`);
  const id=text(row.id,'ID changelog',3,80);
  if(!/^[a-z0-9][a-z0-9-]+$/.test(id))throw new Error(`ID changelog non valido: ${id}`);
  const type=text(row.type,'Tipo changelog',3,20) as PublicChangelogType;
  if(!entryTypes.has(type))throw new Error(`Tipo changelog non supportato: ${type}`);
  const status=text(row.status??'published','Stato changelog',6,20) as PublicChangelogState;
  if(!entryStates.has(status))throw new Error(`Stato changelog non supportato: ${status}`);
  if(type!=='incident'&&status!=='published')throw new Error(`${id}: solo gli incidenti possono avere stato ${status}`);
  if(type==='incident'&&status==='published')throw new Error(`${id}: un incidente deve essere investigating, monitoring o resolved`);
  if(!Array.isArray(row.coverage)||row.coverage.length<1||row.coverage.length>12)throw new Error(`${id}: copertura obbligatoria`);
  const coverage=row.coverage.map((item,coverageIndex)=>text(item,`Copertura ${coverageIndex+1}`,2,120));
  if(!Array.isArray(row.links)||row.links.length<1||row.links.length>8)throw new Error(`${id}: collegamento verificabile obbligatorio`);
  const links=row.links.map((item,linkIndex)=>{const link=object(item,`Link ${linkIndex+1}`),href=text(link.href,'URL changelog',1,500);if(!isPublicChangelogHref(href))throw new Error(`${id}: URL changelog non consentito`);return {label:text(link.label,'Etichetta link',2,80),href};});
  const releaseVersion=row.releaseVersion==null?null:text(row.releaseVersion,'Versione release',8,30);
  if(type==='release'&&!releaseVersion)throw new Error(`${id}: versione release obbligatoria`);
  return {id,type,status,publishedAt:isoDate(row.publishedAt,'Data changelog'),title:text(row.title,'Titolo changelog',4,140),summary:text(row.summary,'Sintesi changelog',20,800),coverage,links,releaseVersion};
}

export function upsertPublicReleaseEntry(historyValue:unknown,entryValue:unknown){
  const history=object(historyValue,'Changelog pubblico');
  if(integer(history.version,'Versione changelog')!==1)throw new Error('Versione changelog pubblico non supportata');
  if(!Array.isArray(history.entries))throw new Error('Voci changelog non valide');
  const existing=history.entries.map(changelogEntry),entry=changelogEntry(entryValue,existing.length);
  if(entry.type!=='release'||!entry.releaseVersion)throw new Error('La voce da pubblicare deve essere una release versionata');
  const preserved=existing.filter(item=>item.id!==entry.id&&item.releaseVersion!==entry.releaseVersion);
  const next=[entry,...preserved],ids=new Set<string>();
  for(const item of next){if(ids.has(item.id))throw new Error(`ID changelog duplicato: ${item.id}`);ids.add(item.id);}
  return {version:1,entries:next};
}

function readJson(file:string,label:string){
  if(!fs.existsSync(file))throw new Error(`${label} assente`);
  try{return JSON.parse(fs.readFileSync(file,'utf8')) as unknown;}catch{throw new Error(`${label} non contiene JSON valido`);}
}

export function getPublicArchiveStatus(options:{releaseFile?:string;changelogFile?:string}={}):PublicArchiveStatus{
  const release=object(readJson(options.releaseFile??releasePath,'Manifest release dati'),'Manifest release dati');
  const history=object(readJson(options.changelogFile??changelogPath,'Changelog pubblico'),'Changelog pubblico');
  if(integer(history.version,'Versione changelog')!==1)throw new Error('Versione changelog pubblico non supportata');
  if(!Array.isArray(history.entries)||history.entries.length<1)throw new Error('Changelog pubblico vuoto');
  const entries=history.entries.map(changelogEntry).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
  const ids=new Set<string>();for(const entry of entries){if(ids.has(entry.id))throw new Error(`ID changelog duplicato: ${entry.id}`);ids.add(entry.id);}
  const version=text(release.version,'Versione dataset',8,30);
  const currentRelease=entries.filter(entry=>entry.type==='release'&&entry.releaseVersion===version);
  if(currentRelease.length!==1)throw new Error(`La release ${version} deve comparire una sola volta nel changelog pubblico`);
  const counts=object(release.counts,'Conteggi release'),coverage=object(release.coverage,'Copertura release');
  const dataset={
    version,
    generatedAt:isoDate(release.generatedAt,'Data release'),
    schemaVersion:integer(release.schemaVersion,'Versione schema'),
    databaseSha256:text(release.databaseSha256,'Checksum dataset',71,71),
    counts:{seasons:integer(counts.seasons,'Stagioni'),matches:integer(counts.matches,'Partite'),players:integer(counts.players,'Giocatori'),playerSeasons:integer(counts.playerSeasons,'PlayerSeason'),sourceReferences:integer(counts.sourceReferences,'Riferimenti fonte')},
    coverage:{scopeVersion:integer(coverage.scopeVersion,'Versione copertura'),complete:integer(coverage.complete,'Coperture complete'),partial:integer(coverage.partial,'Coperture parziali'),unknown:integer(coverage.unknown,'Coperture sconosciute')},
  };
  if(!/^sha256:[a-f0-9]{64}$/.test(dataset.databaseSha256))throw new Error('Checksum dataset non valido');
  const activeIncident=entries.find(entry=>entry.type==='incident'&&entry.status!=='resolved');
  const newest=entries[0]?.publishedAt??dataset.generatedAt;
  return {
    status:activeIncident
      ?{level:'incident',title:'Servizio con limitazioni',message:`${activeIncident.title}: ${activeIncident.summary}`,lastUpdatedAt:newest}
      :{level:'operational',title:'Archivio operativo',message:'Non risultano incidenti aperti. Dataset e funzioni pubbliche sono consultabili.',lastUpdatedAt:newest},
    dataset,
    summary:{
      releases:entries.filter(entry=>entry.type==='release').length,
      sources:entries.filter(entry=>entry.type==='source').length,
      corrections:entries.filter(entry=>entry.type==='correction').length,
      incidents:entries.filter(entry=>entry.type==='incident').length,
    },
    entries,
  };
}

function xml(value:unknown){return String(value??'').replace(/[<>&"']/g,character=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[character]??character));}

export function publicArchiveStatusRss(status:PublicArchiveStatus,publicAppUrl:string){
  let base:URL;try{base=new URL(publicAppUrl);}catch{throw new Error('PUBLIC_APP_URL non valido');}
  if(!['http:','https:'].includes(base.protocol))throw new Error('PUBLIC_APP_URL deve usare HTTP o HTTPS');
  const baseHref=base.href.replace(/\/$/,'');
  const items=status.entries.map(entry=>{
    const firstLink=entry.links[0]?.href??`/status?entry=${encodeURIComponent(entry.id)}`;
    const link=new URL(firstLink,`${baseHref}/`).href;
    const description=`${entry.summary} Copertura: ${entry.coverage.join(', ')}.`;
    return `<item><title>${xml(entry.title)}</title><link>${xml(link)}</link><guid isPermaLink="false">sassuolo-history:${xml(entry.id)}</guid><pubDate>${new Date(entry.publishedAt).toUTCString()}</pubDate><category>${xml(entry.type)}</category><description>${xml(description)}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Sassuolo History · Stato e novità</title><link>${xml(`${baseHref}/status`)}</link><description>Aggiornamenti verificabili del dataset, nuove fonti, correzioni e incidenti.</description><language>it-IT</language><lastBuildDate>${new Date(status.status.lastUpdatedAt).toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}
