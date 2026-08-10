import { db, normalizePlayerPosition, normalizeTeamName, nowIso, recordFixtureConflicts } from '../db/database.js';
import { footballDataProvider } from '../providers/footballDataProvider.js';
import { theSportsDbProvider } from '../providers/theSportsDbProvider.js';
import { fetchNews } from '../providers/rssProvider.js';
import { apiFootballStatus, syncApiFootballCurrent, syncApiFootballSquad } from './apiFootballSync.js';
import { kickoffStatus, syncKickoffCurrent } from './kickoffSync.js';
import { resolvePlayer } from './playerResolver.js';

function updateSync(provider:string,resource:string,requests:number,error?:string){
  const now=nowIso();
  db.prepare(`INSERT INTO sync_state(provider,resource,requests_used,last_request,last_successful_sync,last_error)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(provider,resource) DO UPDATE SET
      requests_used=sync_state.requests_used+excluded.requests_used,
      last_request=excluded.last_request,
      last_successful_sync=CASE WHEN excluded.last_error IS NULL THEN excluded.last_successful_sync ELSE sync_state.last_successful_sync END,
      last_error=excluded.last_error`).run(provider,resource,requests,now,error?null:now,error??null);
}

export async function syncNews(){
  const {items,errors}=await fetchNews();
  const stmt=db.prepare(`INSERT INTO news_articles(url,normalized_title,title,source,published_at,description,image_url,cached_at)
    VALUES(@url,@normalized_title,@title,@source,@published_at,@description,@image_url,@cached_at)
    ON CONFLICT(url) DO UPDATE SET title=excluded.title,source=excluded.source,published_at=excluded.published_at,description=excluded.description,image_url=COALESCE(excluded.image_url,news_articles.image_url),cached_at=excluded.cached_at`);
  const existingTitle=db.prepare(`SELECT url FROM news_articles WHERE normalized_title=? LIMIT 1`);
  const seenTitles=new Set<string>();
  let stored=0,skippedDuplicates=0;
  for(const item of items){
    if(!item.url) continue;
    const title=String(item.title??'Senza titolo');
    const normalizedTitle=title.toLowerCase().replace(/\W+/g,' ').trim();
    const existing=existingTitle.get(normalizedTitle) as {url:string}|undefined;
    if((seenTitles.has(normalizedTitle)||existing?.url!==undefined&&existing.url!==item.url)){skippedDuplicates++;continue;}
    stmt.run({url:item.url,normalized_title:normalizedTitle,title,source:item.source??null,published_at:item.publishedAt??null,description:item.description??null,image_url:item.imageUrl??null,cached_at:nowIso()});
    seenTitles.add(normalizedTitle);stored++;
  }
  updateSync('rss','news',items.length?1:0,errors.length?errors.join(' | '):undefined);
  return {stored,skippedDuplicates,errors};
}

export async function syncMatches(){
  const p=footballDataProvider;
  if(!p.isConfigured()||!p.syncCurrentMatches){ updateSync(p.name,'matches',0,'Provider non configurato'); return {stored:0,errors:['football-data.org non configurato']}; }
  const r=await p.syncCurrentMatches();
  if(r.ok === false){ updateSync(p.name,'matches',r.requests,r.error); return {stored:0,errors:[r.error]}; }
  const stmt=db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,source_provider,source_external_id,last_verified_at)
    VALUES(@external_key,@date,@season,@competition,@round,@home_team,@away_team,@home_score,@away_score,@source_provider,@source_external_id,@last_verified_at)
    ON CONFLICT(external_key) DO UPDATE SET home_score=COALESCE(excluded.home_score,matches.home_score),away_score=COALESCE(excluded.away_score,matches.away_score),round=COALESCE(excluded.round,matches.round),last_verified_at=excluded.last_verified_at`);
  let stored=0;
  for(const m of r.data){
    const home=normalizeTeamName(m.homeTeam?.name??''); const away=normalizeTeamName(m.awayTeam?.name??'');
    if(!/sassuolo/i.test(`${home} ${away}`)) continue;
    const season=m.season?.startDate?.slice(0,4) && m.season?.endDate?.slice(0,4) ? `${m.season.startDate.slice(0,4)}/${m.season.endDate.slice(2,4)}` : null;
    const incoming={date:m.utcDate,home_score:m.score?.fullTime?.home??null,away_score:m.score?.fullTime?.away??null};
    const existing=db.prepare(`SELECT * FROM matches WHERE substr(date,1,10)=substr(?,1,10) AND lower(home_team)=lower(?) AND lower(away_team)=lower(?) LIMIT 1`).get(m.utcDate,home,away) as any;
    if(existing && existing.external_key!==`football-data:${m.id}`){ recordFixtureConflicts(existing,incoming,p.name); if(existing.source_provider==='manual') continue; db.prepare(`UPDATE matches SET home_score=COALESCE(?,home_score),away_score=COALESCE(?,away_score),round=COALESCE(?,round),last_verified_at=? WHERE id=?`).run(incoming.home_score,incoming.away_score,m.matchday?String(m.matchday):null,nowIso(),existing.id); stored++; continue; }
    stmt.run({external_key:`football-data:${m.id}`,date:m.utcDate,season,competition:m.competition?.name??'Serie A',round:m.matchday?String(m.matchday):null,home_team:home,away_team:away,home_score:incoming.home_score,away_score:incoming.away_score,source_provider:p.name,source_external_id:String(m.id),last_verified_at:nowIso()}); stored++;
  }
  updateSync(p.name,'matches',r.requests);
  return {stored,errors:[]};
}

export async function syncSquad(){
  const errors:string[]=[]; let stored=0;
  if(apiFootballStatus().configured){
    const r=await syncApiFootballSquad();
    stored+=r.stored; errors.push(...r.errors);
    if(stored) return {stored,errors};
  }
  if(theSportsDbProvider.isConfigured() && theSportsDbProvider.syncCurrentSquad){
    const r=await theSportsDbProvider.syncCurrentSquad();
    if(r.ok === true){
      const stmt=db.prepare(`INSERT INTO players(name,nationality,birth_date,position,current_squad,source_provider,source_external_id,last_verified_at)
        VALUES(?,?,?,?,1,?,?,?) ON CONFLICT(name) DO UPDATE SET nationality=COALESCE(excluded.nationality,players.nationality),birth_date=COALESCE(excluded.birth_date,players.birth_date),position=COALESCE(excluded.position,players.position),current_squad=1,last_verified_at=excluded.last_verified_at`);
      db.prepare(`UPDATE players SET current_squad=0 WHERE COALESCE(source_provider,'') <> 'manual'`).run();
      for(const p of r.data){
        if(!p.strPlayer) continue;
        const resolution=resolvePlayer({name:p.strPlayer,sourceProvider:'thesportsdb',sourcePlayerId:p.idPlayer,context:`thesportsdb:${p.idPlayer??p.strPlayer}`,allowCreate:true});
        if(resolution.status==='conflict') continue;
        if(resolution.status==='resolved') db.prepare('UPDATE players SET nationality=COALESCE(?,nationality),birth_date=COALESCE(?,birth_date),position=COALESCE(?,position),current_squad=1,last_verified_at=? WHERE id=?').run(p.strNationality??null,p.dateBorn??null,normalizePlayerPosition(p.strPosition),nowIso(),resolution.playerId);
        else stmt.run(p.strPlayer,p.strNationality??null,p.dateBorn??null,normalizePlayerPosition(p.strPosition),'thesportsdb',String(p.idPlayer??''),nowIso());
        stored++;
      }
      updateSync('thesportsdb','squad',r.requests);
    } else { errors.push(r.error); updateSync('thesportsdb','squad',r.requests,r.error); }
  }
  if(!stored && !errors.length) errors.push('Nessun provider squadra configurato/disponibile');
  return {stored,errors};
}

function apiCurrentStale(hours=6){
  const row=db.prepare(`SELECT max(last_successful_sync) AS last FROM sync_state WHERE provider='api-football' AND resource IN ('players','standings','team-stats','squad')`).get() as {last:string|null};
  if(!row?.last)return true;
  return Date.now()-new Date(row.last).getTime()>hours*60*60*1000;
}

export async function smartUpdate(){
  const results:any={};
  results.matches=kickoffStatus().configured?await syncKickoffCurrent(false):await syncMatches();
  if(apiFootballStatus().configured){
    results.apiFootball=apiCurrentStale()?await syncApiFootballCurrent():{skipped:true,reason:'Cache API-Football aggiornata nelle ultime 6 ore. Usa Data Manager per forzare.'};
  }else results.squad=await syncSquad();
  results.news=await syncNews();
  return results;
}
