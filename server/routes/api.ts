import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createBackupSnapshot, db, getSetting, normalizeSearchText, normalizeTeamName, nowIso, recordChange, recordImportRun, recordSourceReference, restoreBackupSnapshot, setSetting, verifyBackupFile } from '../db/database.js';
import { dashboardStats, hallOfFame, headToHead, records } from '../services/stats.js';
import { importAll, recomputeDerivedPlayerStats } from '../services/importer.js';
import { smartUpdate, syncMatches, syncNews, syncSquad } from '../services/sync.js';
import { apiFootballStatus, syncApiFootballCurrent, syncApiFootballSeason, syncApiFootballTransfers, testApiFootball } from '../services/apiFootballSync.js';
import { kickoffStatus, syncKickoffCurrent, syncKickoffMatchDetails, syncKickoffSeason, testKickoff } from '../services/kickoffSync.js';
import { bootstrapHistoricalLeagueData } from '../services/historicalBootstrap.js';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { applyControlledImport, importEntities, previewControlledImport, recordControlledImportProvenance, type ImportEntity } from '../services/controlledImport.js';
import { resolvePlayer, resolvePlayerIdentityConflict } from '../services/playerResolver.js';
import { currentSeason, getCurrentSeasonDashboard, saveCurrentMatch, validateCurrentMatch } from '../services/currentSeason.js';
import { getCoverageMatrix } from '../services/coverage.js';
import { getOperationalStatus } from '../services/operations.js';
import { HALL_OF_FAME_DEFINITIONS, RECORD_DEFINITIONS } from '../services/statDefinitions.js';
import { getClubHistory, getSeasonTechnicalContext, getTechnicalArchive } from '../services/clubArchive.js';

type CupMetadata={exit:string;topScorer:string|null;topScorerGoals:number};
const cupMetadataPath=path.resolve('data/cup-brackets/coppa-italia-sassuolo-metadata.json');
const cupMetadata:Record<string,CupMetadata>=fs.existsSync(cupMetadataPath)?JSON.parse(fs.readFileSync(cupMetadataPath,'utf8')):{};
const competitionProfilesDir=path.resolve('data/competition-profiles');
const competitionProfiles:any[]=fs.existsSync(competitionProfilesDir)?fs.readdirSync(competitionProfilesDir).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(competitionProfilesDir,file),'utf8'))):[];
const competitionProfileFor=(season:string,competition:string)=>competitionProfiles.find(profile=>profile.season===season&&profile.competition===competition)??null;

function parseCsv(text:string) {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  const parseLine=(line:string)=>{const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(value);value='';}else value+=c;}out.push(value);return out;};
  if(!lines.length)return {headers:[] as string[],rows:[] as Record<string,string>[]};
  const headers=parseLine(lines[0]).map(x=>x.trim());
  return {headers,rows:lines.slice(1).map(line=>Object.fromEntries(parseLine(line).map((x,i)=>[headers[i],x.trim()]))) };
}
function csvCell(value:unknown){const text=value==null?'':String(value);return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
function writeCsv(headers:string[],rows:Record<string,unknown>[]){return [headers.map(csvCell).join(','),...rows.map(row=>headers.map(header=>csvCell(row[header])).join(','))].join('\n')+'\n';}
function candidateDir(candidatePath:string){
  const root=path.resolve('data/reconciliation/candidates');
  const legacyRoot=path.resolve('data/research-candidates');
  const requested=candidatePath.startsWith('data/')?candidatePath:path.join('data/reconciliation/candidates',candidatePath);
  const dir=path.resolve(requested);
  if((dir!==root&&!dir.startsWith(`${root}${path.sep}`))&&(dir!==legacyRoot&&!dir.startsWith(`${legacyRoot}${path.sep}`)))throw new Error('Percorso candidato non consentito');
  return dir;
}

function dateKey(value:unknown){
  const raw=String(value??'').trim();
  let match=raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if(match)return `${match[1]}-${match[2]}-${match[3]}`;
  match=raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if(match)return `${match[3]}-${match[2]}-${match[1]}`;
  return null;
}

function coppaItaliaBracket(season:string, sassuoloMatches:any[]) {
  const sources=['coppa-italia-2020-2025.json','coppa-italia-2025-2026.json'].map(file=>path.resolve('data/cup-brackets',file));
  const fixtures=sources.flatMap(source=>fs.existsSync(source)?JSON.parse(fs.readFileSync(source,'utf8')).filter((x:any)=>x.season===season):[]);
  return [...fixtures,...sassuoloMatches].sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));
}

export const api = Router();
api.get('/search', (req,res,next)=>{const q=String(req.query.q??'').trim();if(!q)return res.json({players:[],matches:[],seasons:[],opponents:[]});const needle=normalizeSearchText(q);const players=(db.prepare('SELECT id,name,position FROM players ORDER BY name').all() as any[]).filter(p=>normalizeSearchText(p.name).includes(needle)).slice(0,8);const like=`%${q}%`;res.json({players,matches:db.prepare('SELECT id,date,home_team,away_team,home_score,away_score FROM matches WHERE home_team LIKE ? OR away_team LIKE ? ORDER BY date DESC LIMIT 8').all(like,like),seasons:db.prepare('SELECT id,season,competition FROM seasons WHERE season LIKE ? OR competition LIKE ? ORDER BY season DESC LIMIT 8').all(like,like),opponents:[]});});

async function trackedProviderRun(scope: { provider: string; area: string; season?: string; competition?: string }, task: () => Promise<any>) {
  const started = nowIso();
  try {
    const result = await task();
    const runId = recordImportRun({
      kind: 'provider_sync', sourceProvider: scope.provider, area: scope.area,
      season: scope.season ?? null, competition: scope.competition ?? null,
      status: Array.isArray(result?.errors) && result.errors.length ? 'partial' : 'succeeded',
      startedAt: started, finishedAt: nowIso(),
      recordsSeen: Number(result?.matches ?? result?.stored ?? result?.requests ?? 0),
      error: Array.isArray(result?.errors) && result.errors.length ? result.errors.join(' · ') : null,
      notes: `Sincronizzazione ${scope.provider} registrata dal Data Manager`,
    });
    return { ...result, importRunId: runId };
  } catch (error) {
    recordImportRun({ kind: 'provider_sync', sourceProvider: scope.provider, area: scope.area, season: scope.season ?? null, competition: scope.competition ?? null, status: 'failed', startedAt: started, finishedAt: nowIso(), error: String(error) });
    throw error;
  }
}


const lineupPlayerByApiId = db.prepare(`SELECT id FROM players WHERE api_football_id=?`);
function enrichLineupPlayerLinks(entries:any[]){
  if(!Array.isArray(entries))return [];
  return entries.map((entry:any)=>{
    const player=entry?.player??entry??{};
    const externalId=Number(player?.id??player?.playerId);
    let localPlayerId=Number(player?.localPlayerId??player?.local_player_id)||null;
    if(!localPlayerId&&Number.isFinite(externalId)&&externalId>0){
      localPlayerId=(lineupPlayerByApiId.get(externalId) as {id:number}|undefined)?.id??null;
    }
    return entry?.player?{...entry,player:{...player,localPlayerId}}:{...entry,localPlayerId};
  });
}

api.get('/health', (req,res)=>{
  const status=getOperationalStatus(db,req.app.locals.responseCache.snapshot(),req.app.locals.observability.snapshot());
  res.status(status.ok?200:503).json(status);
});
api.get('/dashboard', (req,res)=>res.json(dashboardStats(req.query as Record<string,string|undefined>)));
api.get('/charts/seasons', (req,res)=>{
  const q=req.query as Record<string,string|undefined>,where:string[]=[],params:any[]=[];
  if(q.competition){where.push('competition=?');params.push(q.competition);}if(q.from){where.push('season>=?');params.push(q.from);}if(q.to){where.push('season<=?');params.push(q.to);}
  res.json(db.prepare(`SELECT season,competition,final_position,wins,draws,losses,goals_for,goals_against,points FROM seasons ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY season,competition`).all(...params));
});
api.get('/seasons', (_req,res)=>{
  const rows=db.prepare(`
  SELECT s.*,
    (SELECT ps.player_id FROM player_seasons ps WHERE ps.season=s.season AND ps.competition=s.competition AND ps.goals IS NOT NULL ORDER BY ps.goals DESC,ps.minutes ASC LIMIT 1) AS top_scorer_player_id,
    (SELECT p.name FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=s.season AND ps.competition=s.competition AND ps.goals IS NOT NULL ORDER BY ps.goals DESC,ps.minutes ASC LIMIT 1) AS top_scorer_player_name,
    (SELECT ps.goals FROM player_seasons ps WHERE ps.season=s.season AND ps.competition=s.competition AND ps.goals IS NOT NULL ORDER BY ps.goals DESC,ps.minutes ASC LIMIT 1) AS top_scorer_goals
  FROM seasons s ORDER BY substr(s.season,1,4) DESC`).all() as any[];
  res.json(rows.map(row=>{
    const competitionProfile=competitionProfileFor(row.season,row.competition);
    if(!/^Coppa Italia$/i.test(row.competition))return {...row,competition_result:competitionProfile?.result??null};
    const meta=cupMetadata[row.season];
    return {...row,cup_exit:meta?.exit??null,competition_result:meta?.exit??null,top_scorer:row.top_scorer??meta?.topScorer??null,top_scorer_goals:row.top_scorer_goals??meta?.topScorerGoals??null};
  }));
});
api.get('/seasons/:season', (req,res)=>{
  const requestedCompetition=String(req.query.competition??'').trim();
  const storedCompetitions=db.prepare(`SELECT * FROM seasons WHERE season=? ORDER BY CASE competition WHEN 'Serie A' THEN 0 WHEN 'Serie B' THEN 1 ELSE 2 END,competition`).all(req.params.season) as any[];
  const coverageRows=getCoverageMatrix().rows.filter(row=>row.season===req.params.season);
  const storedNames=new Set(storedCompetitions.map(row=>row.competition));
  const declaredOnly=coverageRows.filter(row=>!storedNames.has(row.competition)).map((row,index)=>({id:-(index+1),season:row.season,competition:row.competition,final_position:null,matches:null,wins:null,draws:null,losses:null,goals_for:null,goals_against:null,points:null,manager:null,stadium:null,top_scorer:null,top_assists:null,home_record:null,away_record:null,source_provider:null,source_url:null,last_verified_at:null,declared_only:true}));
  const competitions=[...storedCompetitions,...declaredOnly];
  const season=requestedCompetition?competitions.find(x=>x.competition===requestedCompetition):storedCompetitions[0]??competitions.find(x=>coverageRows.find(row=>row.competition===x.competition)?.competition_kind==='league')??competitions[0];
  const competition=season?.competition;
  const coverage=coverageRows.find(row=>row.competition===competition)??null;
  const isCup=/^Coppa Italia$/i.test(competition??'');
  const isEuropa=/^Europa League$/i.test(competition??'');
  const competitionProfile=competition?competitionProfileFor(req.params.season,competition):null;
  const matches=competition?db.prepare(`SELECT m.*,
    CASE WHEN EXISTS (SELECT 1 FROM match_events e WHERE e.match_id=m.id)
           OR EXISTS (SELECT 1 FROM match_lineups l WHERE l.match_id=m.id)
           OR EXISTS (SELECT 1 FROM match_team_stats ts WHERE ts.match_id=m.id)
           OR EXISTS (SELECT 1 FROM match_player_stats ps WHERE ps.match_id=m.id)
         THEN 'DETAILED'
         WHEN m.completeness_level='DETAILED' THEN 'STANDARD'
         ELSE COALESCE(m.completeness_level,'BASIC') END AS completeness_level
    FROM matches m WHERE m.season=? AND (m.competition=? OR m.competition IS NULL) ORDER BY m.date`).all(req.params.season,competition):[];
  const squad=competition?db.prepare(isCup
    ? `SELECT p.*,ps.*,ps.competition AS stats_competition,p.id AS player_id,p.name AS player_name,p.photo_url AS player_photo FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition IN ('Serie A','Serie B') ORDER BY CASE ps.competition WHEN 'Serie A' THEN 0 ELSE 1 END,COALESCE(ps.appearances,0) DESC,p.name`
    : `SELECT p.*,ps.*,ps.competition AS stats_competition,p.id AS player_id,p.name AS player_name,p.photo_url AS player_photo FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition=? ORDER BY COALESCE(ps.appearances,0) DESC,p.name`
  ).all(req.params.season,...(isCup?[]:[competition])):[];
  const standings=competition?db.prepare(`SELECT * FROM season_standings WHERE season=? AND competition=? ORDER BY COALESCE(group_name,''),rank`).all(req.params.season,competition):[];
  const teamStats=competition?db.prepare(`SELECT * FROM team_season_stats WHERE season=? AND competition=?`).get(req.params.season,competition) as any:null;
  if(teamStats){teamStats.lineups=teamStats.lineups_json?JSON.parse(teamStats.lineups_json):[];delete teamStats.raw_json;}
  const transfers=db.prepare(`SELECT * FROM transfers WHERE season=? ORDER BY date DESC,id DESC`).all(req.params.season);
  const topScorerFromStats=competition?db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,ps.goals,ps.appearances,ps.minutes FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition=? AND ps.goals IS NOT NULL ORDER BY ps.goals DESC,COALESCE(ps.minutes,999999) ASC LIMIT 1`).get(req.params.season,competition):null;
  const cupMeta=cupMetadata[req.params.season];
  const cupScorerFallback=isCup&&cupMeta?{id:null,name:cupMeta.topScorer??'Nessun marcatore',photo_url:null,position:null,goals:cupMeta.topScorerGoals,appearances:null,minutes:null}:null;
  const topScorer=topScorerFromStats??cupScorerFallback;
  const topAssists=competition?db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,ps.assists,ps.appearances,ps.minutes FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition=? AND ps.assists IS NOT NULL ORDER BY ps.assists DESC,COALESCE(ps.minutes,999999) ASC LIMIT 1`).get(req.params.season,competition):null;
  const captain=competition?db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,ps.appearances,ps.minutes FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition=? AND ps.captain=1 ORDER BY COALESCE(ps.appearances,0) DESC,p.name LIMIT 1`).get(req.params.season,competition)??null:null;
  const squadCoverage=competition?db.prepare(isCup
    ? `SELECT COUNT(*) AS in_squad, SUM(CASE WHEN appearances IS NOT NULL AND appearances > 0 THEN 1 ELSE 0 END) AS played FROM player_seasons WHERE season=? AND competition IN ('Serie A','Serie B')`
    : `SELECT COUNT(*) AS in_squad, SUM(CASE WHEN appearances IS NOT NULL AND appearances > 0 THEN 1 ELSE 0 END) AS played FROM player_seasons WHERE season=? AND competition=?`
  ).get(req.params.season,...(isCup?[]:[competition])):{in_squad:0,played:0};
  const technicalContext=getSeasonTechnicalContext(req.params.season);
  const managerTerms=technicalContext.managerTerms.length?technicalContext.managerTerms:String(season?.manager??'').split('/').map((name:string)=>name.trim()).filter(Boolean).map((name:string)=>({name,from:null,to:null,precision:'season-only'}));
  const sourceBreakdown=competition?db.prepare(`SELECT provider,COUNT(*) AS records,MAX(verified_at) AS last_verified_at FROM (
      SELECT source_provider AS provider,last_verified_at AS verified_at FROM seasons WHERE season=? AND competition=? AND source_provider IS NOT NULL
      UNION ALL SELECT source_provider,last_verified_at FROM matches WHERE season=? AND competition=? AND source_provider IS NOT NULL
      UNION ALL SELECT source_provider,last_verified_at FROM player_seasons WHERE season=? AND competition=? AND source_provider IS NOT NULL
    ) GROUP BY provider ORDER BY records DESC,provider`).all(req.params.season,competition,req.params.season,competition,req.params.season,competition):[];
  const gaps:Array<{field:string;label:string;reason:string}>=[];
  const inProgress=req.params.season===getSetting('current_season');
  const addGap=(field:string,label:string,reason:string)=>gaps.push({field,label,reason});
  if(!managerTerms.length)addGap('manager','Allenatore','Nessun allenatore è collegato a questa competizione con una fonte verificabile.');
  else if(managerTerms.some((term:any)=>!term.from||!term.to))addGap('manager_terms','Intervalli allenatori','I nomi sono disponibili, ma le date di inizio e fine incarico non sono documentate: non vengono dedotte dalle sole presenze.');
  if(!season?.stadium)addGap('stadium','Stadio','Lo stadio non è disponibile nel riepilogo verificato della competizione.');
  if(!captain)addGap('captain','Capitano','Il dataset non identifica un capitano stagionale verificato.');
  if(!technicalContext.staff)addGap('technical_staff','Staff tecnico','Non è disponibile un elenco stagionale dello staff tecnico con fonte verificabile.');
  if(!squad.length)addGap('squad','Rosa','Nessuna appartenenza PlayerSeason è disponibile per questa competizione.');
  else if(Number((squadCoverage as any)?.played??0)<Number((squadCoverage as any)?.in_squad??0))addGap('squad_stats','Statistiche rosa',`${Number((squadCoverage as any).in_squad)-Number((squadCoverage as any).played??0)} giocatori risultano in rosa senza presenze attestate.`);
  if(!topScorer)addGap('top_scorer','Capocannoniere','Non esistono statistiche gol sufficienti per determinare il capocannoniere.');
  if(!isCup&&!isEuropa&&!standings.length)addGap('standings','Classifica','La classifica completa non è presente e non viene ricostruita dalle sole partite del Sassuolo.');
  if(!isCup&&!isEuropa&&season?.final_position==null)addGap('final_position','Piazzamento',inProgress?'Stagione in corso: il piazzamento finale non è ancora applicabile.':'Il piazzamento finale non è disponibile da una fonte verificata.');
  if(!isCup&&season?.points==null)addGap('points','Punti',inProgress?'Stagione in corso: il totale finale non è ancora applicabile.':'Il totale punti non è disponibile da una fonte verificata.');
  if(!sourceBreakdown.length)addGap('sources','Fonti','Non risultano riferimenti di provenienza per questa competizione.');
  const reliability=coverage?.status==='complete'
    ? {level:'high',label:'Alta',reason:'Calendario atteso, risultati, rosa con statistiche e provenienza puntuale soddisfano la regola di completezza.'}
    : coverage?.status==='partial'
      ? {level:'partial',label:'Parziale',reason:'Sono presenti dati verificabili, ma almeno un blocco richiesto è incompleto.'}
      : {level:'unknown',label:'Non valutabile',reason:'Il perimetro è dichiarato, ma i record disponibili non bastano per misurare la copertura.'};
  res.json({season:season??null,competitions,matches,bracket:isCup?coppaItaliaBracket(req.params.season,matches):[],competitionProfile,squad,squadCoverage,standings,teamStats,transfers,topScorer:topScorer??null,topAssists:topAssists??null,profile:{coverage,reliability,managerTerms,staff:technicalContext.staff,captain,gaps,sourceBreakdown}});
});
api.get('/matches', (req,res)=>{
  const q=req.query as Record<string,string|undefined>; const where:string[]=[]; const params:any[]=[];
  if(q.season){where.push('season=?');params.push(q.season);} if(q.opponent){where.push('(lower(home_team) LIKE lower(?) OR lower(away_team) LIKE lower(?))');params.push(`%${q.opponent}%`,`%${q.opponent}%`);} if(q.competition){where.push('competition=?');params.push(q.competition);} if(q.year){where.push('substr(date,1,4)=?');params.push(q.year);}
  const page=Math.max(1,Math.trunc(Number(q.page)||1)), pageSize=Math.min(100,Math.max(10,Math.trunc(Number(q.pageSize)||50)));
  const sqlWhere=where.length?'WHERE '+where.join(' AND '):'';
  const total=(db.prepare(`SELECT COUNT(*) AS total FROM matches ${sqlWhere}`).get(...params) as any).total;
  const rows=db.prepare(`SELECT m.*,
    CASE WHEN EXISTS (SELECT 1 FROM match_events e WHERE e.match_id=m.id)
           OR EXISTS (SELECT 1 FROM match_lineups l WHERE l.match_id=m.id)
           OR EXISTS (SELECT 1 FROM match_team_stats ts WHERE ts.match_id=m.id)
           OR EXISTS (SELECT 1 FROM match_player_stats ps WHERE ps.match_id=m.id)
         THEN 'DETAILED'
         WHEN m.completeness_level='DETAILED' THEN 'STANDARD'
         ELSE COALESCE(m.completeness_level,'BASIC') END AS completeness_level
    FROM matches m ${sqlWhere.replace(/\bseason\b/g,'m.season').replace(/\bcompetition\b/g,'m.competition').replace(/\bdate\b/g,'m.date').replace(/\bhome_team\b/g,'m.home_team').replace(/\baway_team\b/g,'m.away_team')} ORDER BY m.date DESC LIMIT ? OFFSET ?`).all(...params,pageSize,(page-1)*pageSize);
  res.json(q.page||q.pageSize?{rows,total,page,pageSize}:rows);
});
api.get('/matches/:id', (req,res)=>{
  const match=db.prepare(`SELECT * FROM matches WHERE id=?`).get(req.params.id) as any;
  if(!match)return res.status(404).json({error:'Partita non trovata'});
  const details=db.prepare(`SELECT * FROM match_details WHERE match_id=?`).get(req.params.id) as any;
  const events=db.prepare(`SELECT * FROM match_events WHERE match_id=? ORDER BY COALESCE(minute,0),COALESCE(extra_minute,0),id`).all(req.params.id) as any[];
  const lineups=(db.prepare(`SELECT * FROM match_lineups WHERE match_id=? ORDER BY id`).all(req.params.id) as any[]).map(x=>({
    ...x,
    colors:x.colors_json?JSON.parse(x.colors_json):null,
    startXI:enrichLineupPlayerLinks(x.start_xi_json?JSON.parse(x.start_xi_json):[]),
    substitutes:enrichLineupPlayerLinks(x.substitutes_json?JSON.parse(x.substitutes_json):[])
  }));
  const teamStats=(db.prepare(`SELECT * FROM match_team_stats WHERE match_id=? ORDER BY id`).all(req.params.id) as any[]).map(x=>({
    ...x,
    statistics:x.stats_json?JSON.parse(x.stats_json):[]
  }));
  const playerStats=db.prepare(`SELECT mps.*,p.id AS linked_player_id FROM match_player_stats mps LEFT JOIN players p ON p.id=mps.player_id WHERE mps.match_id=? ORDER BY COALESCE(mps.team_name,''),COALESCE(mps.rating,0) DESC,mps.minutes DESC,mps.player_name`).all(req.params.id);
  const injuries=db.prepare(`SELECT mi.*,p.id AS linked_player_id FROM match_injuries mi LEFT JOIN players p ON p.id=mi.player_id WHERE mi.match_id=? ORDER BY COALESCE(mi.team_name,''),mi.player_name`).all(req.params.id);
  const sources=db.prepare(`SELECT id,field,source_url,note,source_provider,verified_at FROM source_references WHERE entity_id=? AND entity_type IN ('match','matches') ORDER BY verified_at DESC,id DESC`).all(req.params.id);
  if(details?.raw_json)delete details.raw_json;
  const legacyTeamStats=['possession_home','possession_away','shots_home','shots_away','shots_on_target_home','shots_on_target_away','corners_home','corners_away','fouls_home','fouls_away','xg_home','xg_away'].some(field=>match[field]!=null);
  const modules={
    score:match.home_score!=null&&match.away_score!=null,
    events:events.length>0||Boolean(match.scorers),
    lineups:lineups.length>0,
    substitutions:events.some(event=>/sub/i.test(`${event.type??''} ${event.detail??''}`)),
    teamStats:teamStats.length>0||legacyTeamStats,
    playerStats:playerStats.length>0,
    injuries:injuries.length>0
  };
  const hasStandardData=Boolean(match.halftime_score||match.stadium||match.referee||match.attendance!=null||details?.extratime_home!=null||details?.penalty_home!=null);
  const hasDetailedData=modules.events||modules.lineups||modules.teamStats||modules.playerStats;
  match.completeness_level=hasDetailedData?'DETAILED':(hasStandardData?'STANDARD':'BASIC');
  const outcome={
    halftime:match.halftime_score??(details?.halftime_home!=null&&details?.halftime_away!=null?`${details.halftime_home}-${details.halftime_away}`:null),
    fulltime:details?.fulltime_home!=null&&details?.fulltime_away!=null?`${details.fulltime_home}-${details.fulltime_away}`:null,
    extraTime:details?.extratime_home!=null&&details?.extratime_away!=null?`${details.extratime_home}-${details.extratime_away}`:null,
    penalties:details?.penalty_home!=null&&details?.penalty_away!=null?`${details.penalty_home}-${details.penalty_away}`:null
  };
  res.json({match,details:details??null,outcome,modules,events,lineups,teamStats,playerStats,injuries,sources});
});

const canonicalPlayerStatFields=['appearances','starts','minutes','goals','own_goals','assists','yellow_cards','yellow_red_cards','red_cards','clean_sheets'] as const;
const canonicalPlayerStatProjection=canonicalPlayerStatFields.map(field=>`CASE WHEN COUNT(${field})>0 THEN SUM(${field}) END AS ${field}`).join(',\n      ');
const canonicalPlayerAggregateSql=`SELECT COUNT(DISTINCT season) AS seasons,${canonicalPlayerStatProjection} FROM player_seasons WHERE player_id=?`;
function canonicalPlayer(playerId:number){
  const player=db.prepare(`SELECT * FROM players WHERE id=?`).get(playerId) as any;
  if(!player)return null;
  return {...player,...db.prepare(canonicalPlayerAggregateSql).get(playerId)};
}

api.get('/players', (req,res)=>{
  const q=req.query as Record<string,string|undefined>; const where:string[]=[]; const params:any[]=[];
  if(q.position){where.push('players.position=?');params.push(q.position);} if(q.nationality){where.push('players.nationality=?');params.push(q.nationality);} if(q.current==='1'){where.push('players.current_squad=1');} if(q.all!=='1'&&q.current!=='1'){where.push('(players.current_squad=1 OR totals.player_id IS NOT NULL)');}
  if(q.season){where.push('EXISTS (SELECT 1 FROM player_seasons psy WHERE psy.player_id=players.id AND psy.season=?)');params.push(q.season);}
  const allowed=['appearances','goals','assists','minutes','name']; const sort=allowed.includes(q.sort??'')?q.sort!:'appearances';
  const direction=q.direction==='asc'?'ASC':'DESC';
  const sortExpression=sort==='name'?'players.name':`totals.${sort}`;
  const rows=db.prepare(`WITH totals AS (
    SELECT player_id,${canonicalPlayerStatProjection}
    FROM player_seasons GROUP BY player_id
  )
  SELECT players.*,
    totals.appearances AS aggregate_appearances,totals.starts AS aggregate_starts,
    totals.minutes AS aggregate_minutes,totals.goals AS aggregate_goals,
    totals.own_goals AS aggregate_own_goals,totals.assists AS aggregate_assists,
    totals.yellow_cards AS aggregate_yellow_cards,totals.red_cards AS aggregate_red_cards,
    totals.clean_sheets AS aggregate_clean_sheets
  FROM players LEFT JOIN totals ON totals.player_id=players.id
  ${where.length?'WHERE '+where.join(' AND '):''}
  ORDER BY ${sortExpression} ${direction} NULLS LAST, players.name`).all(...params) as any[];
  res.json(rows.map(row=>{
    const player={...row};
    for(const field of canonicalPlayerStatFields){
      player[field]=row[`aggregate_${field}`];
      delete player[`aggregate_${field}`];
    }
    return player;
  }));
});
api.get('/players/:id', (req,res)=>{
  const p=canonicalPlayer(Number(req.params.id));
  const seasons=db.prepare(`SELECT * FROM player_seasons WHERE player_id=? ORDER BY substr(season,1,4) DESC,competition`).all(req.params.id) as any[];
  const competitionTotals=db.prepare(`SELECT competition,COUNT(DISTINCT season) AS seasons,${canonicalPlayerStatProjection} FROM player_seasons WHERE player_id=? GROUP BY competition ORDER BY competition`).all(req.params.id);
  const cleanSheets=db.prepare(`SELECT m.season,m.competition,COUNT(*) AS clean_sheets
    FROM match_player_stats mps JOIN matches m ON m.id=mps.match_id
    WHERE mps.player_id=? AND COALESCE(mps.minutes,0)>0
      AND lower(COALESCE(mps.position,'')) IN ('g','gk','goalkeeper','goal keeper','keeper')
      AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
      AND ((lower(COALESCE(m.home_team,'')) LIKE '%sassuolo%' AND m.home_score=0)
        OR (lower(COALESCE(m.away_team,'')) LIKE '%sassuolo%' AND m.away_score=0))
    GROUP BY m.season,m.competition ORDER BY substr(m.season,1,4) DESC`).all(req.params.id) as any[];
  const derivedCleanSheets=cleanSheets.reduce((sum,row)=>sum+Number(row.clean_sheets||0),0);
  const transfers=db.prepare(`SELECT * FROM transfers WHERE player_id=? ORDER BY date DESC,id DESC`).all(req.params.id) as any[];
  const sourceIds=db.prepare(`SELECT id,source_provider,source_player_id,source_url,last_verified_at FROM player_source_ids WHERE player_id=? ORDER BY source_provider`).all(req.params.id) as any[];
  const references=db.prepare(`SELECT id,entity_type,entity_id,field,source_url,note,source_provider,verified_at FROM source_references
    WHERE (entity_type IN ('player','players') AND entity_id=?)
       OR (entity_type IN ('player_season','player_seasons','player-seasons') AND entity_id IN (SELECT id FROM player_seasons WHERE player_id=?))
       OR (entity_type IN ('transfer','transfers') AND entity_id IN (SELECT id FROM transfers WHERE player_id=?))
    ORDER BY verified_at DESC,id DESC`).all(req.params.id,req.params.id,req.params.id) as any[];
  const conflicts=(db.prepare(`SELECT id,raw_name,source_provider,source_player_id,context,reason,candidates_json FROM player_match_conflicts WHERE status='open'`).all() as any[]).filter(conflict=>{
    if(sourceIds.some(source=>source.source_provider===conflict.source_provider&&source.source_player_id===conflict.source_player_id))return true;
    if(p&&normalizeSearchText(conflict.raw_name)===normalizeSearchText(p.name))return true;
    try{return (JSON.parse(conflict.candidates_json||'[]') as any[]).some(candidate=>Number(candidate.id)===Number(req.params.id));}catch{return false;}
  }).map(({candidates_json,...conflict})=>conflict);
  const directSources=[
    ...(p?.source_url?[{entity_type:'player',entity_id:p.id,field:null,source_url:p.source_url,note:null,source_provider:p.source_provider,verified_at:p.last_verified_at}]:[]),
    ...seasons.filter(row=>row.source_url).map(row=>({entity_type:'player_season',entity_id:row.id,field:null,source_url:row.source_url,note:`${row.season} · ${row.competition}`,source_provider:row.source_provider,verified_at:row.last_verified_at})),
    ...transfers.filter(row=>row.source_url).map(row=>({entity_type:'transfer',entity_id:row.id,field:null,source_url:row.source_url,note:row.date,source_provider:row.source_provider,verified_at:row.last_verified_at}))
  ];
  const sources=[...directSources,...references].filter((source,index,all)=>all.findIndex(other=>other.source_url===source.source_url&&other.entity_type===source.entity_type&&other.entity_id===source.entity_id&&other.field===source.field)===index);
  res.json({player:p?{...p,derived_clean_sheets:cleanSheets.length?derivedCleanSheets:null}:null,seasons,competitionTotals,cleanSheets,transfers,identity:{status:conflicts.length?'review':(sourceIds.length?'verified':'unresolved'),sourceIds,conflicts},sources});
});
api.get('/squad/current', (_req,res)=>{
  const season=currentSeason();
  if(!season)return res.json({season:null,competitions:[],players:[]});
  const competitions=(db.prepare(`SELECT DISTINCT competition FROM player_seasons WHERE season=? AND competition IS NOT NULL ORDER BY competition`).all(season) as {competition:string}[]).map(row=>row.competition);
  const players=db.prepare(`SELECT p.*,ps.appearances AS season_appearances,ps.starts AS season_starts,ps.minutes AS season_minutes,ps.goals AS season_goals,ps.assists AS season_assists,ps.rating AS season_rating,ps.yellow_cards AS season_yellow_cards,ps.red_cards AS season_red_cards
    FROM players p LEFT JOIN (
      SELECT player_id,SUM(appearances) AS appearances,SUM(starts) AS starts,SUM(minutes) AS minutes,SUM(goals) AS goals,SUM(assists) AS assists,AVG(rating) AS rating,SUM(yellow_cards) AS yellow_cards,SUM(red_cards) AS red_cards
      FROM player_seasons WHERE season=? GROUP BY player_id
    ) ps ON ps.player_id=p.id
    WHERE p.current_squad=1
    ORDER BY CASE p.position WHEN 'Goalkeeper' THEN 1 WHEN 'Defender' THEN 2 WHEN 'Midfielder' THEN 3 WHEN 'Attacker' THEN 4 ELSE 5 END,p.shirt_number,p.name`).all(season);
  res.json({season,competitions,players});
});
api.get('/transfers', (req,res)=>{
  const season=String(req.query.season??'').trim();
  const type=String(req.query.type??'').trim();
  const session=String(req.query.session??'').trim().toUpperCase();const direction=String(req.query.direction??'').trim().toUpperCase();const movement=String(req.query.movement??'').trim().toUpperCase();
  const where:string[]=[]; const params:any[]=[]; if(season){where.push('season=?');params.push(season);} if(type){where.push('lower(type)=lower(?)');params.push(type);}if(session){where.push('session=?');params.push(session);}if(direction){where.push('direction=?');params.push(direction);}if(movement){where.push('movement_type=?');params.push(movement);}
  res.json(db.prepare(`SELECT transfers.*,CASE WHEN player_id IS NULL THEN 'unresolved' ELSE 'reconciled' END AS identity_status FROM transfers ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY date DESC,id DESC LIMIT 2000`).all(...params));
});
api.get('/club-history',(_req,res)=>res.json(getClubHistory()));
api.get('/coaches',(_req,res)=>res.json(getTechnicalArchive()));
api.post('/corrections',(req,res)=>{
  try{
    const x=req.body??{};const entityType=String(x.entityType??'').trim();const field=String(x.field??'').trim();const proposedValue=String(x.proposedValue??'').trim();const sourceUrl=String(x.sourceUrl??'').trim();const explanation=String(x.explanation??'').trim();
    if(!['season','match','player','transfer','coach','club'].includes(entityType))return res.status(400).json({error:'Entità non valida'});
    if(!field||!proposedValue||!explanation)return res.status(400).json({error:'Campo, valore proposto e spiegazione sono obbligatori'});
    if(!/^https?:\/\//i.test(sourceUrl))return res.status(400).json({error:'Inserire un URL fonte http/https consultabile'});
    if([field,proposedValue,explanation].some(value=>value.length>2000))return res.status(400).json({error:'La proposta supera la lunghezza consentita'});
    const result=db.prepare(`INSERT INTO correction_requests(entity_type,entity_id,field,current_value,proposed_value,source_url,explanation,reporter_name,reporter_contact,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'pending',?)`).run(entityType,nullish(x.entityId),field,nullish(x.currentValue),proposedValue,sourceUrl,explanation,nullish(x.reporterName),nullish(x.reporterContact),nowIso());
    res.status(201).json({ok:true,id:Number(result.lastInsertRowid),status:'pending'});
  }catch(e){res.status(500).json({error:String(e)});}
});
api.get('/corrections',(req,res)=>{
  const status=String(req.query.status??'').trim();
  res.json(db.prepare(`SELECT * FROM correction_requests ${status?'WHERE status=?':''} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 500`).all(...(status?[status]:[])));
});
api.patch('/corrections/:id',(req,res)=>{
  try{
    const id=asInt(req.params.id);const status=String(req.body?.status??'');const reviewer=String(req.body?.reviewer??'').trim();const note=String(req.body?.note??'').trim();
    if(id==null)return res.status(400).json({error:'ID non valido'});if(!['approved','rejected'].includes(status))return res.status(400).json({error:'Stato di revisione non valido'});if(!reviewer||!note)return res.status(400).json({error:'Revisore e motivazione sono obbligatori'});
    const before=db.prepare(`SELECT * FROM correction_requests WHERE id=?`).get(id) as any;if(!before)return res.status(404).json({error:'Segnalazione non trovata'});if(before.status!=='pending')return res.status(409).json({error:'La segnalazione è già stata revisionata'});
    const reviewedAt=nowIso();db.prepare(`UPDATE correction_requests SET status=?,reviewer=?,review_note=?,reviewed_at=? WHERE id=?`).run(status,reviewer,note,reviewedAt,id);
    const after=db.prepare(`SELECT * FROM correction_requests WHERE id=?`).get(id);
    recordChange({entityType:'correction_request',entityId:id,action:status==='approved'?'approve-correction':'reject-correction',before,after,sourceUrl:before.source_url,note,author:reviewer});
    res.json({ok:true,status});
  }catch(e){res.status(500).json({error:String(e)});}
});
api.get('/h2h/suggestions', (req,res)=>{
  const q=String(req.query.q??'').trim(); const like=`%${q}%`;
  res.json(db.prepare(`SELECT DISTINCT CASE WHEN lower(home_team) IN ('sassuolo','us sassuolo','u.s. sassuolo calcio','sassuolo calcio') THEN away_team ELSE home_team END AS name FROM matches WHERE (lower(home_team) IN ('sassuolo','us sassuolo','u.s. sassuolo calcio','sassuolo calcio') OR lower(away_team) IN ('sassuolo','us sassuolo','u.s. sassuolo calcio','sassuolo calcio')) AND (home_team LIKE ? OR away_team LIKE ?) ORDER BY name LIMIT 12`).all(like,like));
});
api.get('/h2h/:opponent', (req,res)=>res.json(headToHead(req.params.opponent)));
api.get('/hall-of-fame', (req,res)=>{
  const q=req.query as Record<string,string|undefined>;
  const asMinimum=(name:string)=>{const value=Number(q[name]);return Number.isFinite(value)&&value>=0?Math.trunc(value):undefined;};
  res.json(hallOfFame({competition:q.competition||undefined,season:q.season||undefined,position:q.position||undefined,minAppearances:asMinimum('minAppearances'),minGoals:asMinimum('minGoals'),minAssists:asMinimum('minAssists'),minMinutes:asMinimum('minMinutes'),minCleanSheets:asMinimum('minCleanSheets')}));
});
api.get('/records', (req,res)=>res.json(records(req.query as Record<string,string|undefined>)));
api.get('/news', (_req,res)=>res.json(db.prepare(`SELECT * FROM news_articles ORDER BY COALESCE(published_at,cached_at) DESC LIMIT 100`).all()));
api.get('/coverage', (_req,res)=>res.json(getCoverageMatrix()));
api.get('/data/provenance/:entity/:id', (req,res)=>{
  const tables:Record<string,string>={seasons:'seasons',matches:'matches',players:'players','player-seasons':'player_seasons',transfers:'transfers','match-events':'match_events'};
  const table=tables[req.params.entity];const id=asInt(req.params.id);
  if(!table||id==null)return res.status(400).json({error:'Entità o ID non valido'});
  const record=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) as any;
  if(!record)return res.status(404).json({error:'Record non trovato'});
  delete record.raw_json;
  const singular:Record<string,string>={seasons:'season',matches:'match',players:'player','player-seasons':'player_season',transfers:'transfer','match-events':'match_event'};
  const entityTypes=[req.params.entity,table,singular[req.params.entity]];
  const references=db.prepare(`SELECT sr.*,ir.kind AS import_kind,ir.status AS import_status,ir.started_at AS import_started_at
    FROM source_references sr LEFT JOIN import_runs ir ON ir.id=sr.import_run_id
    WHERE sr.entity_id=? AND sr.entity_type IN (?,?,?) ORDER BY sr.verified_at DESC,sr.id DESC`).all(id,...entityTypes);
  const changes=db.prepare(`SELECT id,action,source_url,note,author,backup_id,created_at FROM change_log WHERE entity_id=? AND entity_type IN (?,?,?) ORDER BY id DESC`).all(id,...entityTypes);
  res.json({entity:req.params.entity,id,record,references,changes});
});
api.get('/data-manager', (_req,res)=>{
  const count=(table:string)=>(db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as any).c;
  const coverage=getCoverageMatrix().rows;
  const conflicts=db.prepare(`SELECT c.*,e.match_id AS related_match_id,m.date AS related_match_date,m.home_team AS related_home_team,m.away_team AS related_away_team,m.home_score AS related_home_score,m.away_score AS related_away_score
    FROM data_conflicts c
    LEFT JOIN match_events e ON c.entity_type='match_event' AND e.id=CAST(c.entity_key AS INTEGER)
    LEFT JOIN matches m ON m.id=e.match_id
    ORDER BY c.status='open' DESC,c.created_at DESC LIMIT 50`).all();
  const playerConflicts=(db.prepare(`SELECT * FROM player_match_conflicts WHERE status='open' AND raw_name<>'__CONTROLLED_IMPORT_PREVIEW_ONLY__' AND context NOT LIKE 'test-fixture%' AND (context LIKE 'player-season:%' OR context LIKE 'api-football:%' OR context LIKE 'thesportsdb:%' OR context LIKE 'controlled-import:players:%') ORDER BY created_at DESC LIMIT 100`).all() as any[]).map(c=>({...c,candidates:JSON.parse(c.candidates_json||'[]')}));
  res.json({counts:{seasons:count('seasons'),matches:count('matches'),players:count('players'),playerSeasons:count('player_seasons'),standings:count('season_standings'),transfers:count('transfers'),news:count('news_articles'),corrections:count('correction_requests')},coverage,lastAuditAt:getSetting('data_last_audit_at'),sync:db.prepare(`SELECT * FROM sync_state ORDER BY provider,resource`).all(),conflicts,playerConflicts,corrections:db.prepare(`SELECT id,entity_type,entity_id,field,current_value,proposed_value,source_url,explanation,status,reviewer,review_note,reviewed_at,created_at FROM correction_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 100`).all(),recentChanges:db.prepare(`SELECT id,entity_type,entity_id,action,source_url,note,author,backup_id,created_at FROM change_log ORDER BY id DESC LIMIT 12`).all(),backups:db.prepare(`SELECT id,reason,file_path,sha256,size_bytes,verified_at,restored_at,created_at FROM backup_runs ORDER BY id DESC LIMIT 12`).all(),importRuns:db.prepare(`SELECT * FROM import_runs ORDER BY id DESC LIMIT 12`).all(),auditRuns:db.prepare(`SELECT id,audit_type,status,generated_at,report_path,report_sha256,issue_count,blocking_issue_count FROM audit_runs ORDER BY id DESC LIMIT 8`).all(),candidateRuns:db.prepare(`SELECT * FROM research_candidates ORDER BY CASE status WHEN 'in_review' THEN 0 WHEN 'validated' THEN 1 WHEN 'candidate' THEN 2 ELSE 3 END,last_seen_at DESC LIMIT 20`).all(),zeroKeyMode:!process.env.FOOTBALL_DATA_API_KEY&&!process.env.API_FOOTBALL_KEY&&!process.env.KICKOFF_API_KEY,apiFootball:apiFootballStatus(),kickoff:kickoffStatus()});
});

api.post('/data/backups/:id/verify',(req,res)=>{try{
  const backup=db.prepare(`SELECT id,file_path FROM backup_runs WHERE id=?`).get(req.params.id) as any;
  if(!backup)return res.status(404).json({error:'Backup non trovato'});
  const verification=verifyBackupFile(backup.file_path);
  db.prepare(`UPDATE backup_runs SET sha256=?,size_bytes=?,verified_at=? WHERE id=?`).run(verification.sha256,verification.sizeBytes,verification.verifiedAt,backup.id);
  res.json({ok:true,id:backup.id,...verification});
}catch(e){res.status(400).json({error:String(e)});}});
api.post('/data/backups/:id/restore',(req,res)=>{try{
  const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'Backup non valido'});
  const checksum=String(req.body?.checksum??'');const actor=String(req.body?.actor??'Data Manager').trim();
  if(!/^[a-f0-9]{64}$/i.test(checksum))return res.status(400).json({error:'Inserire il checksum SHA-256 completo per confermare'});
  res.json({ok:true,...restoreBackupSnapshot(id,checksum,actor)});
}catch(e){res.status(400).json({error:String(e)});}});

api.post('/player-identity-conflicts/:id/resolve', (req,res)=>{
  try {
    const x=req.body??{};
    const result=resolvePlayerIdentityConflict(asInt(req.params.id)!, { action:x.action, playerId:asInt(x.playerId) ?? undefined, name:x.name, firstname:x.firstname, lastname:x.lastname });
    res.json({ok:true,...result});
  } catch(e) { res.status(400).json({error:String(e)}); }
});

api.get('/player-identity-conflicts/:id/preview', (req,res)=>{
  try {
    const conflict=db.prepare(`SELECT id,raw_name,source_provider,source_player_id,context FROM player_match_conflicts WHERE id=? AND status='open'`).get(req.params.id) as any;
    if(!conflict)return res.status(404).json({error:'Conflitto non trovato'});
    const playerId=asInt(String(req.query.playerId??''));
    const stats=playerId==null?null:db.prepare(`SELECT COUNT(*) AS seasons,COALESCE(SUM(appearances),0) AS appearances,COALESCE(SUM(minutes),0) AS minutes,COALESCE(SUM(goals),0) AS goals,COALESCE(SUM(assists),0) AS assists FROM player_seasons WHERE player_id=?`).get(playerId);
    const matches=playerId==null?null:db.prepare(`SELECT COUNT(*) AS match_stats,COALESCE(SUM(minutes),0) AS match_minutes,COALESCE(SUM(goals),0) AS match_goals,COALESCE(SUM(assists),0) AS match_assists FROM match_player_stats WHERE player_id=?`).get(playerId);
    res.json({conflict, target:playerId==null?null:db.prepare('SELECT id,name FROM players WHERE id=?').get(playerId), stats, matches, incoming:{player_seasons:0,match_stats:0,note:'Il conflitto non è ancora associato a un player_id: nessuna statistica viene aggiunta automaticamente.'}});
  } catch(e) { res.status(400).json({error:String(e)}); }
});

api.get('/data/candidates/:id', (req,res)=>{
  try{
    const candidate=db.prepare(`SELECT * FROM research_candidates WHERE id=?`).get(Number(req.params.id)) as any;
    if(!candidate)return res.status(404).json({error:'Candidato non trovato'});
    const dir=candidateDir(candidate.candidate_path), manifestPath=path.join(dir,'manifest.json'), dataPath=path.join(dir,'data.csv');
    if(!fs.existsSync(manifestPath))return res.status(404).json({error:'manifest.json non trovato'});
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    const parsed=fs.existsSync(dataPath)?parseCsv(fs.readFileSync(dataPath,'utf8')):{headers:[],rows:[]};
    let preview:any=null;
    if(candidate.area==='player_seasons'&&fs.existsSync(dataPath)){
      preview=previewControlledImport('player-seasons','data.csv',fs.readFileSync(dataPath,'utf8'));
    }else if(candidate.area==='match_details'&&fs.existsSync(dataPath)){
      const allMatches=db.prepare(`SELECT id,date,home_team,away_team,source_provider FROM matches WHERE season=? AND competition=?`).all(candidate.season,candidate.competition) as any[];
      const issues:any[]=[];let updated=0,conflicts=0,skipped=0;
      for(let index=0;index<parsed.rows.length;index++){
        const row=parsed.rows[index],key=dateKey(row.match_date);
        const fixtures=key?allMatches.filter(match=>dateKey(match.date)===key&&normalizeTeamName(match.home_team)===normalizeTeamName(row.home_team)&&normalizeTeamName(match.away_team)===normalizeTeamName(row.away_team)):[];
        if(!key)issues.push({row:index+2,field:'match_date',code:'invalid_date',message:'Data non valida',critical:true});
        else if(fixtures.length!==1){issues.push({row:index+2,field:null,code:'fixture_not_found',message:`Fixture riconciliate: ${fixtures.length}`,critical:true});skipped++;}
        else if(fixtures[0].source_provider==='manual'){issues.push({row:index+2,field:null,code:'manual_conflict',message:'Partita protetta da modifica manuale',critical:true});conflicts++;}
        else updated++;
        if(!row.source_url)issues.push({row:index+2,field:'source_url',code:'missing_source',message:'URL fonte mancante',critical:true});
      }
      const dataChecksum=crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex');
      if(String(manifest.sha256??'').toLowerCase()!==dataChecksum.toLowerCase())issues.push({row:0,field:null,code:'checksum_mismatch',message:'Il checksum del manifest non corrisponde al file dati',critical:true});
      preview={entity:'match-details',filename:'data.csv',checksum:dataChecksum,format:'csv',rows:parsed.rows.length,created:0,updated,skipped,conflicts,errors:issues.filter(x=>x.critical).length,canApply:issues.every(x=>!x.critical),issues};
    }
    const workflowIssues:any[]=[];
    if(manifest.validation?.status!=='reconciled')workflowIssues.push({row:0,field:null,code:'candidate_not_reconciled',message:`Validazione manifest: ${manifest.validation?.status??'N/D'}`,critical:true});
    if(preview&&manifest.sha256&&String(manifest.sha256).toLowerCase()!==String(preview.checksum).toLowerCase())workflowIssues.push({row:0,field:null,code:'checksum_mismatch',message:'Il checksum del manifest non corrisponde al file dati',critical:true});
    if(preview&&workflowIssues.length)preview={...preview,issues:[...workflowIssues,...preview.issues],errors:preview.errors+workflowIssues.length,canApply:false};
    res.json({candidate,manifest,headers:parsed.headers,rows:parsed.rows,preview});
  }catch(e){res.status(400).json({error:String(e)});}
});

api.put('/data/candidates/:id/rows/:rowIndex', (req,res)=>{
  try{
    const candidate=db.prepare(`SELECT * FROM research_candidates WHERE id=?`).get(Number(req.params.id)) as any;
    if(!candidate)return res.status(404).json({error:'Candidato non trovato'});
    const dir=candidateDir(candidate.candidate_path), dataPath=path.join(dir,'data.csv');
    const parsed=parseCsv(fs.readFileSync(dataPath,'utf8')), index=Number(req.params.rowIndex), changes=req.body?.changes??{};
    if(!Number.isInteger(index)||index<0||index>=parsed.rows.length)return res.status(400).json({error:'Riga candidato non valida'});
    const before={...parsed.rows[index]};
    const allowed=new Set(['player_name','position','appearances','starts','minutes','goals','assists','yellow_cards','red_cards','captain','match_date','home_team','away_team','stadium','referee','source_url','last_verified_at']);
    for(const [field,value] of Object.entries(changes)){
      if(!allowed.has(field))continue;
      if(['match_date','home_team','away_team','stadium','referee','player_name'].includes(field)&&String(value??'').trim()==='')return res.status(400).json({error:`Il campo ${field} non può essere vuoto`});
      if(['appearances','starts','minutes','goals','assists','yellow_cards','red_cards','captain'].includes(field)&&value!==null&&value!==''&&(!Number.isInteger(Number(value))||Number(value)<0||field==='captain'&&Number(value)>1))return res.status(400).json({error:`Valore non valido per ${field}`});
      parsed.rows[index][field]=value==null?'':String(value);
    }
    const row=parsed.rows[index];
    if(row.appearances&&row.starts&&Number(row.starts)>Number(row.appearances))return res.status(400).json({error:'Gli starts non possono superare le presenze'});
    fs.writeFileSync(dataPath,writeCsv(parsed.headers,parsed.rows),'utf8');
    const dataSha=crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex');
    const manifestPath=path.join(dir,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    manifest.sha256=dataSha;manifest.validation={...(manifest.validation??{}),status:'edited_review_required'};manifest.notes=[...(Array.isArray(manifest.notes)?manifest.notes:[]),'Riga modificata dal Data Manager: richiede nuova revisione.'];
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
    db.prepare(`UPDATE research_candidates SET status='in_review',manifest_sha256=?,validation_status='edited_review_required',last_seen_at=?,notes=? WHERE id=?`).run(crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex'),nowIso(),'Modificato dal Data Manager; richiede nuova approvazione.',candidate.id);
    recordChange({entityType:'research_candidate',entityId:candidate.id,action:'update',before:{rowIndex:index,row:before},after:{rowIndex:index,row:parsed.rows[index]},note:`Modifica riga candidato ${candidate.candidate_path}`});
    res.json({ok:true,rowIndex:index,row:parsed.rows[index],status:'in_review'});
  }catch(e){res.status(400).json({error:String(e)});}
});

api.post('/data/candidates/:id/status', (req,res)=>{
  try{
    const candidate=db.prepare(`SELECT * FROM research_candidates WHERE id=?`).get(Number(req.params.id)) as any;
    if(!candidate)return res.status(404).json({error:'Candidato non trovato'});
    const status=String(req.body?.status??'');
    if(!['in_review','approved','rejected'].includes(status))return res.status(400).json({error:'Stato candidato non valido'});
    if(status==='approved'&&candidate.validation_status==='conflict_review_required')return res.status(400).json({error:'Il candidato contiene conflitti: risolvili prima di approvare'});
    let manifestSha=candidate.manifest_sha256;
    if(status==='approved'){
      // L'approvazione esplicita dell'utente chiude anche la revisione richiesta
      // da una modifica manuale. I conflitti restano invece bloccanti.
      const dir=candidateDir(candidate.candidate_path),manifestPath=path.join(dir,'manifest.json');
      const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
      manifest.validation={...(manifest.validation??{}),status:'reconciled'};
      manifest.notes=[...(Array.isArray(manifest.notes)?manifest.notes:[]),'Approvato dal Data Manager dopo revisione manuale.'];
      fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
      manifestSha=crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
    }
    db.prepare(`UPDATE research_candidates SET status=?,validation_status=CASE WHEN ?='approved' THEN 'reconciled' ELSE validation_status END,manifest_sha256=?,last_seen_at=?,notes=? WHERE id=?`).run(status,status,manifestSha,nowIso(),req.body?.note??null,candidate.id);
    recordChange({entityType:'research_candidate',entityId:candidate.id,action:'update',after:{status,note:req.body?.note??null},note:`Candidato ${candidate.candidate_path}: stato ${status}`});
    res.json({ok:true,status});
  }catch(e){res.status(400).json({error:String(e)});}
});

api.post('/data/candidates/:id/import', (req,res)=>{
  const started=nowIso();
  try{
    const candidate=db.prepare(`SELECT * FROM research_candidates WHERE id=?`).get(Number(req.params.id)) as any;
    if(!candidate)return res.status(404).json({error:'Candidato non trovato'});
    if(candidate.status!=='approved')return res.status(400).json({error:'Il candidato deve essere approvato prima dell’import'});
    if(candidate.area==='match_details'){
      const dir=candidateDir(candidate.candidate_path),parsed=parseCsv(fs.readFileSync(path.join(dir,'data.csv'),'utf8'));
      const backup=createBackupSnapshot(`before-candidate-${candidate.id}-import`); let updated=0, unmatched=0;
      // Per i candidati match-details la data civile è la chiave di
      // riconciliazione: i provider possono chiamare le squadre in modi
      // diversi, mentre nel nostro archivio c'è una sola partita per giorno.
      const allMatches=db.prepare(`SELECT id,date FROM matches`).all() as {id:number;date:string}[];
      const updateMatch=db.prepare(`UPDATE matches SET stadium=COALESCE(?,stadium),referee=COALESCE(?,referee),source_provider=COALESCE(source_provider,?),source_url=COALESCE(?,source_url),last_verified_at=? WHERE id=?`);
      const unresolved:string[]=[],beforeMatches:any[]=[],afterMatches:any[]=[];
      db.transaction(()=>{for(const row of parsed.rows){const key=dateKey(row.match_date);const candidates=key?allMatches.filter(fixture=>dateKey(fixture.date)===key):[];if(candidates.length!==1){unmatched++;unresolved.push(`${row.match_date} (${candidates.length} partite trovate)`);continue;}const match=candidates[0];const before=db.prepare(`SELECT id,stadium,referee,source_provider,source_url,last_verified_at FROM matches WHERE id=?`).get(match.id);beforeMatches.push(before);updateMatch.run(row.stadium||null,row.referee||null,row.source_provider||candidate.source_provider||'candidate',row.source_url||null,row.last_verified_at||nowIso(),match.id);const after=db.prepare(`SELECT id,stadium,referee,source_provider,source_url,last_verified_at FROM matches WHERE id=?`).get(match.id);afterMatches.push(after);if(row.stadium)recordSourceReference({entityType:'matches',entityId:match.id,field:'stadium',sourceUrl:row.source_url,note:'UEFA matchinfo',verifiedAt:row.last_verified_at});if(row.referee)recordSourceReference({entityType:'matches',entityId:match.id,field:'referee',sourceUrl:row.source_url,note:'UEFA matchinfo',verifiedAt:row.last_verified_at});updated++;}})();
      if(unmatched)throw new Error(`Date non riconciliate: ${unresolved.join(', ')}`);
      const runId=recordImportRun({kind:'candidate_import',sourceProvider:candidate.source_provider,area:candidate.area,season:candidate.season,competition:candidate.competition,candidatePath:candidate.candidate_path,manifestSha256:candidate.manifest_sha256,status:'succeeded',startedAt:started,finishedAt:nowIso(),recordsSeen:parsed.rows.length,recordsUpdated:updated,backupId:backup.id,notes:'Arricchimento match details da candidato approvato'});
      db.prepare(`UPDATE research_candidates SET status='imported',imported_at=?,last_seen_at=? WHERE id=?`).run(nowIso(),nowIso(),candidate.id);recordChange({entityType:'research_candidate',entityId:candidate.id,action:'update',before:{status:candidate.status,matches:beforeMatches},after:{status:'imported',importRunId:runId,matches:afterMatches,updated},backupId:backup.id,note:'Import match details candidato approvato'});return res.json({ok:true,importRunId:runId,backupId:backup.id,updated});
    }
    if(candidate.area==='season_standings'){
      const dir=candidateDir(candidate.candidate_path),parsed=parseCsv(fs.readFileSync(path.join(dir,'data.csv'),'utf8'));
      const required=['season','competition','team_name','rank','points','played','wins','draws','losses','goals_for','goals_against','goals_diff'];
      const missing=required.filter(field=>!parsed.headers.includes(field));
      if(missing.length)return res.status(400).json({error:`Colonne classifica mancanti: ${missing.join(', ')}`});
      if(!parsed.rows.length)return res.status(400).json({error:'Il candidato classifica non contiene righe'});
      const scopes=[...new Set(parsed.rows.map(row=>`${row.season}\u0000${row.competition}`))].map(key=>key.split('\u0000'));
      if(scopes.length!==1)return res.status(400).json({error:'Un candidato classifica deve contenere una sola stagione e competizione'});
      const [season,competition]=scopes[0];
      if(!season||!competition)return res.status(400).json({error:'Stagione o competizione mancante nel candidato classifica'});
      const asInt=(row:Record<string,string>,field:string)=>{const value=Number(row[field]);if(!Number.isInteger(value))throw new Error(`${row.team_name}: ${field} non è un intero`);return value;};
      const ranks=new Set<number>(),teams=new Set<string>();
      for(const row of parsed.rows){
        if(!row.team_name)throw new Error('Nome squadra mancante');
        const teamKey=normalizeTeamName(row.team_name);
        if(teams.has(teamKey))throw new Error(`Squadra duplicata: ${row.team_name}`);teams.add(teamKey);
        const rank=asInt(row,'rank');if(ranks.has(rank))throw new Error(`Posizione duplicata: ${rank}`);ranks.add(rank);
        const played=asInt(row,'played'),wins=asInt(row,'wins'),draws=asInt(row,'draws'),losses=asInt(row,'losses');
        const gf=asInt(row,'goals_for'),ga=asInt(row,'goals_against'),gd=asInt(row,'goals_diff');
        asInt(row,'points');
        if(wins+draws+losses!==played)throw new Error(`${row.team_name}: vittorie + pareggi + sconfitte non coincide con le partite`);
        if(gf-ga!==gd)throw new Error(`${row.team_name}: differenza reti non coerente`);
      }
      if(Math.min(...ranks)!==1||Math.max(...ranks)!==parsed.rows.length||ranks.size!==parsed.rows.length)throw new Error('Le posizioni non formano una sequenza completa da 1 al numero di squadre');
      const sum=(field:string)=>parsed.rows.reduce((total,row)=>total+Number(row[field]),0);
      if(sum('wins')!==sum('losses'))throw new Error('Totale vittorie e sconfitte non bilanciato');
      if(sum('goals_for')!==sum('goals_against'))throw new Error('Totale gol fatti e subiti non bilanciato');
      if(sum('draws')%2!==0)throw new Error('Totale pareggi non valido');
      const backup=createBackupSnapshot(`before-candidate-${candidate.id}-import`);
      const before=db.prepare(`SELECT * FROM season_standings WHERE season=? AND competition=? ORDER BY id`).all(season,competition) as any[];
      const insert=db.prepare(`INSERT INTO season_standings(season,competition,api_football_team_id,team_name,rank,points,goals_diff,status,description,played,wins,draws,losses,goals_for,goals_against,source_provider,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      db.transaction(()=>{
        db.prepare(`DELETE FROM season_standings WHERE season=? AND competition=?`).run(season,competition);
        for(const row of parsed.rows){
          // Historical tables do not have API-Football identifiers. A stable,
          // negative local key keeps them distinct from real provider IDs.
          const digest=crypto.createHash('sha256').update(`${season}|${competition}|${normalizeTeamName(row.team_name)}`).digest();
          const localTeamId=-(digest.readUInt32BE(0)%2147483646+1);
          insert.run(season,competition,localTeamId,row.team_name,Number(row.rank),Number(row.points),Number(row.goals_diff),row.status||null,row.description||null,Number(row.played),Number(row.wins),Number(row.draws),Number(row.losses),Number(row.goals_for),Number(row.goals_against),row.source_provider||candidate.source_provider||'candidate',row.last_verified_at||nowIso());
        }
      })();
      const after=db.prepare(`SELECT * FROM season_standings WHERE season=? AND competition=? ORDER BY id`).all(season,competition) as any[];
      const runId=recordImportRun({kind:'candidate_import',sourceProvider:candidate.source_provider,area:candidate.area,season,competition,candidatePath:candidate.candidate_path,manifestSha256:candidate.manifest_sha256,status:'succeeded',startedAt:started,finishedAt:nowIso(),recordsSeen:parsed.rows.length,recordsCreated:Math.max(0,after.length-before.length),recordsUpdated:Math.min(before.length,after.length),backupId:backup.id,notes:'Import classifica storica da candidato approvato'});
      db.prepare(`UPDATE research_candidates SET status='imported',imported_at=?,last_seen_at=? WHERE id=?`).run(nowIso(),nowIso(),candidate.id);
      recordChange({entityType:'research_candidate',entityId:candidate.id,action:'update',before:{status:candidate.status,standings:before,season,competition},after:{status:'imported',importRunId:runId,standings:after,season,competition},backupId:backup.id,note:'Import season standings candidato approvato'});
      return res.json({ok:true,importRunId:runId,backupId:backup.id,created:Math.max(0,after.length-before.length),updated:Math.min(before.length,after.length)});
    }
    if(candidate.area!=='player_seasons')return res.status(400).json({error:'Import candidato non ancora disponibile per questa area'});
    const dir=candidateDir(candidate.candidate_path),parsed=parseCsv(fs.readFileSync(path.join(dir,'data.csv'),'utf8'));
    const backup=createBackupSnapshot(`before-candidate-${candidate.id}-import`);
    let created=0,updated=0;
    const savePlayer=db.prepare(`INSERT INTO players(name,position,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET position=COALESCE(excluded.position,players.position),source_url=COALESCE(players.source_url,excluded.source_url),last_verified_at=excluded.last_verified_at`);
    const findPlayer=db.prepare(`SELECT id FROM players WHERE lower(trim(name))=lower(trim(?)) LIMIT 1`);
    const saveSeason=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,yellow_red_cards,red_cards,captain,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=COALESCE(excluded.appearances,player_seasons.appearances),starts=COALESCE(excluded.starts,player_seasons.starts),minutes=COALESCE(excluded.minutes,player_seasons.minutes),goals=COALESCE(excluded.goals,player_seasons.goals),assists=COALESCE(excluded.assists,player_seasons.assists),yellow_cards=COALESCE(excluded.yellow_cards,player_seasons.yellow_cards),yellow_red_cards=COALESCE(excluded.yellow_red_cards,player_seasons.yellow_red_cards),red_cards=COALESCE(excluded.red_cards,player_seasons.red_cards),captain=COALESCE(excluded.captain,player_seasons.captain),source_provider=COALESCE(player_seasons.source_provider,excluded.source_provider),source_url=COALESCE(player_seasons.source_url,excluded.source_url),last_verified_at=excluded.last_verified_at`);
    db.transaction(()=>{for(const row of parsed.rows){
      if(!row.player_name||!row.season||!row.competition)continue;
      savePlayer.run(row.player_name,row.position||null,row.source_provider||candidate.source_provider||'candidate',row.source_url||candidate.source_url||null,row.last_verified_at||nowIso());
      let player=findPlayer.get(row.player_name) as {id:number}|undefined;
      if(!player)throw new Error(`Impossibile collegare ${row.player_name}`);
      const before=db.prepare(`SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(player.id,row.season,row.competition) as {id:number}|undefined;
      saveSeason.run(player.id,row.season,row.competition,...(['appearances','starts','minutes','goals','assists','yellow_cards','yellow_red_cards','red_cards','captain'].map(field=>row[field]===''||row[field]===undefined?null:Number(row[field]))),row.source_provider||candidate.source_provider||'candidate',row.source_url||candidate.source_url||null,row.last_verified_at||nowIso());
      const savedSeason=db.prepare(`SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(player.id,row.season,row.competition) as {id:number};
      if(row.captain!==''&&row.captain!==undefined)recordSourceReference({entityType:'player_seasons',entityId:savedSeason.id,field:'captain',sourceUrl:row.source_url||candidate.source_url||undefined,sourceProvider:row.source_provider||candidate.source_provider||'candidate',originalValue:row.captain,transformation:'candidate-import:season-context',verifiedAt:row.last_verified_at||nowIso()});
      if(before)updated++;else created++;
    }} )();
    const runId=recordImportRun({kind:'candidate_import',sourceProvider:candidate.source_provider,area:candidate.area,season:candidate.season,competition:candidate.competition,candidatePath:candidate.candidate_path,manifestSha256:candidate.manifest_sha256,status:'succeeded',startedAt:started,finishedAt:nowIso(),recordsSeen:parsed.rows.length,recordsCreated:created,recordsUpdated:updated,backupId:backup.id,notes:'Import candidato approvato dal Data Manager'});
    db.prepare(`UPDATE research_candidates SET status='imported',imported_at=?,last_seen_at=? WHERE id=?`).run(nowIso(),nowIso(),candidate.id);
    recordChange({entityType:'research_candidate',entityId:candidate.id,action:'update',after:{status:'imported',importRunId:runId,created,updated},backupId:backup.id,note:'Import candidato approvato'});
    res.json({ok:true,importRunId:runId,backupId:backup.id,created,updated});
  }catch(e){recordImportRun({kind:'candidate_import',status:'failed',startedAt:started,finishedAt:nowIso(),error:String(e),notes:'Import candidato fallito'});res.status(400).json({error:String(e)});}
});

api.post('/data/candidates/:id/rollback', (req,res)=>{
  try{
    const candidate=db.prepare(`SELECT * FROM research_candidates WHERE id=?`).get(Number(req.params.id)) as any;
    if(!candidate)return res.status(404).json({error:'Candidato non trovato'});
    if(candidate.status!=='imported')return res.status(400).json({error:'Il rollback è disponibile solo per candidati completati'});
    const standingsChange=db.prepare(`SELECT * FROM change_log WHERE entity_type='research_candidate' AND entity_id=? AND action='update' AND note='Import season standings candidato approvato' ORDER BY id DESC LIMIT 1`).get(candidate.id) as any;
    if(standingsChange){
      const before=standingsChange.before_json?JSON.parse(standingsChange.before_json):null;
      if(!Array.isArray(before?.standings)||!before.season||!before.competition)return res.status(400).json({error:'Snapshot classifica non disponibile per questo import'});
      const backup=createBackupSnapshot(`before-candidate-${candidate.id}-rollback`);
      const columns=['season','competition','api_football_league_id','api_football_team_id','team_name','team_logo','rank','points','goals_diff','form','status','description','group_name','played','wins','draws','losses','goals_for','goals_against','home_played','home_wins','home_draws','home_losses','home_goals_for','home_goals_against','away_played','away_wins','away_draws','away_losses','away_goals_for','away_goals_against','source_provider','last_verified_at'];
      const restore=db.prepare(`INSERT INTO season_standings(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
      db.transaction(()=>{db.prepare(`DELETE FROM season_standings WHERE season=? AND competition=?`).run(before.season,before.competition);for(const row of before.standings)restore.run(...columns.map(column=>row[column]??null));})();
      const runId=recordImportRun({kind:'candidate_import',sourceProvider:candidate.source_provider,area:candidate.area,season:before.season,competition:before.competition,candidatePath:candidate.candidate_path,manifestSha256:candidate.manifest_sha256,status:'rolled_back',startedAt:nowIso(),finishedAt:nowIso(),recordsSeen:before.standings.length,recordsUpdated:before.standings.length,backupId:backup.id,notes:'Rollback classifica storica dal Data Manager'});
      db.prepare(`UPDATE research_candidates SET status='approved',imported_at=NULL,last_seen_at=?,notes=? WHERE id=?`).run(nowIso(),'Import annullato: candidato nuovamente approvato.',candidate.id);
      recordChange({entityType:'research_candidate',entityId:candidate.id,action:'rollback',before:standingsChange.after_json?JSON.parse(standingsChange.after_json):null,after:{status:'approved',restored:before.standings.length,importRunId:runId},backupId:backup.id,note:'Rollback season standings candidato'});
      return res.json({ok:true,restored:before.standings.length,backupId:backup.id,importRunId:runId});
    }
    const change=db.prepare(`SELECT * FROM change_log WHERE entity_type='research_candidate' AND entity_id=? AND action='update' AND note='Import match details candidato approvato' ORDER BY id DESC LIMIT 1`).get(candidate.id) as any;
    const before=change?.before_json?JSON.parse(change.before_json):null;
    if(!Array.isArray(before?.matches)||!before.matches.length)return res.status(400).json({error:'Snapshot di rollback non disponibile per questo import'});
    const backup=createBackupSnapshot(`before-candidate-${candidate.id}-rollback`);
    db.transaction(()=>{for(const row of before.matches){db.prepare(`UPDATE matches SET stadium=?,referee=?,source_provider=?,source_url=?,last_verified_at=? WHERE id=?`).run(row.stadium??null,row.referee??null,row.source_provider??null,row.source_url??null,row.last_verified_at??null,row.id);}})();
    const runId=recordImportRun({kind:'candidate_import',sourceProvider:candidate.source_provider,area:candidate.area,season:candidate.season,competition:candidate.competition,candidatePath:candidate.candidate_path,manifestSha256:candidate.manifest_sha256,status:'rolled_back',startedAt:nowIso(),finishedAt:nowIso(),recordsSeen:before.matches.length,recordsUpdated:before.matches.length,backupId:backup.id,notes:'Rollback import candidato dal Data Manager'});
    db.prepare(`UPDATE research_candidates SET status='approved',imported_at=NULL,last_seen_at=?,notes=? WHERE id=?`).run(nowIso(),'Import annullato: candidato nuovamente approvato.',candidate.id);
    recordChange({entityType:'research_candidate',entityId:candidate.id,action:'rollback',before:change.after_json?JSON.parse(change.after_json):null,after:{status:'approved',restored:before.matches.length,importRunId:runId},backupId:backup.id,note:'Rollback import match details candidato'});
    res.json({ok:true,restored:before.matches.length,backupId:backup.id,importRunId:runId});
  }catch(e){res.status(400).json({error:String(e)});}
});

// Coverage is deliberately reported as N/D rather than a zero.  In this
// archive, most historic match detail is outside the provider coverage and is
// not an error to be "filled" by guessing from the final score.
api.get('/data-quality', (_req,res)=>{
  type Issue={id:string;priority:'critical'|'high'|'medium'|'low';type:string;title:string;description:string;location:string;season:string|null;competition:string|null;source:'manual'|'imported'|'none';verified:boolean;conflict:boolean;count:number;actionLabel:string;actionPath:string;canEdit:boolean;canImport:boolean;needsSource:boolean};
  const issues:Issue[]=[];
  const add=(issue:Issue)=>issues.push(issue);
  const seasonLocation=(season:string,competition:string)=>`${season} · ${competition}`;
  const seasons=db.prepare(`SELECT season,competition FROM seasons ORDER BY season DESC,competition`).all() as {season:string;competition:string}[];

  for(const conflict of db.prepare(`SELECT c.*,e.match_id,m.date,m.season,m.competition,m.home_team,m.away_team
      FROM data_conflicts c LEFT JOIN match_events e ON c.entity_type='match_event' AND e.id=CAST(c.entity_key AS INTEGER)
      LEFT JOIN matches m ON m.id=e.match_id WHERE c.status='open' ORDER BY c.created_at DESC`).all() as any[]){
    const event=conflict.entity_type==='match_event';
    add({id:`conflict-${conflict.id}`,priority:'critical',type:'Conflitto',title:`Conflitto aperto: ${conflict.entity_type}.${conflict.field}`,
      description:`Il valore proposto (${conflict.new_value??'N/D'}) non sostituisce automaticamente quello presente (${conflict.old_value??'N/D'}). Verifica una fonte prima di decidere.`,
      location:event&&conflict.date?`${String(conflict.date).slice(0,10)} · ${conflict.home_team} – ${conflict.away_team}`:`Record #${conflict.entity_key}`,
      season:conflict.season??null,competition:conflict.competition??null,source:'imported',verified:false,conflict:true,count:1,
      actionLabel:event?'Rivedi evento':'Apri conflitto',actionPath:event?`/data-manager/manual?entity=match-events&id=${conflict.entity_key}`:'/data-manager',canEdit:true,canImport:false,needsSource:true});
  }

  for(const event of db.prepare(`SELECT e.id,e.match_id,m.date,m.season,m.competition,m.home_team,m.away_team
      FROM match_events e JOIN matches m ON m.id=e.match_id WHERE e.minute IS NULL ORDER BY m.date DESC`).all() as any[]){
    add({id:`event-minute-${event.id}`,priority:'high',type:'Evento sospetto',title:'Evento senza minuto verificato',
      description:'Il provider ha lasciato il minuto assente o non valido. Mantienilo N/D finché un referto o video non lo conferma.',
      location:`${String(event.date).slice(0,10)} · ${event.home_team} – ${event.away_team}`,season:event.season??null,competition:event.competition??null,
      source:'imported',verified:false,conflict:false,count:1,actionLabel:'Modifica evento',actionPath:`/data-manager/manual?entity=match-events&id=${event.id}`,canEdit:true,canImport:false,needsSource:true});
  }

  for(const row of db.prepare(`SELECT m.season,m.competition,COUNT(*) AS count FROM matches m
      WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM match_events e WHERE e.match_id=m.id)
      GROUP BY m.season,m.competition ORDER BY m.season DESC,m.competition`).all() as any[]){
    add({id:`events-missing-${row.season}-${row.competition}`,priority:'low',type:'Dettagli partita',title:`${row.count} partite senza eventi`,
      description:'Copertura eventi non disponibile nel dataset locale: non equivale a zero eventi e non va ricostruita dal risultato.',location:seasonLocation(row.season??'Senza stagione',row.competition??'Senza competizione'),season:row.season??null,competition:row.competition??null,
      source:'imported',verified:false,conflict:false,count:row.count,actionLabel:'Apri partite',actionPath:`/matches?season=${encodeURIComponent(row.season??'')}&competition=${encodeURIComponent(row.competition??'')}`,canEdit:true,canImport:true,needsSource:true});
  }
  for(const row of db.prepare(`SELECT m.season,m.competition,COUNT(*) AS count FROM matches m
      WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM match_team_stats s WHERE s.match_id=m.id)
      GROUP BY m.season,m.competition ORDER BY m.season DESC,m.competition`).all() as any[]){
    add({id:`stats-missing-${row.season}-${row.competition}`,priority:'low',type:'Statistiche partita',title:`${row.count} partite senza statistiche`,description:'Le statistiche match sono N/D per assenza di coverage; non stimarle dal punteggio finale.',location:seasonLocation(row.season??'Senza stagione',row.competition??'Senza competizione'),season:row.season??null,competition:row.competition??null,source:'imported',verified:false,conflict:false,count:row.count,actionLabel:'Apri partite',actionPath:`/matches?season=${encodeURIComponent(row.season??'')}&competition=${encodeURIComponent(row.competition??'')}`,canEdit:false,canImport:true,needsSource:true});
  }
  for(const row of db.prepare(`SELECT m.season,m.competition,COUNT(*) AS count FROM matches m
      WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM match_lineups l WHERE l.match_id=m.id)
      GROUP BY m.season,m.competition ORDER BY m.season DESC,m.competition`).all() as any[]){
    add({id:`lineups-missing-${row.season}-${row.competition}`,priority:'low',type:'Formazioni',title:`${row.count} partite senza formazioni`,description:'La formazione non è stata fornita dalla fonte locale. Lascia N/D fino a una fonte riproducibile.',location:seasonLocation(row.season??'Senza stagione',row.competition??'Senza competizione'),season:row.season??null,competition:row.competition??null,source:'imported',verified:false,conflict:false,count:row.count,actionLabel:'Apri partite',actionPath:`/matches?season=${encodeURIComponent(row.season??'')}&competition=${encodeURIComponent(row.competition??'')}`,canEdit:false,canImport:true,needsSource:true});
  }

  for(const entry of seasons){
    const stats=db.prepare(`SELECT COUNT(*) AS total,COUNT(CASE WHEN appearances IS NOT NULL OR minutes IS NOT NULL OR goals IS NOT NULL OR assists IS NOT NULL THEN 1 END) AS with_stats FROM player_seasons WHERE season=? AND competition=?`).get(entry.season,entry.competition) as any;
    if(!stats.total)add({id:`squad-missing-${entry.season}-${entry.competition}`,priority:entry.season==='2026/27'?'low':'high',type:'Rosa e statistiche',title:'Rosa / statistiche giocatore assenti',description:entry.season==='2026/27'?'Stagione futura predisposta: nessuna azione richiesta finché non iniziano le competizioni.':'Non esistono righe PlayerSeason per questa competizione. Recupera solo un export o API che dichiari la coverage.',location:seasonLocation(entry.season,entry.competition),season:entry.season,competition:entry.competition,source:'none',verified:false,conflict:false,count:1,actionLabel:'Gestisci PlayerSeason',actionPath:'/data-manager/manual?entity=player-seasons',canEdit:true,canImport:true,needsSource:true});
    else if(stats.with_stats===0)add({id:`player-stats-missing-${entry.season}-${entry.competition}`,priority:'medium',type:'Statistiche giocatore',title:`${stats.total} giocatori senza rendimento`,description:'La rosa è presente, ma presenze/minuti/gol/assist non sono disponibili. Non sostituire i valori N/D con zeri.',location:seasonLocation(entry.season,entry.competition),season:entry.season,competition:entry.competition,source:'imported',verified:false,conflict:false,count:stats.total,actionLabel:'Gestisci PlayerSeason',actionPath:'/data-manager/manual?entity=player-seasons',canEdit:true,canImport:true,needsSource:true});
    else if(stats.with_stats<stats.total)add({id:`player-stats-incomplete-${entry.season}-${entry.competition}`,priority:'medium',type:'Statistiche giocatore',title:`${stats.total-stats.with_stats} righe PlayerSeason incomplete`,description:'Alcuni giocatori hanno soltanto dati parziali. Completa esclusivamente con una fonte puntuale.',location:seasonLocation(entry.season,entry.competition),season:entry.season,competition:entry.competition,source:'imported',verified:false,conflict:false,count:stats.total-stats.with_stats,actionLabel:'Gestisci PlayerSeason',actionPath:'/data-manager/manual?entity=player-seasons',canEdit:true,canImport:true,needsSource:true});
    const standings=(db.prepare(`SELECT COUNT(*) AS count FROM season_standings WHERE season=? AND competition=?`).get(entry.season,entry.competition) as any).count;
    if(standings<10)add({id:`standings-missing-${entry.season}-${entry.competition}`,priority:'medium',type:'Classifica',title:standings?'Classifica incompleta':'Classifica assente',description:'Una classifica completa non è deducibile dalle sole partite del Sassuolo: importa un export della competizione.',location:seasonLocation(entry.season,entry.competition),season:entry.season,competition:entry.competition,source:standings?'imported':'none',verified:false,conflict:false,count:Math.max(1,standings),actionLabel:'Sincronizza stagione',actionPath:'/data-manager',canEdit:false,canImport:true,needsSource:true});
    const teamStats=(db.prepare(`SELECT COUNT(*) AS count FROM team_season_stats WHERE season=? AND competition=?`).get(entry.season,entry.competition) as any).count;
    if(!teamStats)add({id:`team-stats-missing-${entry.season}-${entry.competition}`,priority:'low',type:'Statistiche squadra',title:'Statistiche squadra assenti',description:'Le statistiche aggregate richiedono un provider o export che le esponga esplicitamente.',location:seasonLocation(entry.season,entry.competition),season:entry.season,competition:entry.competition,source:'none',verified:false,conflict:false,count:1,actionLabel:'Sincronizza stagione',actionPath:'/data-manager',canEdit:false,canImport:true,needsSource:true});
  }

  const transferSources=(db.prepare(`SELECT COUNT(*) AS count FROM transfers WHERE source_url IS NULL OR trim(source_url)=''`).get() as any).count;
  if(transferSources)add({id:'transfer-sources',priority:'medium',type:'Provenienza',title:`${transferSources} trasferimenti senza URL fonte`,description:'I trasferimenti sono presenti ma non verificabili riga per riga. Aggiungi una fonte prima di marcarli come verificati.',location:'Archivio trasferimenti',season:null,competition:null,source:'none',verified:false,conflict:false,count:transferSources,actionLabel:'Gestisci trasferimenti',actionPath:'/data-manager/manual?entity=transfers',canEdit:true,canImport:false,needsSource:true});
  for(const duplicate of db.prepare(`SELECT normalized_title,COUNT(*) AS count FROM news_articles GROUP BY normalized_title HAVING COUNT(*)>1`).all() as any[]){
    add({id:`news-duplicate-${duplicate.normalized_title}`,priority:'medium',type:'Duplicato',title:`${duplicate.count} news con titolo duplicato`,description:'È un duplicato editoriale potenziale: usa l’anteprima e conserva la voce più recente prima di applicare la deduplica.',location:'RSS news',season:null,competition:null,source:'imported',verified:false,conflict:false,count:duplicate.count,actionLabel:'Apri deduplica',actionPath:'/data-manager',canEdit:false,canImport:false,needsSource:false});
  }
  const summary={critical:issues.filter(x=>x.priority==='critical').reduce((n,x)=>n+x.count,0),high:issues.filter(x=>x.priority==='high').reduce((n,x)=>n+x.count,0),medium:issues.filter(x=>x.priority==='medium').reduce((n,x)=>n+x.count,0),low:issues.filter(x=>x.priority==='low').reduce((n,x)=>n+x.count,0)};
  res.json({summary,issues});
});
api.get('/compare/seasons', (req,res)=>{
  const selected=[String(req.query.a??''),String(req.query.b??'')].filter(Boolean);
  if(selected.length!==2)return res.status(400).json({error:'Seleziona due stagioni'});
  const rows=selected.map(season=>{
    const records=db.prepare(`SELECT * FROM seasons WHERE season=? ORDER BY CASE competition WHEN 'Serie A' THEN 0 WHEN 'Serie B' THEN 1 ELSE 2 END`).all(season) as any[];
    return {season,records:records.map(record=>({...record,coverage:db.prepare(`SELECT COUNT(*) AS matches, SUM(CASE WHEN home_score IS NOT NULL AND away_score IS NOT NULL THEN 1 ELSE 0 END) AS completed, COUNT(DISTINCT ps.player_id) AS squad FROM matches m LEFT JOIN player_seasons ps ON ps.season=m.season AND ps.competition=m.competition WHERE m.season=? AND m.competition=?`).get(record.season,record.competition)}))};
  });
  res.json(rows);
});
api.get('/compare/players', (req,res)=>{
  const ids=[Number(req.query.a),Number(req.query.b)];
  if(ids.some(id=>!Number.isInteger(id)||id<=0)||ids[0]===ids[1])return res.status(400).json({error:'Seleziona due giocatori diversi'});
  res.json(ids.map(id=>{const player=canonicalPlayer(id);if(!player)return null;const coverage=db.prepare(`SELECT COUNT(*) AS seasons,COUNT(CASE WHEN appearances IS NOT NULL OR minutes IS NOT NULL OR goals IS NOT NULL THEN 1 END) AS with_stats,MAX(last_verified_at) AS last_verified_at FROM player_seasons WHERE player_id=?`).get(id);return {player,coverage,seasons:db.prepare(`SELECT season,competition,appearances,minutes,goals,assists FROM player_seasons WHERE player_id=? ORDER BY season DESC`).all(id)}}));
});
api.get('/timeline', (_req,res)=>res.json(getClubHistory().milestones));
api.get('/methodology', (_req,res)=>res.json({lastRecalculation:getSetting('data_last_audit_at')||getSetting('last_import_at'),rules:[{name:'Punti',formula:'3 per vittoria, 1 per pareggio, 0 per sconfitta; solo gare concluse.'},{name:'Posizione',formula:'Posizione finale dalla classifica verificata della stagione.'},...[...RECORD_DEFINITIONS,...HALL_OF_FAME_DEFINITIONS].map(rule=>({name:rule.label,formula:`${rule.formula} Spareggio: ${rule.tieBreak} Soglia: ${rule.minimum}`}))],providerPriority:['Correzione manuale protetta','Fonte verificata archiviata','KickoffAPI (partite e dettagli)','API-Football (rose e statistiche)','Import storico'] }));
api.get('/api-football/status', (_req,res)=>res.json(apiFootballStatus()));
api.post('/api-football/test', async(_req,res)=>res.json(await testApiFootball()));
api.post('/api-football/current', async(_req,res)=>{try{res.json({ok:true,result:await trackedProviderRun({provider:'api-football',area:'current-season'},syncApiFootballCurrent)});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.post('/api-football/season/:season', async(req,res)=>{try{res.json({ok:true,result:await trackedProviderRun({provider:'api-football',area:'season',season:req.params.season},()=>syncApiFootballSeason(req.params.season))});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.post('/api-football/transfers', async(_req,res)=>{try{res.json({ok:true,result:await trackedProviderRun({provider:'api-football',area:'transfers'},syncApiFootballTransfers)});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.get('/kickoff/status', (_req,res)=>res.json(kickoffStatus()));
api.post('/kickoff/test', async(_req,res)=>res.json(await testKickoff()));
api.post('/kickoff/current', async(req,res)=>{try{res.json({ok:true,result:await trackedProviderRun({provider:'kickoff',area:'current-season'},()=>syncKickoffCurrent(req.query.force==='1'||req.body?.force===true))});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.post('/kickoff/season/:season', async(req,res)=>{try{const max=Number(req.query.max??req.body?.max);res.json({ok:true,result:await trackedProviderRun({provider:'kickoff',area:'season',season:req.params.season},()=>syncKickoffSeason(req.params.season,req.query.force==='1'||req.body?.force===true,Number.isFinite(max)&&max>0?Math.trunc(max):undefined))});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.post('/kickoff/match/:id', async(req,res)=>{try{res.json({ok:true,result:await syncKickoffMatchDetails(Number(req.params.id),true,20)});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.get('/search', (req,res)=>{const q=String(req.query.q??'').trim();if(!q)return res.json({players:[],matches:[],seasons:[],opponents:[]});const like=`%${q}%`;res.json({players:db.prepare(`SELECT id,name,position FROM players WHERE name LIKE ? ORDER BY name LIMIT 8`).all(like),matches:db.prepare(`SELECT id,date,home_team,away_team,home_score,away_score FROM matches WHERE home_team LIKE ? OR away_team LIKE ? ORDER BY date DESC LIMIT 8`).all(like,like),seasons:db.prepare(`SELECT id,season,competition FROM seasons WHERE season LIKE ? OR competition LIKE ? ORDER BY season DESC LIMIT 8`).all(like,like),opponents:db.prepare(`SELECT CASE WHEN lower(home_team) LIKE '%sassuolo%' THEN away_team ELSE home_team END AS name,COUNT(*) AS matches FROM matches WHERE (home_team LIKE ? OR away_team LIKE ?) AND lower(home_team) NOT LIKE lower(?) GROUP BY name ORDER BY matches DESC,name LIMIT 8`).all(like,like,'%Sassuolo%')});});
api.post('/import', (_req,res)=>{
  const started=nowIso();
  try{
    const backup=createBackupSnapshot('before-local-import');
    const result=importAll();
    const runId=recordImportRun({kind:'local_import',sourceProvider:'local-files',status:'succeeded',startedAt:started,finishedAt:nowIso(),backupId:backup.id,recordsSeen:Number((result as any)?.rows??0),notes:'Import locale confermato dal Data Manager'});
    recordChange({entityType:'import',action:'create',after:result,backupId:backup.id,note:`Import locale confermato dal Data Manager · run #${runId}`});
    res.json({ok:true,...result,backupId:backup.id,importRunId:runId});
  }catch(e){
    recordImportRun({kind:'local_import',sourceProvider:'local-files',status:'failed',startedAt:started,finishedAt:nowIso(),error:String(e),notes:'Import locale fallito'});
    res.status(500).json({ok:false,error:String(e)});
  }
});
api.post('/import/preview', (req,res)=>{
  try{
    const {entity,filename,content}=req.body??{};
    if(!importEntities.includes(entity))return res.status(400).json({error:'Tipo di dato non supportato'});
    if(typeof filename!=='string'||typeof content!=='string')return res.status(400).json({error:'File non valido'});
    res.json({ok:true,preview:previewControlledImport(entity as ImportEntity,filename,content)});
  }catch(e){res.status(400).json({ok:false,error:String(e)});}
});

api.post('/import/apply', (req,res)=>{
  const started=nowIso();
  try{
    const {entity,filename,content,checksum}=req.body??{};
    if(!importEntities.includes(entity))return res.status(400).json({error:'Tipo di dato non supportato'});
    if(typeof filename!=='string'||typeof content!=='string'||typeof checksum!=='string')return res.status(400).json({error:'Conferma import non valida'});
    const preview=previewControlledImport(entity as ImportEntity,filename,content);
    if(preview.checksum!==checksum)return res.status(409).json({error:'Il file è cambiato dopo il dry-run: eseguire una nuova anteprima'});
    if(!preview.canApply)return res.status(400).json({error:`Import bloccato: ${preview.errors} errori critici`,preview});
    const previous=db.prepare(`SELECT id FROM import_runs WHERE kind='local_import' AND manifest_sha256=? AND status='succeeded' LIMIT 1`).get(checksum) as {id:number}|undefined;
    if(previous)return res.status(409).json({error:`Questo contenuto è già stato importato con il run #${previous.id}`});
    const backup=createBackupSnapshot(`before-controlled-${entity}-import`);
    const applied=applyControlledImport(entity as ImportEntity,filename,content);
    const ext=path.extname(filename).toLowerCase();const safeBase=path.basename(filename,ext).replace(/[^a-zA-Z0-9._-]+/g,'_');
    const archiveDir=path.resolve('data','imports',entity);fs.mkdirSync(archiveDir,{recursive:true});
    const archivePath=path.join(archiveDir,`${checksum.slice(0,12)}-${safeBase}${ext}`);fs.writeFileSync(archivePath,content,'utf8');
    const runId=recordImportRun({kind:'local_import',sourceProvider:'controlled-upload',area:entity,manifestSha256:checksum,status:'succeeded',startedAt:started,finishedAt:nowIso(),recordsSeen:preview.rows,recordsCreated:preview.created,recordsUpdated:preview.updated,recordsSkipped:preview.skipped,recordsRejected:preview.conflicts,backupId:backup.id,diff:preview,notes:`File archiviato in ${path.relative(process.cwd(),archivePath)}`});
    const provenanceReferences=recordControlledImportProvenance(entity as ImportEntity,filename,content,runId,path.relative(process.cwd(),archivePath));
    recordChange({entityType:'import',action:'create',after:{...applied.result,preview,archivePath:path.relative(process.cwd(),archivePath),importRunId:runId},backupId:backup.id,note:`Import controllato ${entity}`});
    res.json({ok:true,preview,result:applied.result,backupId:backup.id,importRunId:runId,provenanceReferences,archived:path.relative(process.cwd(),archivePath)});
  }catch(e){
    recordImportRun({kind:'local_import',sourceProvider:'controlled-upload',area:req.body?.entity??null,manifestSha256:req.body?.checksum??null,status:'failed',startedAt:started,finishedAt:nowIso(),error:String(e),notes:'Import controllato fallito'});
    res.status(400).json({ok:false,error:String(e)});
  }
});
api.post('/update/smart', async(_req,res)=>{try{res.json({ok:true,results:await smartUpdate()});}catch(e){res.status(500).json({ok:false,error:String(e)});}});
api.post('/update/matches', async(_req,res)=>res.json({ok:true,result:kickoffStatus().configured?await syncKickoffCurrent(false):await syncMatches()}));
api.post('/update/squad', async(_req,res)=>res.json({ok:true,result:await syncSquad()}));
api.post('/update/news', async(_req,res)=>res.json({ok:true,result:await syncNews()}));
api.post('/update/current-season', async(_req,res)=>{
  const season=currentSeason();
  const tasks=[
    {key:'matches',provider:kickoffStatus().configured?'kickoff':'football-data',run:()=>kickoffStatus().configured?syncKickoffCurrent(false):syncMatches()},
    {key:apiFootballStatus().configured?'apiFootball':'squad',provider:apiFootballStatus().configured?'api-football':'thesportsdb',run:()=>apiFootballStatus().configured?syncApiFootballCurrent():syncSquad()},
  ];
  const results:Record<string,unknown>={};const errors:string[]=[];
  for(const task of tasks){
    try{results[task.key]=await trackedProviderRun({provider:task.provider,area:'current-season',season},task.run);}
    catch(error){const message=String(error).replace(/^Error:\s*/,'');results[task.key]={errors:[message]};errors.push(`${task.provider}: ${message}`);}
  }
  res.status(errors.length?207:200).json({ok:errors.length===0,results,errors});
});
api.post('/update/enrich', async(_req,res)=>res.json({ok:true,results:{apiFootball:apiFootballStatus().configured?await syncApiFootballCurrent():null,squad:apiFootballStatus().configured?null:await syncSquad(),news:await syncNews()}}));
api.post('/update/force', async(_req,res)=>res.json({ok:true,results:await smartUpdate()}));

api.get('/current-season', (_req,res)=>{
  try{res.json(getCurrentSeasonDashboard());}
  catch(e){res.status(500).json({error:String(e)});}
});
api.post('/current-season/matches/validate',(req,res)=>{
  try{res.json(validateCurrentMatch(req.body??{},asInt(req.body?.id)??undefined));}
  catch(e){res.status(400).json({error:String(e)});}
});
api.post('/current-season/matches',(req,res)=>{
  try{
    const result=saveCurrentMatch(req.body??{});
    if(!result.valid)return res.status(400).json(result);
    if(result.warnings?.length&&!req.body?.forceWarnings)return res.status(422).json(result);
    res.json(result);
  }catch(e){res.status(400).json({error:String(e)});}
});
api.put('/current-season/matches/:id',(req,res)=>{
  try{
    const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID partita non valido'});
    const result=saveCurrentMatch(req.body??{},id);
    if(!result.valid)return res.status(400).json(result);
    if(result.warnings?.length&&!req.body?.forceWarnings)return res.status(422).json(result);
    res.json(result);
  }catch(e){res.status(400).json({error:String(e)});}
});
api.get('/current-season/matches/:id/events',(req,res)=>{
  try{
    const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID partita non valido'});
    const match=db.prepare(`SELECT id,date,season,competition,home_team,away_team,home_score,away_score,source_url FROM matches WHERE id=? AND season=?`).get(id,currentSeason()) as any;
    if(!match)return res.status(404).json({error:'Partita della stagione corrente non trovata'});
    const events=db.prepare(`SELECT * FROM match_events WHERE match_id=? ORDER BY COALESCE(minute,999),COALESCE(extra_minute,0),id`).all(id);
    res.json({match,events});
  }catch(e){res.status(500).json({error:String(e)});}
});


function nullish(v:any){ return v === '' || v === undefined ? null : v; }
function asInt(v:any){ const n=Number(v); return v==null||v===''||Number.isNaN(n)?null:Math.trunc(n); }
function asNum(v:any){ const n=Number(v); return v==null||v===''||Number.isNaN(n)?null:n; }
function boolInt(v:any){ return v===true||v===1||v==='1'||v==='true'?1:0; }

const manualTables:Record<string,string>={
  seasons:'seasons', matches:'matches', players:'players', 'player-seasons':'player_seasons', transfers:'transfers', 'match-events':'match_events', match_event:'match_events'
};

function manualDeleteImpact(entity:string,id:number){
  const table=manualTables[entity];
  if(!table)return null;
  const exists=db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id);
  if(!exists)return null;
  if(entity==='matches')return {record:true,cascades:{events:(db.prepare(`SELECT count(*) AS c FROM match_events WHERE match_id=?`).get(id) as any).c,lineups:(db.prepare(`SELECT count(*) AS c FROM match_lineups WHERE match_id=?`).get(id) as any).c,teamStats:(db.prepare(`SELECT count(*) AS c FROM match_team_stats WHERE match_id=?`).get(id) as any).c,playerStats:(db.prepare(`SELECT count(*) AS c FROM match_player_stats WHERE match_id=?`).get(id) as any).c,injuries:(db.prepare(`SELECT count(*) AS c FROM match_injuries WHERE match_id=?`).get(id) as any).c}};
  if(entity==='players')return {record:true,cascades:{playerSeasons:(db.prepare(`SELECT count(*) AS c FROM player_seasons WHERE player_id=?`).get(id) as any).c,eventLinks:(db.prepare(`SELECT count(*) AS c FROM match_events WHERE player_id=? OR assist_player_id=?`).get(id,id) as any).c,transferLinks:(db.prepare(`SELECT count(*) AS c FROM transfers WHERE player_id=?`).get(id) as any).c}};
  if(entity==='seasons')return {record:true,related:{matches:(db.prepare(`SELECT count(*) AS c FROM matches WHERE season=(SELECT season FROM seasons WHERE id=?) AND competition=(SELECT competition FROM seasons WHERE id=?)`).get(id,id) as any).c}};
  return {record:true,cascades:{}};
}

function deleteManualRecord(entity:string,id:number){
  const table=manualTables[entity];
  if(!table)return null;
  const before=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) as any;
  if(!before)return null;
  const backup=createBackupSnapshot(`before-manual-${entity}-delete-${id}`);
  db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
  recordChange({entityType:entity,entityId:id,action:'delete',before,backupId:backup.id,note:'Eliminazione manuale con backup'});
  return backup;
}

function undoChange(changeId:number){
  const change=db.prepare(`SELECT * FROM change_log WHERE id=?`).get(changeId) as any;
  if(!change)return {error:'Modifica non trovata'};
  const table=manualTables[change.entity_type];
  if(!table||change.entity_id==null)return {error:'Questa modifica non è ripristinabile automaticamente'};
  const before=change.before_json?JSON.parse(change.before_json):null;
  const after=change.after_json?JSON.parse(change.after_json):null;
  const backup=createBackupSnapshot(`before-undo-change-${changeId}`);
  const allowed=new Set((db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[]).map(x=>x.name));
  const write=(row:any,mode:'insert'|'update')=>{
    const entries=Object.entries(row??{}).filter(([key])=>allowed.has(key));
    if(!entries.length)throw new Error('Storico della modifica incompleto');
    if(mode==='insert'){
      const fields=entries.map(([key])=>key).join(',');
      const slots=entries.map(()=>'?').join(',');
      db.prepare(`INSERT INTO ${table}(${fields}) VALUES(${slots})`).run(...entries.map(([,value])=>value));
    }else{
      const entriesWithoutId=entries.filter(([key])=>key!=='id');
      if(!entriesWithoutId.length)return;
      db.prepare(`UPDATE ${table} SET ${entriesWithoutId.map(([key])=>`${key}=?`).join(',')} WHERE id=?`).run(...entriesWithoutId.map(([,value])=>value),change.entity_id);
    }
  };
  try{
    db.transaction(()=>{
      if(change.action==='delete'&&before)write(before,'insert');
      else if(change.action==='update'&&before)write(before,'update');
      else if(change.action==='create'&&after)db.prepare(`DELETE FROM ${table} WHERE id=?`).run(change.entity_id);
      else throw new Error('Questa modifica non è ripristinabile automaticamente');
      recordChange({entityType:change.entity_type,entityId:change.entity_id,action:'undo',before:after,after:before,backupId:backup.id,note:`Ripristino della modifica #${changeId}`});
    })();
    if(table==='player_seasons')recomputeDerivedPlayerStats();
    return {backupId:backup.id};
  }catch(error){return {error:String(error)};}
}

api.post('/history/bootstrap', async (_req,res)=>{
  try{ res.json({ok:true,...await bootstrapHistoricalLeagueData()}); }
  catch(e){ res.status(500).json({ok:false,error:String(e)}); }
});
api.post('/history/reconcile', (_req,res)=>{
  try { execFileSync(process.execPath,['--import','tsx','scripts/reconcile-history.ts'],{cwd:process.cwd(),stdio:'pipe'}); res.json({ok:true}); }
  catch(e){res.status(500).json({ok:false,error:String(e)});}
});

api.post('/data/audit', (_req,res)=>{
  try{
    const output=execFileSync(process.execPath,['--import','tsx','scripts/audit-data-full.ts'],{cwd:process.cwd(),encoding:'utf8'});
    const audit=JSON.parse(output) as any;
    setSetting('data_last_audit_at',audit.generatedAt);
    const issues={foreignKeys:audit.integrity?.foreignKeyViolations?.length??0,duplicateFixtures:audit.integrity?.duplicateFixtures?.length??0,invalidEvents:audit.integrity?.invalidEvents?.length??0,eventsWithoutMinute:audit.integrity?.eventsWithoutMinute?.length??0,duplicateNewsTitles:audit.integrity?.duplicateNewsTitles?.length??0,openConflicts:(audit.conflicts??[]).filter((c:any)=>c.status==='open').length};
    const warnings=[issues.eventsWithoutMinute&&`${issues.eventsWithoutMinute} evento/i senza minuto`,issues.duplicateNewsTitles&&`${issues.duplicateNewsTitles} titolo/i RSS duplicati`,issues.openConflicts&&`${issues.openConflicts} conflitto/i aperti`].filter(Boolean);
    const auditRun=db.prepare(`SELECT id,report_path,report_sha256,issue_count,blocking_issue_count FROM audit_runs WHERE generated_at=? ORDER BY id DESC LIMIT 1`).get(audit.generatedAt) as any;
    res.json({ok:true,result:{generatedAt:audit.generatedAt,auditRunId:audit.auditRunId??auditRun?.id,reportPath:audit.reportPath??auditRun?.report_path,tableCounts:audit.tableCounts,issues,warnings}});
  }catch(e){res.status(500).json({ok:false,error:String(e)});}
});

function newsDedupeGroups(){
  return db.prepare(`SELECT normalized_title,COUNT(*) AS duplicates,GROUP_CONCAT(id) AS ids,GROUP_CONCAT(url,' | ') AS urls
    FROM news_articles GROUP BY normalized_title HAVING COUNT(*)>1 ORDER BY duplicates DESC,normalized_title`).all() as {normalized_title:string;duplicates:number;ids:string;urls:string}[];
}
api.get('/news/dedupe-preview',(_req,res)=>res.json({groups:newsDedupeGroups()}));
api.post('/news/dedupe-apply',(_req,res)=>{
  try{
    const groups=newsDedupeGroups();
    if(!groups.length)return res.json({ok:true,removed:0});
    const backup=createBackupSnapshot('before-news-deduplication');
    let removed=0;
    db.transaction(()=>{
      for(const group of groups){
        const rows=db.prepare(`SELECT id FROM news_articles WHERE normalized_title=? ORDER BY COALESCE(published_at,cached_at) DESC,id DESC`).all(group.normalized_title) as {id:number}[];
        for(const row of rows.slice(1)){db.prepare(`DELETE FROM news_articles WHERE id=?`).run(row.id);removed++;}
      }
      recordChange({entityType:'news_articles',action:'delete',after:{groups:groups.length,removed},backupId:backup.id,note:'Deduplicazione RSS confermata dal Data Manager'});
    })();
    res.json({ok:true,removed,backupId:backup.id});
  }catch(e){res.status(500).json({error:String(e)});}
});

api.get('/manual/changes', (_req,res)=>res.json(db.prepare(`SELECT id,entity_type,entity_id,action,source_url,note,author,backup_id,created_at FROM change_log ORDER BY id DESC LIMIT 100`).all()));
api.post('/manual/changes/:id/undo',(req,res)=>{
  const id=asInt(req.params.id);
  if(id==null)return res.status(400).json({error:'ID modifica non valido'});
  const result=undoChange(id);
  if('error' in result)return res.status(400).json(result);
  res.json({ok:true,...result});
});

api.get('/manual/:entity/:id/impact',(req,res)=>{
  const id=asInt(req.params.id);
  if(id==null)return res.status(400).json({error:'ID non valido'});
  const impact=manualDeleteImpact(req.params.entity,id);
  if(!impact)return res.status(404).json({error:'Record non trovato'});
  res.json(impact);
});

api.get('/manual/:entity', (req,res)=>{
  const e=req.params.entity;
  if(e==='seasons') return res.json(db.prepare(`SELECT * FROM seasons ORDER BY season DESC,competition`).all());
  if(e==='matches') return res.json(db.prepare(`SELECT * FROM matches ORDER BY date DESC,id DESC LIMIT 2500`).all());
  if(e==='players') return res.json(db.prepare(`SELECT * FROM players ORDER BY name`).all());
  if(e==='player-seasons') return res.json(db.prepare(`SELECT ps.*,p.name AS player_name FROM player_seasons ps JOIN players p ON p.id=ps.player_id ORDER BY ps.season DESC,p.name`).all());
  if(e==='transfers') return res.json(db.prepare(`SELECT * FROM transfers ORDER BY date DESC,id DESC`).all());
  if(e==='match-events') return res.json(db.prepare(`SELECT e.*,m.date AS match_date,m.season AS match_season,m.competition AS match_competition,m.home_team,m.away_team,m.home_score,m.away_score
    FROM match_events e JOIN matches m ON m.id=e.match_id
    ORDER BY m.date DESC,COALESCE(e.minute,999),COALESCE(e.extra_minute,0),e.id DESC`).all());
  res.status(404).json({error:'Entity non supportata'});
});

// A dedicated endpoint makes events safely editable without asking a curator
// to open SQLite.  Source URL + note are required for a verified correction;
// an intentionally unresolved event can remain without a minute.
const manualEventStandards=new Set([
  'Goal|Normal Goal','Goal|Penalty','Goal|Own Goal','Goal|Missed Penalty',
  'Card|Yellow Card','Card|Red Card','subst|Substitution',
  'Var|Goal confirmed','Var|Goal cancelled','Var|Penalty confirmed','Var|Penalty cancelled','Var|Card reviewed','Var|Card upgrade',
]);
function validateManualEvent(x:any,eventId?:number){
  const matchId=asInt(x.match_id),match=matchId==null?null:db.prepare(`SELECT id,home_team,away_team,home_score,away_score FROM matches WHERE id=?`).get(matchId) as any;
  if(!match)return 'Seleziona una partita esistente';
  const type=String(x.type??'').trim(),detail=String(x.detail??'').trim();
  if(!manualEventStandards.has(`${type}|${detail}`))return 'Seleziona un tipo evento previsto dallo standard dell’archivio';
  const minute=asInt(x.minute),extra=asInt(x.extra_minute);
  if(minute!=null&&(minute<0||minute>130))return 'Il minuto deve essere compreso tra 0 e 130';
  if(extra!=null&&(extra<0||extra>30))return 'Il recupero deve essere compreso tra 0 e 30';
  if(extra!=null&&minute==null)return 'Indica il minuto regolamentare prima del recupero';
  const team=String(x.team_name??'').trim();
  if(team!==match.home_team&&team!==match.away_team)return 'Seleziona una delle due squadre della partita';
  const player=String(x.player_name??'').trim(),assist=String(x.assist_name??'').trim();
  if(type!=='Var'&&!player)return type==='subst'?'Indica il giocatore che esce':'Indica il giocatore coinvolto';
  if(type==='subst'&&!assist)return 'Indica il giocatore che entra';
  if(type==='subst'&&player.localeCompare(assist,'it',{sensitivity:'base'})===0)return 'Il giocatore che entra deve essere diverso da quello che esce';
  const scoringGoal=type==='Goal'&&detail!=='Missed Penalty';
  const homeScore=asInt(x.home_score),awayScore=asInt(x.away_score);
  if(scoringGoal&&(homeScore==null||awayScore==null))return 'Per un gol indica il punteggio casa e trasferta subito dopo l’evento';
  if(homeScore!=null&&awayScore!=null&&(homeScore<0||awayScore<0))return 'Il punteggio dopo l’evento non può essere negativo';
  if((homeScore!=null&&match.home_score!=null&&homeScore>match.home_score)||(awayScore!=null&&match.away_score!=null&&awayScore>match.away_score))return 'Il punteggio dopo l’evento non può superare il risultato finale';
  if(x.verified&&(!nullish(x.source_url)||!nullish(x.verification_note)))return 'Per verificare un evento servono URL fonte e nota curatoriale';
  const duplicate=minute==null?null:db.prepare(`SELECT id FROM match_events WHERE match_id=? AND minute=? AND COALESCE(extra_minute,0)=COALESCE(?,0) AND lower(COALESCE(team_name,''))=lower(?) AND lower(COALESCE(player_name,''))=lower(?) AND type=? AND detail=? AND id<>? LIMIT 1`).get(matchId,minute,extra,team,player,type,detail,eventId??-1);
  if(duplicate)return 'Questo evento risulta già presente nella sequenza della partita';
  return null;
}
api.post('/manual/match-events',(req,res)=>{try{
  const x=req.body??{},matchId=asInt(x.match_id);
  const validationError=validateManualEvent(x);if(validationError)return res.status(400).json({error:validationError});
  const scoringPlay=x.type==='Goal'&&x.detail!=='Missed Penalty',ownGoal=x.type==='Goal'&&x.detail==='Own Goal';
  const result=db.prepare(`INSERT INTO match_events(match_id,source_provider,provider_match_id,minute,extra_minute,team_name,player_name,assist_name,type,detail,comments,scoring_play,home_score,away_score,is_own_goal,source_url,verification_note,verified_by,last_verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(matchId,'manual',`manual:${matchId}`,asInt(x.minute),asInt(x.extra_minute),nullish(x.team_name),nullish(x.player_name),nullish(x.assist_name),nullish(x.type),nullish(x.detail),nullish(x.comments),boolInt(scoringPlay),asInt(x.home_score),asInt(x.away_score),boolInt(ownGoal),nullish(x.source_url),nullish(x.verification_note),nullish(x.verified_by),x.verified?nowIso():null);
  const id=Number(result.lastInsertRowid),after=db.prepare(`SELECT * FROM match_events WHERE id=?`).get(id);
  if(x.source_url)recordSourceReference({entityType:'match_event',entityId:id,field:null,sourceUrl:String(x.source_url),note:nullish(x.verification_note),author:nullish(x.verified_by)});
  recordChange({entityType:'match_event',entityId:id,action:'create',after,sourceUrl:nullish(x.source_url),note:nullish(x.verification_note),author:nullish(x.verified_by)});
  res.json({ok:true,id});
}catch(e){res.status(500).json({error:String(e)});}});
api.put('/manual/match-events/:id',(req,res)=>{try{
  const x=req.body??{},id=asInt(req.params.id);
  if(id==null)return res.status(400).json({error:'ID evento non valido'});
  const before=db.prepare(`SELECT * FROM match_events WHERE id=?`).get(id) as any;
  if(!before)return res.status(404).json({error:'Evento non trovato'});
  const matchId=asInt(x.match_id),validationError=validateManualEvent(x,id);if(validationError)return res.status(400).json({error:validationError});
  const scoringPlay=x.type==='Goal'&&x.detail!=='Missed Penalty',ownGoal=x.type==='Goal'&&x.detail==='Own Goal';
  db.prepare(`UPDATE match_events SET match_id=?,minute=?,extra_minute=?,team_name=?,player_name=?,assist_name=?,type=?,detail=?,comments=?,scoring_play=?,home_score=?,away_score=?,is_own_goal=?,source_provider='manual',source_url=?,verification_note=?,verified_by=?,last_verified_at=? WHERE id=?`).run(matchId,asInt(x.minute),asInt(x.extra_minute),nullish(x.team_name),nullish(x.player_name),nullish(x.assist_name),nullish(x.type),nullish(x.detail),nullish(x.comments),boolInt(scoringPlay),asInt(x.home_score),asInt(x.away_score),boolInt(ownGoal),nullish(x.source_url),nullish(x.verification_note),nullish(x.verified_by),x.verified?nowIso():null,id);
  const after=db.prepare(`SELECT * FROM match_events WHERE id=?`).get(id);
  if(x.source_url)recordSourceReference({entityType:'match_event',entityId:id,field:'manual-review',sourceUrl:String(x.source_url),note:nullish(x.verification_note),author:nullish(x.verified_by)});
  recordChange({entityType:'match_event',entityId:id,action:'update',before,after,sourceUrl:nullish(x.source_url),note:nullish(x.verification_note),author:nullish(x.verified_by)});
  const conflictResolvedAt=nowIso();
  const resolved=db.prepare(`UPDATE data_conflicts SET status='resolved',resolved_value=?,resolved_at=?,resolved_by=?,resolution_note=?,updated_at=? WHERE entity_type='match_event' AND entity_key=? AND field='minute' AND status='open'`).run(asInt(x.minute)==null?null:String(asInt(x.minute)),conflictResolvedAt,nullish(x.verified_by)||'Curatore Data Manager',nullish(x.verification_note)||'Evento verificato manualmente',conflictResolvedAt,id);
  if(x.verified&&asInt(x.minute)!=null&&resolved.changes===0)db.prepare(`UPDATE data_conflicts SET status='resolved',resolved_value=?,resolved_at=?,resolved_by=?,resolution_note=?,updated_at=? WHERE entity_type='match_event' AND entity_key=? AND field='minute'`).run(String(asInt(x.minute)),conflictResolvedAt,nullish(x.verified_by)||'Curatore Data Manager',nullish(x.verification_note)||'Evento verificato manualmente',conflictResolvedAt,id);
  res.json({ok:true});
}catch(e){res.status(500).json({error:String(e)});}});
api.delete('/manual/match-events/:id',(req,res)=>{try{
  const id=asInt(req.params.id);
  if(id==null)return res.status(400).json({error:'ID evento non valido'});
  const before=db.prepare(`SELECT * FROM match_events WHERE id=?`).get(id) as any;
  if(!before)return res.status(404).json({error:'Evento non trovato'});
  const backup=createBackupSnapshot(`before-manual-event-delete-${id}`);
  db.prepare(`DELETE FROM match_events WHERE id=?`).run(id);
  recordChange({entityType:'match_event',entityId:id,action:'delete',before,backupId:backup.id,note:'Eliminazione manuale con backup'});
  res.json({ok:true,backupId:backup.id});
}catch(e){res.status(500).json({error:String(e)});}});

api.post('/manual/seasons', (req,res)=>{
  try{
    const x=req.body??{}; if(!x.season)return res.status(400).json({error:'season obbligatoria'});
    const competition=x.competition||'Serie A';
    db.prepare(`INSERT INTO seasons(season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,manager,top_scorer,top_assists,home_record,away_record,source_provider,source_url,last_verified_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(season,competition) DO UPDATE SET final_position=excluded.final_position,matches=excluded.matches,wins=excluded.wins,draws=excluded.draws,losses=excluded.losses,goals_for=excluded.goals_for,goals_against=excluded.goals_against,points=excluded.points,manager=excluded.manager,top_scorer=excluded.top_scorer,top_assists=excluded.top_assists,home_record=excluded.home_record,away_record=excluded.away_record,source_provider='manual',last_verified_at=excluded.last_verified_at`)
      .run(x.season,competition,asInt(x.final_position),asInt(x.matches),asInt(x.wins),asInt(x.draws),asInt(x.losses),asInt(x.goals_for),asInt(x.goals_against),asInt(x.points),nullish(x.manager),nullish(x.top_scorer),nullish(x.top_assists),nullish(x.home_record),nullish(x.away_record),'manual',nullish(x.source_url),nowIso());
    res.json({ok:true});
  }catch(e){res.status(500).json({error:String(e)});}
});
api.put('/manual/seasons/:id', (req,res)=>{
  try{const x=req.body??{};db.prepare(`UPDATE seasons SET season=?,competition=?,final_position=?,matches=?,wins=?,draws=?,losses=?,goals_for=?,goals_against=?,points=?,manager=?,top_scorer=?,top_assists=?,home_record=?,away_record=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(x.season,x.competition||'Serie A',asInt(x.final_position),asInt(x.matches),asInt(x.wins),asInt(x.draws),asInt(x.losses),asInt(x.goals_for),asInt(x.goals_against),asInt(x.points),nullish(x.manager),nullish(x.top_scorer),nullish(x.top_assists),nullish(x.home_record),nullish(x.away_record),nullish(x.source_url),nowIso(),req.params.id);res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}
});
api.delete('/manual/seasons/:id',(req,res)=>{try{const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID non valido'});const backup=deleteManualRecord('seasons',id);if(!backup)return res.status(404).json({error:'Record non trovato'});res.json({ok:true,backupId:backup.id});}catch(e){res.status(500).json({error:String(e)});}});

api.post('/manual/matches', (req,res)=>{
  try{const x=req.body??{};if(!x.date||!x.home_team||!x.away_team)return res.status(400).json({error:'date, home_team e away_team sono obbligatori'});const home=normalizeTeamName(x.home_team),away=normalizeTeamName(x.away_team);const key=x.external_key||`manual|${x.date}|${home}|${away}|${x.competition||''}`;
    db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,halftime_score,stadium,attendance,referee,possession_home,possession_away,shots_home,shots_away,shots_on_target_home,shots_on_target_away,corners_home,corners_away,fouls_home,fouls_away,xg_home,xg_away,source_provider,source_url,last_verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(key,x.date,nullish(x.season),nullish(x.competition),nullish(x.round),home,away,asInt(x.home_score),asInt(x.away_score),nullish(x.halftime_score),nullish(x.stadium),asInt(x.attendance),nullish(x.referee),asNum(x.possession_home),asNum(x.possession_away),asInt(x.shots_home),asInt(x.shots_away),asInt(x.shots_on_target_home),asInt(x.shots_on_target_away),asInt(x.corners_home),asInt(x.corners_away),asInt(x.fouls_home),asInt(x.fouls_away),asNum(x.xg_home),asNum(x.xg_away),'manual',nullish(x.source_url),nowIso());res.json({ok:true});
  }catch(e){res.status(500).json({error:String(e)});}
});
api.put('/manual/matches/:id',(req,res)=>{try{const x=req.body??{};db.prepare(`UPDATE matches SET date=?,season=?,competition=?,round=?,home_team=?,away_team=?,home_score=?,away_score=?,halftime_score=?,stadium=?,attendance=?,referee=?,possession_home=?,possession_away=?,shots_home=?,shots_away=?,shots_on_target_home=?,shots_on_target_away=?,corners_home=?,corners_away=?,fouls_home=?,fouls_away=?,xg_home=?,xg_away=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(x.date,nullish(x.season),nullish(x.competition),nullish(x.round),normalizeTeamName(x.home_team),normalizeTeamName(x.away_team),asInt(x.home_score),asInt(x.away_score),nullish(x.halftime_score),nullish(x.stadium),asInt(x.attendance),nullish(x.referee),asNum(x.possession_home),asNum(x.possession_away),asInt(x.shots_home),asInt(x.shots_away),asInt(x.shots_on_target_home),asInt(x.shots_on_target_away),asInt(x.corners_home),asInt(x.corners_away),asInt(x.fouls_home),asInt(x.fouls_away),asNum(x.xg_home),asNum(x.xg_away),nullish(x.source_url),nowIso(),req.params.id);res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
api.delete('/manual/matches/:id',(req,res)=>{try{const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID non valido'});const backup=deleteManualRecord('matches',id);if(!backup)return res.status(404).json({error:'Record non trovato'});res.json({ok:true,backupId:backup.id});}catch(e){res.status(500).json({error:String(e)});}});

api.post('/manual/players',(req,res)=>{try{const x=req.body??{};if(!x.name)return res.status(400).json({error:'name obbligatorio'});db.prepare(`INSERT INTO players(name,photo_url,nationality,birth_date,position,shirt_number,first_appearance,last_appearance,current_squad,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.name,nullish(x.photo_url),nullish(x.nationality),nullish(x.birth_date),nullish(x.position),asInt(x.shirt_number),nullish(x.first_appearance),nullish(x.last_appearance),boolInt(x.current_squad),'manual',nullish(x.source_url),nowIso());res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
api.put('/manual/players/:id',(req,res)=>{try{const x=req.body??{};db.prepare(`UPDATE players SET name=?,photo_url=?,nationality=?,birth_date=?,position=?,shirt_number=?,first_appearance=?,last_appearance=?,current_squad=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(x.name,nullish(x.photo_url),nullish(x.nationality),nullish(x.birth_date),nullish(x.position),asInt(x.shirt_number),nullish(x.first_appearance),nullish(x.last_appearance),boolInt(x.current_squad),nullish(x.source_url),nowIso(),req.params.id);res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
api.delete('/manual/players/:id',(req,res)=>{try{const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID non valido'});const backup=deleteManualRecord('players',id);if(!backup)return res.status(404).json({error:'Record non trovato'});res.json({ok:true,backupId:backup.id});}catch(e){res.status(500).json({error:String(e)});}});

function resolvePlayerId(x:any){
  if(x.player_id)return asInt(x.player_id);
  if(!x.player_name)return null;
  const resolution=resolvePlayer({name:String(x.player_name),sourceProvider:'manual',context:'manual-editor',allowCreate:true});
  if(resolution.status==='conflict') throw new Error(`Identità ambigua: ${resolution.reason}. Risolvere dalla schermata Identità giocatori.`);
  return resolution.playerId;
}
api.post('/manual/player-seasons',(req,res)=>{try{const x=req.body??{},pid=resolvePlayerId(x);if(!pid||!x.season)return res.status(400).json({error:'player_name/player_id e season sono obbligatori'});db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,rating,shots_total,shots_on,passes_key,tackles_total,yellow_cards,red_cards,clean_sheets,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=excluded.appearances,starts=excluded.starts,minutes=excluded.minutes,goals=excluded.goals,assists=excluded.assists,rating=excluded.rating,shots_total=excluded.shots_total,shots_on=excluded.shots_on,passes_key=excluded.passes_key,tackles_total=excluded.tackles_total,yellow_cards=excluded.yellow_cards,red_cards=excluded.red_cards,clean_sheets=excluded.clean_sheets,source_provider='manual',source_url=excluded.source_url,last_verified_at=excluded.last_verified_at`).run(pid,x.season,x.competition||'Serie A',asInt(x.appearances),asInt(x.starts),asInt(x.minutes),asInt(x.goals),asInt(x.assists),asNum(x.rating),asInt(x.shots_total),asInt(x.shots_on),asInt(x.passes_key),asInt(x.tackles_total),asInt(x.yellow_cards),asInt(x.red_cards),asInt(x.clean_sheets),'manual',nullish(x.source_url),nowIso());recomputeDerivedPlayerStats();res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
api.put('/manual/player-seasons/:id',(req,res)=>{try{const x=req.body??{},pid=resolvePlayerId(x);if(!pid)return res.status(400).json({error:'Giocatore non valido'});db.prepare(`UPDATE player_seasons SET player_id=?,season=?,competition=?,appearances=?,starts=?,minutes=?,goals=?,assists=?,rating=?,shots_total=?,shots_on=?,passes_key=?,tackles_total=?,yellow_cards=?,red_cards=?,clean_sheets=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(pid,x.season,x.competition||'Serie A',asInt(x.appearances),asInt(x.starts),asInt(x.minutes),asInt(x.goals),asInt(x.assists),asNum(x.rating),asInt(x.shots_total),asInt(x.shots_on),asInt(x.passes_key),asInt(x.tackles_total),asInt(x.yellow_cards),asInt(x.red_cards),asInt(x.clean_sheets),nullish(x.source_url),nowIso(),req.params.id);recomputeDerivedPlayerStats();res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
api.delete('/manual/player-seasons/:id',(req,res)=>{try{const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID non valido'});const backup=deleteManualRecord('player-seasons',id);if(!backup)return res.status(404).json({error:'Record non trovato'});recomputeDerivedPlayerStats();res.json({ok:true,backupId:backup.id});}catch(e){res.status(500).json({error:String(e)});}});

api.post('/manual/transfers',(req,res)=>{try{const x=req.body??{};if(!x.player_name)return res.status(400).json({error:'player_name obbligatorio'});const pid=resolvePlayerId(x);const direction=String(x.direction??'').toUpperCase(),movement=String(x.movement_type??'TRANSFER').toUpperCase(),session=String(x.session??'').toUpperCase()||null;if(!['IN','OUT'].includes(direction))return res.status(400).json({error:'direction deve essere IN o OUT'});if(!['TRANSFER','LOAN','RETURN','FREE','RELEASE'].includes(movement))return res.status(400).json({error:'Tipo movimento non valido'});if(session&&!['SUMMER','WINTER'].includes(session))return res.status(400).json({error:'Sessione non valida'});if(x.fee_amount!==''&&x.fee_amount!=null&&(!x.fee_currency||!x.source_url))return res.status(400).json({error:'Costo, valuta e fonte devono essere registrati insieme'});const playerName=String(x.player_name).trim(),date=nullish(x.date),type=nullish(x.type),fromTeam=nullish(x.from_team_name),toTeam=nullish(x.to_team_name),season=nullish(x.season);const existing=db.prepare(`SELECT id FROM transfers WHERE lower(trim(player_name))=lower(trim(?)) AND lower(trim(ifnull(from_team_name,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(to_team_name,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(type,'')))=lower(trim(ifnull(?,''))) AND direction=? AND ifnull(season,'')=ifnull(?, '') LIMIT 1`).get(playerName,fromTeam,toTeam,type,direction,season) as {id:number}|undefined;if(existing)return res.json({ok:true,id:existing.id,deduplicated:true});const key=`manual|${pid??playerName}|${date??''}|${fromTeam??''}|${toTeam??''}|${type??''}|${direction}|${season??''}`;const result=db.prepare(`INSERT INTO transfers(external_key,player_id,player_name,date,type,direction,from_team_name,to_team_name,season,movement_type,session,fee_amount,fee_currency,fee_display,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(key,pid,playerName,date,type,direction,fromTeam,toTeam,season,movement,session,asNum(x.fee_amount),nullish(x.fee_currency),nullish(x.fee_display),'manual',nullish(x.source_url),nowIso());const id=Number(result.lastInsertRowid);recordChange({entityType:'transfers',entityId:id,action:'create',after:db.prepare('SELECT * FROM transfers WHERE id=?').get(id),sourceUrl:nullish(x.source_url),note:'Movimento rosa inserito manualmente'});res.json({ok:true,id});}catch(e){res.status(500).json({error:String(e)});}});
api.put('/manual/transfers/:id',(req,res)=>{try{const x=req.body??{},pid=resolvePlayerId(x),id=asInt(req.params.id);const direction=String(x.direction??'').toUpperCase(),movement=String(x.movement_type??'TRANSFER').toUpperCase(),session=String(x.session??'').toUpperCase()||null;if(id==null)return res.status(400).json({error:'ID non valido'});if(!['IN','OUT'].includes(direction))return res.status(400).json({error:'direction deve essere IN o OUT'});if(!['TRANSFER','LOAN','RETURN','FREE','RELEASE'].includes(movement))return res.status(400).json({error:'Tipo movimento non valido'});if(session&&!['SUMMER','WINTER'].includes(session))return res.status(400).json({error:'Sessione non valida'});if(x.fee_amount!==''&&x.fee_amount!=null&&(!x.fee_currency||!x.source_url))return res.status(400).json({error:'Costo, valuta e fonte devono essere registrati insieme'});const before=db.prepare('SELECT * FROM transfers WHERE id=?').get(id);db.prepare(`UPDATE transfers SET player_id=?,player_name=?,date=?,type=?,direction=?,from_team_name=?,to_team_name=?,season=?,movement_type=?,session=?,fee_amount=?,fee_currency=?,fee_display=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(pid,x.player_name,nullish(x.date),nullish(x.type),direction,nullish(x.from_team_name),nullish(x.to_team_name),nullish(x.season),movement,session,asNum(x.fee_amount),nullish(x.fee_currency),nullish(x.fee_display),nullish(x.source_url),nowIso(),id);recordChange({entityType:'transfers',entityId:id,action:'update',before,after:db.prepare('SELECT * FROM transfers WHERE id=?').get(id),sourceUrl:nullish(x.source_url),note:'Movimento rosa aggiornato manualmente'});res.json({ok:true});}catch(e){res.status(500).json({error:String(e)});}});
api.delete('/manual/transfers/:id',(req,res)=>{try{const id=asInt(req.params.id);if(id==null)return res.status(400).json({error:'ID non valido'});const backup=deleteManualRecord('transfers',id);if(!backup)return res.status(404).json({error:'Record non trovato'});res.json({ok:true,backupId:backup.id});}catch(e){res.status(500).json({error:String(e)});}});

// A conflict is never resolved silently. Choosing a value creates a manual
// override on the affected record, therefore later imports keep the choice.
api.post('/manual/conflicts/:id/resolve',(req,res)=>{try{
  const conflict=db.prepare(`SELECT * FROM data_conflicts WHERE id=?`).get(req.params.id) as any;
  if(!conflict)return res.status(404).json({error:'Conflitto non trovato'});
  const choice=String(req.body?.choice??''); const custom=req.body?.value;
  const note=String(req.body?.note??'').trim();const reviewer=String(req.body?.reviewer??'').trim();
  if(!note||!reviewer)return res.status(400).json({error:'Motivazione e revisore sono obbligatori'});
  const value=choice==='old'?conflict.old_value:choice==='new'?conflict.new_value:choice==='custom'?custom:null;
  if(value==null||!['old','new','custom'].includes(choice))return res.status(400).json({error:'Scegli valore precedente, nuovo o personalizzato'});
  const allowed:{[key:string]:string[]}={match:['date','home_score','away_score'],season:['points','final_position'],player:['name','position']};
  if(!allowed[conflict.entity_type]?.includes(conflict.field))return res.status(400).json({error:'Questo conflitto non è modificabile automaticamente: usa Modifica dati e conserva la fonte.'});
  const tables:{[key:string]:string}={match:'matches',season:'seasons',player:'players'};
  const numeric=['home_score','away_score','points','final_position'].includes(conflict.field)?asNum(value):String(value);
  db.prepare(`UPDATE ${tables[conflict.entity_type]} SET ${conflict.field}=?, source_provider='manual', last_verified_at=? WHERE id=?`).run(numeric,nowIso(),conflict.entity_key);
  const resolvedAt=nowIso();
  db.prepare(`UPDATE data_conflicts SET status='resolved',resolved_value=?,resolved_at=?,resolved_by=?,resolution_note=?,updated_at=? WHERE id=?`).run(String(value),resolvedAt,reviewer,note,resolvedAt,conflict.id);
  recordSourceReference({entityType:tables[conflict.entity_type],entityId:Number(conflict.entity_key),field:conflict.field,sourceUrl:String(req.body?.sourceUrl||`manual://conflict/${conflict.id}`),sourceProvider:'manual',note,author:reviewer,verifiedAt:resolvedAt,originalValue:conflict.old_value,transformation:`conflict:${choice}`});
  recordChange({entityType:conflict.entity_type,entityId:Number(conflict.entity_key),action:'resolve-conflict',before:conflict,after:{value:String(value),choice},sourceUrl:req.body?.sourceUrl??null,note,author:reviewer});
  res.json({ok:true,value});
}catch(e){res.status(500).json({error:String(e)});}});
api.post('/manual/conflicts/:id/reopen',(req,res)=>{try{
  const conflict=db.prepare(`SELECT * FROM data_conflicts WHERE id=?`).get(req.params.id) as any;
  if(!conflict)return res.status(404).json({error:'Conflitto non trovato'});
  if(conflict.status!=='resolved')return res.status(409).json({error:'Solo un conflitto risolto può essere riaperto'});
  const note=String(req.body?.note??'').trim();const reviewer=String(req.body?.reviewer??'').trim();
  if(!note||!reviewer)return res.status(400).json({error:'Motivazione e revisore sono obbligatori'});
  const before={...conflict};const updatedAt=nowIso();
  db.prepare(`UPDATE data_conflicts SET status='open',resolved_value=NULL,resolved_at=NULL,resolved_by=NULL,resolution_note=?,updated_at=? WHERE id=?`).run(`Riaperto da ${reviewer}: ${note}`,updatedAt,conflict.id);
  recordChange({entityType:'data_conflict',entityId:conflict.id,action:'update',before,after:{status:'open'},note,author:reviewer});
  res.json({ok:true,status:'open'});
}catch(e){res.status(500).json({error:String(e)});}});
