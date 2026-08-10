import { db, initDb, normalizeTeamName, nowIso } from '../server/db/database.js';

initDb();
const club='U.S. Sassuolo Calcio';
const rows=db.prepare(`SELECT season,competition,date,home_team,away_team,home_score,away_score,source_provider,source_url FROM matches WHERE season IS NOT NULL AND competition IS NOT NULL AND home_score IS NOT NULL AND away_score IS NOT NULL ORDER BY season,competition,date`).all() as any[];
const groups=new Map<string,any[]>();
for(const row of rows){if(![normalizeTeamName(row.home_team),normalizeTeamName(row.away_team)].includes(club))continue;const key=`${row.season}\u0000${row.competition}`;groups.set(key,[...(groups.get(key)??[]),row]);}
const upsert=db.prepare(`INSERT INTO seasons(season,competition,matches,wins,draws,losses,goals_for,goals_against,points,home_record,away_record,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(season,competition) DO UPDATE SET matches=excluded.matches,wins=excluded.wins,draws=excluded.draws,losses=excluded.losses,goals_for=excluded.goals_for,goals_against=excluded.goals_against,points=excluded.points,home_record=excluded.home_record,away_record=excluded.away_record,source_provider=COALESCE(seasons.source_provider,excluded.source_provider),source_url=COALESCE(seasons.source_url,excluded.source_url),last_verified_at=excluded.last_verified_at WHERE COALESCE(seasons.source_provider,'') <> 'manual'`);
let reconciled=0;
for(const [key,matches] of groups){const [season,competition]=key.split('\u0000');let wins=0,draws=0,losses=0,gf=0,ga=0,hw=0,hd=0,hl=0,aw=0,ad=0,al=0;for(const m of matches){const home=normalizeTeamName(m.home_team)===club;const f=home?m.home_score:m.away_score;const a=home?m.away_score:m.home_score;gf+=f;ga+=a;const result=f>a?'W':f<a?'L':'D';if(result==='W')wins++;else if(result==='D')draws++;else losses++;if(home){if(result==='W')hw++;else if(result==='D')hd++;else hl++;}else{if(result==='W')aw++;else if(result==='D')ad++;else al++;}}
  const source=matches.find(m=>m.source_url)||matches[0];upsert.run(season,competition,matches.length,wins,draws,losses,gf,ga,wins*3+draws,`${hw}-${hd}-${hl}`,`${aw}-${ad}-${al}`,source.source_provider??'reconciliation',source.source_url??null,nowIso());reconciled++;
}
console.log(`Riconciliate ${reconciled} stagioni/competizioni da ${rows.length} partite.`);
