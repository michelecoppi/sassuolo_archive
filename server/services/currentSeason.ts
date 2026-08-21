import { db, normalizeTeamName, nowIso, recordChange, recordSourceReference } from '../db/database.js';

const NUMERIC_FIELDS = [
  'home_score','away_score','attendance','possession_home','possession_away','shots_home','shots_away',
  'shots_on_target_home','shots_on_target_away','corners_home','corners_away','fouls_home','fouls_away','xg_home','xg_away',
] as const;

export function normalizeSeason(value: unknown) {
  const raw=String(value??'').trim();
  const match=raw.match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
  if(!match)return raw;
  return `${match[1]}/${match[2].slice(-2)}`;
}

export function currentSeason() {
  const configured=normalizeSeason(process.env.CURRENT_SEASON);
  if(configured)return configured;
  // In produzione una stagione implicita può far scrivere sul campionato
  // sbagliato al cambio d'anno: senza configurazione lavoriamo fail-closed.
  if(String(process.env.NODE_ENV).toLowerCase()==='production')return '';
  return (db.prepare(`SELECT season FROM seasons ORDER BY CAST(substr(season,1,4) AS INTEGER) DESC LIMIT 1`).get() as {season:string}|undefined)?.season??'';
}

export function archiveToday(date=new Date(),timeZone=process.env.ARCHIVE_TIMEZONE?.trim()||'Europe/Rome') {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??'';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

const n=(value:unknown)=>value==null||value===''?null:Number(value);
const i=(value:unknown)=>{const valueNumber=n(value);return valueNumber==null||!Number.isFinite(valueNumber)?null:Math.trunc(valueNumber);};
const text=(value:unknown)=>value==null||String(value).trim()===''?null:String(value).trim();
const isSassuolo=(team:unknown)=>/sassuolo/i.test(String(team??''));
const roundNumber=(round:unknown)=>{const match=String(round??'').match(/\d+/);return match?Number(match[0]):null;};
const safeProviderError=(value:unknown)=>value==null?null:String(value)
  .replace(/((?:api[_-]?key|token|authorization)=)[^&\s]+/gi,'$1[redacted]')
  .replace(/\bBearer\s+[^\s,;]+/gi,'Bearer [redacted]')
  .slice(0,300);

function matchState(match:any, today:string) {
  const hasResult=match.home_score!=null&&match.away_score!=null;
  const partialResult=(match.home_score==null)!==(match.away_score==null);
  if(partialResult)return 'invalid';
  if(hasResult)return match.completeness_level==='BASIC'?'incomplete':'completed';
  return String(match.date).slice(0,10)<=today?'to_complete':'scheduled';
}

function completeness(match:any) {
  const result=match.home_score!=null&&match.away_score!=null;
  const checks=[
    {key:'fixture',label:'Dati essenziali',done:Boolean(match.date&&match.competition&&match.home_team&&match.away_team)},
    {key:'result',label:'Risultato',done:result},
    {key:'halftime',label:'Primo tempo',done:Boolean(match.halftime_score)},
    {key:'venue',label:'Stadio',done:Boolean(match.stadium)},
    {key:'referee',label:'Arbitro',done:Boolean(match.referee)},
    {key:'stats',label:'Statistiche',done:[match.shots_home,match.shots_away,match.corners_home,match.corners_away].some(value=>value!=null)},
    {key:'events',label:'Eventi',done:Number(match.event_count)>0},
    {key:'lineup',label:'Formazioni',done:Number(match.lineup_count)>0},
    {key:'playerStats',label:'Statistiche giocatori',done:Number(match.player_stat_count)>0},
    {key:'ratings',label:'Voti SAR',done:Number(match.archive_rating_count)>0},
  ];
  const relevant=result?checks:checks.filter(item=>['fixture','venue'].includes(item.key));
  const missing=relevant.filter(item=>!item.done);
  return {score:Math.round(relevant.filter(item=>item.done).length/relevant.length*100),checks,nextMissing:missing[0]?.key??null,nextMissingLabel:missing[0]?.label??null};
}

export function getCurrentSeasonDashboard() {
  const season=currentSeason();
  const today=archiveToday();
  const rows=db.prepare(`SELECT m.*,(SELECT COUNT(*) FROM match_events e WHERE e.match_id=m.id) AS event_count,
    (SELECT COUNT(*) FROM match_lineups l WHERE l.match_id=m.id) AS lineup_count,
    (SELECT COUNT(DISTINCT COALESCE(ps.player_id,ps.player_name)) FROM match_player_stats ps WHERE ps.match_id=m.id) AS player_stat_count,
    (SELECT COUNT(*) FROM match_player_stats ar WHERE ar.match_id=m.id AND ar.source_provider='manual-match-stats' AND ar.archive_rating IS NOT NULL) AS archive_rating_count
    FROM matches m WHERE m.season=? ORDER BY m.date,m.id`).all(season) as any[];
  const matches=rows.map(match=>({...match,state:matchState(match,today),completeness:completeness(match)}));
  const seasonRows=db.prepare(`SELECT * FROM seasons WHERE season=? ORDER BY competition`).all(season) as any[];
  const names=[...new Set([...seasonRows.map(row=>row.competition),...matches.map(match=>match.competition)].filter(Boolean))] as string[];
  const competitions=names.map(name=>{
    const items=matches.filter(match=>match.competition===name);
    const metadata=seasonRows.find(row=>row.competition===name);
    const completed=items.filter(match=>match.home_score!=null&&match.away_score!=null).length;
    const actionable=items.find(match=>match.state==='to_complete')??items.find(match=>match.state==='scheduled');
    return {name,total:items.length,expected:metadata?.matches??items.length,completed,scheduled:items.filter(match=>match.state==='scheduled').length,toComplete:items.filter(match=>match.state==='to_complete'||match.state==='invalid').length,nextRound:roundNumber(actionable?.round),nextMatchId:actionable?.id??null};
  });
  const lastUpdated=[...matches].filter(match=>match.last_verified_at||match.home_score!=null).sort((a,b)=>String(b.last_verified_at??b.date).localeCompare(String(a.last_verified_at??a.date)))[0]??null;
  const nextAction=matches.find(match=>match.state==='to_complete'||match.state==='invalid')??matches.find(match=>match.state==='scheduled')??null;
  const completedMatches=matches.filter(match=>match.home_score!=null&&match.away_score!=null&&String(match.date).slice(0,10)<=today).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const upcomingMatches=matches.filter(match=>match.home_score==null&&match.away_score==null&&String(match.date).slice(0,10)>today).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const form=[...completedMatches].slice(0,5).reverse().map(match=>{
    const home=isSassuolo(match.home_team);
    const goalsFor=home?match.home_score:match.away_score;
    const goalsAgainst=home?match.away_score:match.home_score;
    return {matchId:match.id,date:match.date,opponent:home?match.away_team:match.home_team,result:goalsFor>goalsAgainst?'W':goalsFor===goalsAgainst?'D':'L',goalsFor,goalsAgainst};
  });
  const standings=db.prepare(`SELECT * FROM season_standings WHERE season=? ORDER BY competition,group_name,rank`).all(season) as any[];
  const squad=db.prepare(`SELECT p.id,p.name,p.position,p.shirt_number,p.photo_url,p.injured,p.source_provider,p.last_verified_at,
      MAX(ps.appearances) AS appearances,MAX(ps.goals) AS goals,MAX(ps.assists) AS assists
    FROM players p LEFT JOIN player_seasons ps ON ps.player_id=p.id AND ps.season=?
    WHERE p.current_squad=1 GROUP BY p.id ORDER BY CASE p.position WHEN 'Goalkeeper' THEN 1 WHEN 'Defender' THEN 2 WHEN 'Midfielder' THEN 3 WHEN 'Attacker' THEN 4 ELSE 5 END,p.shirt_number,p.name`).all(season) as any[];
  const nextMatch=upcomingMatches[0]??null;
  const injuryRows=nextMatch?db.prepare(`SELECT mi.player_id,mi.player_name,mi.type,mi.reason,mi.start_date,mi.end_date,mi.source_provider
      FROM match_injuries mi WHERE mi.match_id=? AND lower(mi.team_name) LIKE '%sassuolo%' ORDER BY mi.player_name`).all(nextMatch.id) as any[]:[];
  const absenceByPlayer=new Map<string,any>();
  for(const player of squad.filter(player=>player.injured))absenceByPlayer.set(`player:${player.id}`,{playerId:player.id,playerName:player.name,kind:'injury',reason:'Segnalato indisponibile nella rosa',sourceProvider:player.source_provider});
  for(const absence of injuryRows){
    const suspended=/suspend|squal|card/i.test(`${absence.type??''} ${absence.reason??''}`);
    absenceByPlayer.set(absence.player_id?`player:${absence.player_id}`:`name:${String(absence.player_name).toLowerCase()}`,{playerId:absence.player_id??null,playerName:absence.player_name,kind:suspended?'suspension':'injury',reason:absence.reason??absence.type??null,startDate:absence.start_date??null,endDate:absence.end_date??null,sourceProvider:absence.source_provider});
  }
  const providerRows=db.prepare(`SELECT provider,resource,last_request,last_successful_sync,last_error FROM sync_state WHERE provider IN ('api-football','kickoff','football-data','thesportsdb') ORDER BY provider,resource`).all() as any[];
  const latestRuns=db.prepare(`SELECT id,source_provider,status,started_at,finished_at,error_text FROM import_runs WHERE kind='provider_sync' AND area='current-season' ORDER BY id DESC LIMIT 8`).all() as any[];
  const freshness={
    lastSyncAt:[...providerRows.map(row=>row.last_successful_sync),...latestRuns.filter(row=>row.status==='succeeded'||row.status==='partial').map(row=>row.finished_at)].filter(Boolean).sort().at(-1)??null,
    providers:providerRows.map(row=>({provider:row.provider,resource:row.resource,lastRequest:row.last_request,lastSuccess:row.last_successful_sync,lastError:safeProviderError(row.last_error)})),
    recentRuns:latestRuns.map(row=>({id:row.id,provider:row.source_provider,status:row.status,startedAt:row.started_at,finishedAt:row.finished_at,error:safeProviderError(row.error_text)})),
  };
  const opponents=db.prepare(`SELECT name,MAX(stadium) AS stadium FROM (
      SELECT CASE WHEN lower(home_team) LIKE '%sassuolo%' THEN away_team ELSE home_team END AS name,
        CASE WHEN lower(home_team) LIKE '%sassuolo%' THEN NULL ELSE stadium END AS stadium
      FROM matches WHERE lower(home_team) LIKE '%sassuolo%' OR lower(away_team) LIKE '%sassuolo%'
    ) WHERE name IS NOT NULL GROUP BY lower(name) ORDER BY name`).all();
  const stadiums=db.prepare(`SELECT stadium AS name,COUNT(*) AS uses FROM matches WHERE stadium IS NOT NULL AND trim(stadium)<>'' GROUP BY lower(stadium) ORDER BY uses DESC,name LIMIT 100`).all();
  const referees=db.prepare(`SELECT referee AS name,COUNT(*) AS uses FROM matches WHERE referee IS NOT NULL AND trim(referee)<>'' GROUP BY lower(referee) ORDER BY uses DESC,name LIMIT 100`).all();
  return {season,displaySeason:season,generatedAt:nowIso(),today,competitions,matches:[...matches].reverse(),lastUpdated,nextAction,
    latestResult:completedMatches[0]??null,nextMatch,form,standings,squad,absences:[...absenceByPlayer.values()],freshness,
    totals:{inserted:matches.length,completed:matches.filter(match=>match.home_score!=null&&match.away_score!=null).length,scheduled:matches.filter(match=>match.state==='scheduled').length,toComplete:matches.filter(match=>match.state==='to_complete'||match.state==='invalid').length,incomplete:matches.filter(match=>match.state==='incomplete'||match.state==='invalid').length},
    suggestions:{opponents,stadiums,referees,competitions:names.length?names:['Serie A','Coppa Italia']}};
}

export type CurrentMatchPayload=Record<string,unknown>&{forceWarnings?:boolean};

export function validateCurrentMatch(payload:CurrentMatchPayload, editingId?:number) {
  const season=currentSeason();
  const home=normalizeTeamName(String(payload.home_team??''));
  const away=normalizeTeamName(String(payload.away_team??''));
  const competition=String(payload.competition??'').trim();
  const date=String(payload.date??'').trim();
  const errors:string[]=[];const warnings:string[]=[];
  if(!season)errors.push('Configura CURRENT_SEASON prima di inserire una partita.');
  if(!date||Number.isNaN(Date.parse(date)))errors.push('Inserisci una data valida.');
  if(!competition)errors.push('Seleziona la competizione.');
  if(!home||!away)errors.push('Indica casa e trasferta.');
  if(home.toLowerCase()===away.toLowerCase())errors.push('Casa e trasferta non possono coincidere.');
  if(!isSassuolo(home)&&!isSassuolo(away))errors.push('Una partita della stagione corrente deve includere il Sassuolo.');
  if(isSassuolo(home)&&isSassuolo(away))errors.push('Il Sassuolo non può essere entrambe le squadre.');
  const fieldLabels:Record<string,string>={home_score:'gol casa',away_score:'gol trasferta',attendance:'spettatori',possession_home:'possesso casa',possession_away:'possesso trasferta',shots_home:'tiri casa',shots_away:'tiri trasferta',shots_on_target_home:'tiri in porta casa',shots_on_target_away:'tiri in porta trasferta',corners_home:'corner casa',corners_away:'corner trasferta',fouls_home:'falli casa',fouls_away:'falli trasferta',xg_home:'xG casa',xg_away:'xG trasferta'};
  for(const field of NUMERIC_FIELDS){const value=n(payload[field]);if(value!=null&&(!Number.isFinite(value)||value<0))errors.push(`Il campo “${fieldLabels[field]}” non può essere negativo.`);}
  const hs=i(payload.home_score),as=i(payload.away_score);
  if((hs==null)!==(as==null))errors.push('Inserisci entrambi i gol del risultato finale, oppure lascia entrambi vuoti.');
  const ht=text(payload.halftime_score);
  if(ht){const parsed=ht.match(/^(\d+)\s*[-–]\s*(\d+)$/);if(!parsed)errors.push('Il risultato del primo tempo deve avere il formato 1-0.');else if(hs!=null&&as!=null&&(Number(parsed[1])>hs||Number(parsed[2])>as))errors.push('Il risultato del primo tempo non può superare quello finale.');}
  if(i(payload.shots_on_target_home)!=null&&i(payload.shots_home)!=null&&i(payload.shots_on_target_home)!>i(payload.shots_home)!)errors.push('I tiri in porta della squadra di casa non possono superare i tiri totali.');
  if(i(payload.shots_on_target_away)!=null&&i(payload.shots_away)!=null&&i(payload.shots_on_target_away)!>i(payload.shots_away)!)errors.push('I tiri in porta della squadra in trasferta non possono superare i tiri totali.');
  const sourceUrl=text(payload.source_url);
  if(sourceUrl){try{const parsed=new URL(sourceUrl);if(!['http:','https:'].includes(parsed.protocol))errors.push('La fonte deve usare http o https.');}catch{errors.push('Inserisci un URL fonte valido.');}}
  const duplicate=date&&home&&away?db.prepare(`SELECT id,date,competition,round,home_team,away_team,home_score,away_score FROM matches WHERE substr(date,1,10)=substr(?,1,10) AND lower(home_team)=lower(?) AND lower(away_team)=lower(?) AND id<>? LIMIT 1`).get(date,home,away,editingId??-1) as any:null;
  if(duplicate)errors.push('Esiste già una partita con la stessa data, squadra di casa e squadra in trasferta.');
  const round=roundNumber(payload.round);
  if(round&&competition){const priorRounds=db.prepare(`SELECT round FROM matches WHERE season=? AND competition=? AND id<>?`).all(season,competition,editingId??-1) as {round:unknown}[];const previous=priorRounds.some(item=>roundNumber(item.round)===round-1);if(round>1&&!previous)warnings.push(`La giornata ${round-1} non risulta presente. Potrebbe trattarsi di un recupero o di una partita rinviata.`);}
  return {valid:errors.length===0,errors,warnings,duplicate,normalized:{...payload,season,competition,date,home_team:home,away_team:away}};
}

export function saveCurrentMatch(payload:CurrentMatchPayload, editingId?:number,author?:string|null) {
  const validation=validateCurrentMatch(payload,editingId);
  if(!validation.valid||validation.warnings.length&&!payload.forceWarnings)return validation;
  const x=validation.normalized as any;
  const values=[x.date,x.season,x.competition,text(x.round),x.home_team,x.away_team,i(x.home_score),i(x.away_score),text(x.halftime_score),text(x.stadium),i(x.attendance),text(x.referee),n(x.possession_home),n(x.possession_away),i(x.shots_home),i(x.shots_away),i(x.shots_on_target_home),i(x.shots_on_target_away),i(x.corners_home),i(x.corners_away),i(x.fouls_home),i(x.fouls_away),n(x.xg_home),n(x.xg_away),text(x.source_url),nowIso()];
  if(editingId){
    const before=db.prepare(`SELECT * FROM matches WHERE id=? AND season=?`).get(editingId,currentSeason()) as any;
    if(!before)return {valid:false,errors:['Partita della stagione corrente non trovata.'],warnings:[]};
    db.prepare(`UPDATE matches SET date=?,season=?,competition=?,round=?,home_team=?,away_team=?,home_score=?,away_score=?,halftime_score=?,stadium=?,attendance=?,referee=?,possession_home=?,possession_away=?,shots_home=?,shots_away=?,shots_on_target_home=?,shots_on_target_away=?,corners_home=?,corners_away=?,fouls_home=?,fouls_away=?,xg_home=?,xg_away=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(...values,editingId);
    const after=db.prepare(`SELECT * FROM matches WHERE id=?`).get(editingId);
    recordChange({entityType:'matches',entityId:editingId,action:'update',before,after,sourceUrl:text(x.source_url),note:'Aggiornamento dalla gestione stagione corrente',author});
    if(text(x.source_url))recordSourceReference({entityType:'matches',entityId:editingId,field:'record',sourceUrl:String(x.source_url),sourceProvider:'manual',author:author??undefined,note:'Fonte dichiarata per l’aggiornamento della partita'});
    return {valid:true,errors:[],warnings:validation.warnings,id:editingId,created:false};
  }
  const key=`manual|${x.season}|${x.date}|${x.home_team}|${x.away_team}|${x.competition}`;
  const result=db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,halftime_score,stadium,attendance,referee,possession_home,possession_away,shots_home,shots_away,shots_on_target_home,shots_on_target_away,corners_home,corners_away,fouls_home,fouls_away,xg_home,xg_away,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(key,...values.slice(0,24),'manual',values[24],values[25]);
  const id=Number(result.lastInsertRowid),after=db.prepare(`SELECT * FROM matches WHERE id=?`).get(id);
  recordChange({entityType:'matches',entityId:id,action:'create',after,sourceUrl:text(x.source_url),note:'Creazione dalla gestione stagione corrente',author});
  if(text(x.source_url))recordSourceReference({entityType:'matches',entityId:id,field:'record',sourceUrl:String(x.source_url),sourceProvider:'manual',author:author??undefined,note:'Fonte dichiarata per la partita'});
  return {valid:true,errors:[],warnings:validation.warnings,id,created:true};
}
