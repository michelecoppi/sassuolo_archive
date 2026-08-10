import fs from 'node:fs';
import path from 'node:path';
import { db, normalizePlayerName, normalizeTeamName, nowIso, recordFixtureConflicts } from '../db/database.js';
import { resolvePlayer as resolveCanonicalPlayer, seedHistoricalPlayerAliases } from './playerResolver.js';

function scalar(v:any){ return v === '' || v === undefined ? null : v; }
function int(v:any){ const n=Number(v); return v==null||v===''||Number.isNaN(n)?null:Math.trunc(n); }
function num(v:any){ const n=Number(v); return v==null||v===''||Number.isNaN(n)?null:n; }
function flag(v:any){ return v===true||v===1||v==='1'||String(v??'').toLowerCase()==='true'||String(v??'').toLowerCase()==='yes'?1:0; }

// Historical files often contain initials while the canonical player row has
// the full name. Resolve only unambiguous matches; never guess between two
// players sharing a surname.
function canonicalPlayerName(name:string){
  const value=normalizePlayerName(name);
  const m=value.match(/^([A-ZÀ-ÖØ-Þ])\.\s+(.+)$/i);
  if(!m)return value;
  const surname=m[2].toLocaleLowerCase('it-IT');
  const candidates=db.prepare('SELECT name FROM players WHERE lower(name) LIKE ?').all(`% ${surname}`) as {name:string}[];
  const matches=candidates.filter(x=>x.name.split(/\s+/)[0]?.[0]?.toLocaleUpperCase('it-IT')===m[1].toLocaleUpperCase('it-IT'));
  return matches.length===1?matches[0].name:value;
}

function parseCsv(text:string){
  let lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
  if(!lines.length) return [];
  const parse=(line:string)=>{const out:string[]=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;};
  // Some exported football tables contain a grouping row before the real header.
  const known=new Set(['season','date','name','player_name','Player','HomeTeam','Team 1']);
  const headerIndex=Math.max(0,lines.slice(0,6).findIndex(line=>parse(line).some(h=>known.has(h.trim()))));
  lines=lines.slice(headerIndex);
  const headers=parse(lines[0]).map(x=>x.trim());
  return lines.slice(1).map(line=>Object.fromEntries(parse(line).map((v,i)=>[headers[i],v])));
}

function loadDir(dir:string){
  if(!fs.existsSync(dir)) return [];
  const rows:any[]=[];
  for(const file of fs.readdirSync(dir)){
    const p=path.join(dir,file); if(!fs.statSync(p).isFile())continue;
    if(file.endsWith('.json')){ const x=JSON.parse(fs.readFileSync(p,'utf8')); rows.push(...(Array.isArray(x)?x:[x])); }
    if(file.endsWith('.csv')) rows.push(...parseCsv(fs.readFileSync(p,'utf8')));
  }
  return rows;
}

export function recomputeDerivedPlayerStats(){
  const players=db.prepare(`SELECT id FROM players`).all() as {id:number}[];
  const q=db.prepare(`SELECT MIN(season) first_season, MAX(season) last_season,
    CASE WHEN COUNT(appearances)>0 THEN SUM(appearances) END appearances,
    CASE WHEN COUNT(starts)>0 THEN SUM(starts) END starts,
    CASE WHEN COUNT(minutes)>0 THEN SUM(minutes) END minutes,
    CASE WHEN COUNT(goals)>0 THEN SUM(goals) END goals,
    CASE WHEN COUNT(own_goals)>0 THEN SUM(own_goals) END own_goals,
    CASE WHEN COUNT(assists)>0 THEN SUM(assists) END assists,
    CASE WHEN COUNT(yellow_cards)>0 THEN SUM(yellow_cards) END yellow_cards,
    CASE WHEN COUNT(red_cards)>0 THEN SUM(red_cards) END red_cards,
    CASE WHEN COUNT(clean_sheets)>0 THEN SUM(clean_sheets) END clean_sheets
    FROM player_seasons WHERE player_id=?`);
  const u=db.prepare(`UPDATE players SET appearances=?,starts=?,minutes=?,goals=?,own_goals=?,assists=?,yellow_cards=?,red_cards=?,clean_sheets=? WHERE id=?`);
  for(const p of players){const x=q.get(p.id) as any;if(x?.first_season)u.run(x.appearances,x.starts,x.minutes,x.goals,x.own_goals,x.assists,x.yellow_cards,x.red_cards,x.clean_sheets,p.id);}
  const seasons=db.prepare(`SELECT DISTINCT season,competition FROM player_seasons`).all() as any[];
  const leader=db.prepare(`SELECT p.name,ps.goals,ps.assists FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition=? ORDER BY COALESCE(ps.goals,-1) DESC, p.name LIMIT 1`);
  const assist=db.prepare(`SELECT p.name,ps.assists FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ps.season=? AND ps.competition=? ORDER BY COALESCE(ps.assists,-1) DESC, p.name LIMIT 1`);
  const update=db.prepare(`UPDATE seasons SET top_scorer=COALESCE(?,top_scorer), top_assists=COALESCE(?,top_assists) WHERE season=? AND competition=?`);
  for(const s of seasons){const g=leader.get(s.season,s.competition) as any,a=assist.get(s.season,s.competition) as any;update.run(g&&g.goals!=null?`${g.name} (${g.goals})`:null,a&&a.assists!=null?`${a.name} (${a.assists})`:null,s.season,s.competition);}
}

export function importAll(options: { base?: string } = {}){
  const base=options.base ?? path.resolve('data');
  const seasons=loadDir(path.join(base,'seasons'));
  const matches=loadDir(path.join(base,'matches'));
  const players=loadDir(path.join(base,'players'));
  const playerSeasons=loadDir(path.join(base,'player-seasons'));

  const seasonStmt=db.prepare(`INSERT INTO seasons(season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,manager,stadium,top_scorer,top_assists,home_record,away_record,source_provider,source_url,last_verified_at)
    VALUES(@season,@competition,@final_position,@matches,@wins,@draws,@losses,@goals_for,@goals_against,@points,@manager,@stadium,@top_scorer,@top_assists,@home_record,@away_record,@source_provider,@source_url,@last_verified_at)
    ON CONFLICT(season,competition) DO UPDATE SET final_position=COALESCE(excluded.final_position,seasons.final_position),matches=COALESCE(excluded.matches,seasons.matches),wins=COALESCE(excluded.wins,seasons.wins),draws=COALESCE(excluded.draws,seasons.draws),losses=COALESCE(excluded.losses,seasons.losses),goals_for=COALESCE(excluded.goals_for,seasons.goals_for),goals_against=COALESCE(excluded.goals_against,seasons.goals_against),points=COALESCE(excluded.points,seasons.points),manager=COALESCE(excluded.manager,seasons.manager),stadium=COALESCE(excluded.stadium,seasons.stadium),top_scorer=COALESCE(excluded.top_scorer,seasons.top_scorer),top_assists=COALESCE(excluded.top_assists,seasons.top_assists),home_record=COALESCE(excluded.home_record,seasons.home_record),away_record=COALESCE(excluded.away_record,seasons.away_record),source_provider=COALESCE(excluded.source_provider,seasons.source_provider),source_url=COALESCE(excluded.source_url,seasons.source_url),last_verified_at=excluded.last_verified_at WHERE COALESCE(seasons.source_provider,'') <> 'manual'`);

  for(const s of seasons) if(s.season) seasonStmt.run({season:s.season,competition:s.competition||'Serie A',final_position:int(s.final_position??s.finalPosition),matches:int(s.matches),wins:int(s.wins),draws:int(s.draws),losses:int(s.losses),goals_for:int(s.goals_for??s.goalsFor),goals_against:int(s.goals_against??s.goalsAgainst),points:int(s.points),manager:scalar(s.manager),stadium:scalar(s.stadium),top_scorer:scalar(s.top_scorer??s.topScorer),top_assists:scalar(s.top_assists??s.topAssists),home_record:scalar(s.home_record??s.homeRecord),away_record:scalar(s.away_record??s.awayRecord),source_provider:scalar(s.source_provider??s.sourceProvider??'local-import'),source_url:scalar(s.source_url??s.sourceUrl),last_verified_at:nowIso()});

  const matchStmt=db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,halftime_score,scorers,assists,cards,stadium,attendance,referee,possession_home,possession_away,shots_home,shots_away,shots_on_target_home,shots_on_target_away,corners_home,corners_away,fouls_home,fouls_away,xg_home,xg_away,completeness_level,source_provider,source_external_id,source_url,last_verified_at)
    VALUES(@external_key,@date,@season,@competition,@round,@home_team,@away_team,@home_score,@away_score,@halftime_score,@scorers,@assists,@cards,@stadium,@attendance,@referee,@possession_home,@possession_away,@shots_home,@shots_away,@shots_on_target_home,@shots_on_target_away,@corners_home,@corners_away,@fouls_home,@fouls_away,@xg_home,@xg_away,@completeness_level,@source_provider,@source_external_id,@source_url,@last_verified_at)
    ON CONFLICT(external_key) DO UPDATE SET home_score=COALESCE(excluded.home_score,matches.home_score),away_score=COALESCE(excluded.away_score,matches.away_score),halftime_score=COALESCE(excluded.halftime_score,matches.halftime_score),round=COALESCE(excluded.round,matches.round),scorers=COALESCE(excluded.scorers,matches.scorers),assists=COALESCE(excluded.assists,matches.assists),cards=COALESCE(excluded.cards,matches.cards),stadium=COALESCE(excluded.stadium,matches.stadium),attendance=COALESCE(excluded.attendance,matches.attendance),referee=COALESCE(excluded.referee,matches.referee),possession_home=COALESCE(excluded.possession_home,matches.possession_home),possession_away=COALESCE(excluded.possession_away,matches.possession_away),shots_home=COALESCE(excluded.shots_home,matches.shots_home),shots_away=COALESCE(excluded.shots_away,matches.shots_away),shots_on_target_home=COALESCE(excluded.shots_on_target_home,matches.shots_on_target_home),shots_on_target_away=COALESCE(excluded.shots_on_target_away,matches.shots_on_target_away),corners_home=COALESCE(excluded.corners_home,matches.corners_home),corners_away=COALESCE(excluded.corners_away,matches.corners_away),fouls_home=COALESCE(excluded.fouls_home,matches.fouls_home),fouls_away=COALESCE(excluded.fouls_away,matches.fouls_away),xg_home=COALESCE(excluded.xg_home,matches.xg_home),xg_away=COALESCE(excluded.xg_away,matches.xg_away),completeness_level=CASE WHEN excluded.completeness_level='DETAILED' OR matches.completeness_level='DETAILED' THEN 'DETAILED' WHEN excluded.completeness_level='STANDARD' OR matches.completeness_level='STANDARD' THEN 'STANDARD' ELSE 'BASIC' END,source_provider=COALESCE(excluded.source_provider,matches.source_provider),source_url=COALESCE(excluded.source_url,matches.source_url),last_verified_at=excluded.last_verified_at WHERE COALESCE(matches.source_provider,'') <> 'manual'`);
  // A provider-specific external key alone is not enough: the same fixture can
  // arrive from KickoffAPI and Football-Data with different keys. Do not add a
  // second match when date and both normalized clubs already identify one.
  const matchByIdentity=db.prepare(`SELECT id,external_key,date,home_team,away_team,home_score,away_score,source_provider FROM matches WHERE substr(date,1,10)=substr(?,1,10)`);
  for(const m of matches){ if(!m.date||(!m.home_team&&!m.homeTeam)||(!m.away_team&&!m.awayTeam)) continue; const home=normalizeTeamName(m.home_team??m.homeTeam), away=normalizeTeamName(m.away_team??m.awayTeam); const key=m.external_key??m.externalKey??`${m.date}|${home}|${away}|${m.competition??''}`;
    const sameFixture=(matchByIdentity.all(m.date) as {id:number;external_key:string;date:string;home_team:string;away_team:string;home_score:number|null;away_score:number|null;source_provider:string|null}[]).find(x=>normalizeTeamName(x.home_team)===home&&normalizeTeamName(x.away_team)===away);
    const homeScore=int(m.home_score??m.homeScore),awayScore=int(m.away_score??m.awayScore), provider=String(m.source_provider??m.sourceProvider??'local-import');
    if(sameFixture&&sameFixture.external_key!==key) { recordFixtureConflicts(sameFixture,{date:m.date,home_score:homeScore,away_score:awayScore},provider); continue; }
    const level=String(m.completeness_level??m.completenessLevel??'').toUpperCase();
    const inferredLevel=level==='DETAILED'||level==='STANDARD'||level==='BASIC'?level:(m.halftime_score??m.halftimeScore??m.cards??m.referee??m.shots_home??m.shotsHome??m.possession_home??m.possessionHome)?'STANDARD':'BASIC';
    matchStmt.run({external_key:key,date:m.date,season:scalar(m.season),competition:scalar(m.competition),round:scalar(m.round),home_team:home,away_team:away,home_score:homeScore,away_score:awayScore,halftime_score:scalar(m.halftime_score??m.halftimeScore),scorers:typeof m.scorers==='object'?JSON.stringify(m.scorers):scalar(m.scorers),assists:typeof m.assists==='object'?JSON.stringify(m.assists):scalar(m.assists),cards:typeof m.cards==='object'?JSON.stringify(m.cards):scalar(m.cards),stadium:scalar(m.stadium),attendance:int(m.attendance),referee:scalar(m.referee),possession_home:num(m.possession_home??m.possessionHome),possession_away:num(m.possession_away??m.possessionAway),shots_home:int(m.shots_home??m.shotsHome),shots_away:int(m.shots_away??m.shotsAway),shots_on_target_home:int(m.shots_on_target_home??m.shotsOnTargetHome),shots_on_target_away:int(m.shots_on_target_away??m.shotsOnTargetAway),corners_home:int(m.corners_home??m.cornersHome),corners_away:int(m.corners_away??m.cornersAway),fouls_home:int(m.fouls_home??m.foulsHome),fouls_away:int(m.fouls_away??m.foulsAway),xg_home:num(m.xg_home??m.xgHome),xg_away:num(m.xg_away??m.xgAway),completeness_level:inferredLevel,source_provider:provider,source_external_id:scalar(m.source_external_id??m.sourceExternalId),source_url:scalar(m.source_url??m.sourceUrl),last_verified_at:nowIso()}); }

  const playerStmt=db.prepare(`INSERT INTO players(name,nationality,birth_date,position,shirt_number,first_appearance,last_appearance,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,clean_sheets,current_squad,source_provider,source_external_id,source_url,last_verified_at)
    VALUES(@name,@nationality,@birth_date,@position,@shirt_number,@first_appearance,@last_appearance,@appearances,@starts,@minutes,@goals,@assists,@yellow_cards,@red_cards,@clean_sheets,@current_squad,@source_provider,@source_external_id,@source_url,@last_verified_at)
    ON CONFLICT(name) DO UPDATE SET nationality=COALESCE(excluded.nationality,players.nationality),birth_date=COALESCE(excluded.birth_date,players.birth_date),position=COALESCE(excluded.position,players.position),shirt_number=COALESCE(excluded.shirt_number,players.shirt_number),appearances=COALESCE(excluded.appearances,players.appearances),goals=COALESCE(excluded.goals,players.goals),assists=COALESCE(excluded.assists,players.assists),minutes=COALESCE(excluded.minutes,players.minutes),current_squad=MAX(players.current_squad,excluded.current_squad),source_url=COALESCE(excluded.source_url,players.source_url),last_verified_at=excluded.last_verified_at WHERE COALESCE(players.source_provider,'') <> 'manual'`);
  const findPlayerBySource=db.prepare(`SELECT player_id AS id FROM player_source_ids WHERE source_provider=? AND source_player_id=?`);
  const savePlayerSource=db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at) VALUES(?,?,?,?,?) ON CONFLICT(source_provider,source_player_id) DO UPDATE SET source_url=COALESCE(excluded.source_url,player_source_ids.source_url),last_verified_at=excluded.last_verified_at`);
  const findPlayer=db.prepare(`SELECT id FROM players WHERE lower(name)=lower(?)`);
  for(const p of players) if(p.name){
    p.name=canonicalPlayerName(p.name);
    const provider=String(p.source_provider??p.sourceProvider??'local-import'); const sourceId=p.source_external_id??p.sourceExternalId??p.api_football_id??p.apiFootballId;
    const existing=sourceId?findPlayerBySource.get(provider,String(sourceId)) as {id:number}|undefined:undefined;
    if(existing){
      db.prepare(`UPDATE players SET nationality=COALESCE(?,nationality),birth_date=COALESCE(?,birth_date),position=COALESCE(?,position),source_url=COALESCE(?,source_url),last_verified_at=? WHERE id=?`).run(scalar(p.nationality),scalar(p.birth_date??p.birthDate),scalar(p.position),scalar(p.source_url??p.sourceUrl),nowIso(),existing.id);
      savePlayerSource.run(existing.id,provider,String(sourceId),scalar(p.source_url??p.sourceUrl),nowIso());
      continue;
    }
    playerStmt.run({name:p.name,nationality:scalar(p.nationality),birth_date:scalar(p.birth_date??p.birthDate),position:scalar(p.position),shirt_number:int(p.shirt_number??p.shirtNumber),first_appearance:scalar(p.first_appearance??p.firstAppearance),last_appearance:scalar(p.last_appearance??p.lastAppearance),appearances:int(p.appearances),starts:int(p.starts),minutes:int(p.minutes),goals:int(p.goals),assists:int(p.assists),yellow_cards:int(p.yellow_cards??p.yellowCards),red_cards:int(p.red_cards??p.redCards),clean_sheets:int(p.clean_sheets??p.cleanSheets),current_squad:flag(p.current_squad??p.currentSquad),source_provider:provider,source_external_id:scalar(sourceId),source_url:scalar(p.source_url??p.sourceUrl),last_verified_at:nowIso()});
    const saved=findPlayer.get(p.name) as {id:number}|undefined; if(saved&&sourceId!=null)savePlayerSource.run(saved.id,provider,String(sourceId),scalar(p.source_url??p.sourceUrl),nowIso());
  }
  seedHistoricalPlayerAliases();
  const psStmt=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,clean_sheets,source_provider,source_url,last_verified_at)
    VALUES(@player_id,@season,@competition,@appearances,@starts,@minutes,@goals,@assists,@yellow_cards,@red_cards,@clean_sheets,@source_provider,@source_url,@last_verified_at)
    ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=COALESCE(excluded.appearances,player_seasons.appearances),starts=COALESCE(excluded.starts,player_seasons.starts),minutes=COALESCE(excluded.minutes,player_seasons.minutes),goals=COALESCE(excluded.goals,player_seasons.goals),assists=COALESCE(excluded.assists,player_seasons.assists),yellow_cards=COALESCE(excluded.yellow_cards,player_seasons.yellow_cards),red_cards=COALESCE(excluded.red_cards,player_seasons.red_cards),clean_sheets=COALESCE(excluded.clean_sheets,player_seasons.clean_sheets),source_provider=COALESCE(excluded.source_provider,player_seasons.source_provider),source_url=COALESCE(excluded.source_url,player_seasons.source_url),last_verified_at=excluded.last_verified_at WHERE COALESCE(player_seasons.source_provider,'') <> 'manual'`);
  for(const p of playerSeasons){const name=p.player_name??p.playerName??p.name??p.Player;if(!name||!p.season)continue;const provider=String(p.source_provider??p.sourceProvider??'local-import');const sourceUrl=scalar(p.source_url??p.sourceUrl);const player=resolveCanonicalPlayer({name:canonicalPlayerName(name),sourceProvider:provider,sourcePlayerId:p.source_external_id??p.sourceExternalId??p.player_id??p.playerId,sourceUrl,context:`player-season:${p.season}:${p.competition||'Serie A'}`,allowCreate:false});if(player.status==='conflict')continue;psStmt.run({player_id:player.playerId,season:p.season,competition:p.competition||'Serie A',appearances:int(p.appearances??p.MP),starts:int(p.starts??p.Starts),minutes:int(String(p.minutes??p.Min??'').replace(/,/g,'')),goals:int(p.goals??p.Gls),assists:int(p.assists??p.Ast),yellow_cards:int(p.yellow_cards??p.CrdY),red_cards:int(p.red_cards??p.CrdR),clean_sheets:int(p.clean_sheets??p.CS),source_provider:provider,source_url:sourceUrl,last_verified_at:nowIso()});}
  if(playerSeasons.length)recomputeDerivedPlayerStats();
  return {seasons:seasons.length,matches:matches.length,players:players.length,playerSeasons:playerSeasons.length};
}
