import { db, normalizeTeamName, nowIso, recordChange } from '../db/database.js';

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
  return (db.prepare(`SELECT season FROM seasons ORDER BY CAST(substr(season,1,4) AS INTEGER) DESC LIMIT 1`).get() as {season:string}|undefined)?.season??'';
}

const n=(value:unknown)=>value==null||value===''?null:Number(value);
const i=(value:unknown)=>{const valueNumber=n(value);return valueNumber==null||!Number.isFinite(valueNumber)?null:Math.trunc(valueNumber);};
const text=(value:unknown)=>value==null||String(value).trim()===''?null:String(value).trim();
const isSassuolo=(team:unknown)=>/sassuolo/i.test(String(team??''));
const roundNumber=(round:unknown)=>{const match=String(round??'').match(/\d+/);return match?Number(match[0]):null;};

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
  ];
  const relevant=result?checks:checks.filter(item=>['fixture','venue'].includes(item.key));
  return {score:Math.round(relevant.filter(item=>item.done).length/relevant.length*100),checks};
}

export function getCurrentSeasonDashboard() {
  const season=currentSeason();
  const today=new Date().toISOString().slice(0,10);
  const rows=db.prepare(`SELECT m.*,(SELECT COUNT(*) FROM match_events e WHERE e.match_id=m.id) AS event_count,
    (SELECT COUNT(*) FROM match_lineups l WHERE l.match_id=m.id) AS lineup_count
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
  const opponents=db.prepare(`SELECT name,MAX(stadium) AS stadium FROM (
      SELECT CASE WHEN lower(home_team) LIKE '%sassuolo%' THEN away_team ELSE home_team END AS name,
        CASE WHEN lower(home_team) LIKE '%sassuolo%' THEN NULL ELSE stadium END AS stadium
      FROM matches WHERE lower(home_team) LIKE '%sassuolo%' OR lower(away_team) LIKE '%sassuolo%'
    ) WHERE name IS NOT NULL GROUP BY lower(name) ORDER BY name`).all();
  const stadiums=db.prepare(`SELECT stadium AS name,COUNT(*) AS uses FROM matches WHERE stadium IS NOT NULL AND trim(stadium)<>'' GROUP BY lower(stadium) ORDER BY uses DESC,name LIMIT 100`).all();
  const referees=db.prepare(`SELECT referee AS name,COUNT(*) AS uses FROM matches WHERE referee IS NOT NULL AND trim(referee)<>'' GROUP BY lower(referee) ORDER BY uses DESC,name LIMIT 100`).all();
  return {season,displaySeason:season,generatedAt:nowIso(),today,competitions,matches:[...matches].reverse(),lastUpdated,nextAction,
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
  const duplicate=date&&home&&away?db.prepare(`SELECT id,date,competition,round,home_team,away_team,home_score,away_score FROM matches WHERE substr(date,1,10)=substr(?,1,10) AND lower(home_team)=lower(?) AND lower(away_team)=lower(?) AND id<>? LIMIT 1`).get(date,home,away,editingId??-1) as any:null;
  if(duplicate)errors.push('Esiste già una partita con la stessa data, squadra di casa e squadra in trasferta.');
  const round=roundNumber(payload.round);
  if(round&&competition){const previous=db.prepare(`SELECT 1 FROM matches WHERE season=? AND competition=? AND CAST(round AS INTEGER)=? AND id<>? LIMIT 1`).get(season,competition,round-1,editingId??-1);if(round>1&&!previous)warnings.push(`La giornata ${round-1} non risulta presente. Potrebbe trattarsi di un recupero o di una partita rinviata.`);}
  return {valid:errors.length===0,errors,warnings,duplicate,normalized:{...payload,season,competition,date,home_team:home,away_team:away}};
}

export function saveCurrentMatch(payload:CurrentMatchPayload, editingId?:number) {
  const validation=validateCurrentMatch(payload,editingId);
  if(!validation.valid||validation.warnings.length&&!payload.forceWarnings)return validation;
  const x=validation.normalized as any;
  const values=[x.date,x.season,x.competition,text(x.round),x.home_team,x.away_team,i(x.home_score),i(x.away_score),text(x.halftime_score),text(x.stadium),i(x.attendance),text(x.referee),n(x.possession_home),n(x.possession_away),i(x.shots_home),i(x.shots_away),i(x.shots_on_target_home),i(x.shots_on_target_away),i(x.corners_home),i(x.corners_away),i(x.fouls_home),i(x.fouls_away),n(x.xg_home),n(x.xg_away),text(x.source_url),nowIso()];
  if(editingId){
    const before=db.prepare(`SELECT * FROM matches WHERE id=? AND season=?`).get(editingId,currentSeason()) as any;
    if(!before)return {valid:false,errors:['Partita della stagione corrente non trovata.'],warnings:[]};
    db.prepare(`UPDATE matches SET date=?,season=?,competition=?,round=?,home_team=?,away_team=?,home_score=?,away_score=?,halftime_score=?,stadium=?,attendance=?,referee=?,possession_home=?,possession_away=?,shots_home=?,shots_away=?,shots_on_target_home=?,shots_on_target_away=?,corners_home=?,corners_away=?,fouls_home=?,fouls_away=?,xg_home=?,xg_away=?,source_provider='manual',source_url=?,last_verified_at=? WHERE id=?`).run(...values,editingId);
    const after=db.prepare(`SELECT * FROM matches WHERE id=?`).get(editingId);
    recordChange({entityType:'matches',entityId:editingId,action:'update',before,after,sourceUrl:text(x.source_url),note:'Aggiornamento dalla gestione stagione corrente'});
    return {valid:true,errors:[],warnings:validation.warnings,id:editingId,created:false};
  }
  const key=`manual|${x.season}|${x.date}|${x.home_team}|${x.away_team}|${x.competition}`;
  const result=db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,halftime_score,stadium,attendance,referee,possession_home,possession_away,shots_home,shots_away,shots_on_target_home,shots_on_target_away,corners_home,corners_away,fouls_home,fouls_away,xg_home,xg_away,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(key,...values.slice(0,24),'manual',values[24],values[25]);
  const id=Number(result.lastInsertRowid),after=db.prepare(`SELECT * FROM matches WHERE id=?`).get(id);
  recordChange({entityType:'matches',entityId:id,action:'create',after,sourceUrl:text(x.source_url),note:'Creazione dalla gestione stagione corrente'});
  return {valid:true,errors:[],warnings:validation.warnings,id,created:true};
}
