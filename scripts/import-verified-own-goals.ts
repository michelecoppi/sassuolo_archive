import { createBackupSnapshot, db, initDb, nowIso, recordChange, recordSourceReference } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';

type OwnGoal={date:string;season:string;competition:string;player:string;minute:number;extra_minute?:number;forSassuolo:boolean;sourceUrl:string};
const fb=(season:string)=>`https://fbref.com/en/squads/e2befd26/${season.replace('/','-')}/goallogs/c11/Sassuolo-Goal-Logs-Serie-A`;
const goals:OwnGoal[]=[
  {date:'2013-09-01',season:'2013/14',competition:'Serie A',player:'Antonio Rosati',minute:69,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2013-2014/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2013-09-22',season:'2013/14',competition:'Serie A',player:'Raffaele Pucino',minute:33,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2013-2014/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2013-11-10',season:'2013/14',competition:'Serie A',player:'Alessandro Longhi',minute:19,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2013-2014/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2014-02-02',season:'2013/14',competition:'Serie A',player:'Thomas Manfredini',minute:50,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2013-2014/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2015-03-22',season:'2014/15',competition:'Serie A',player:'Daniele Rugani',minute:49,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2014-2015/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2015-04-26',season:'2014/15',competition:'Serie A',player:'Vangelis Moras',minute:35,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2014-2015/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2016-01-06',season:'2015/16',competition:'Serie A',player:'Arlind Ajeti',minute:22,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2015-2016/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2017-05-21',season:'2016/17',competition:'Serie A',player:'Marco Borriello',minute:34,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2016-2017/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2017-12-10',season:'2017/18',competition:'Serie A',player:'Francesco Acerbi',minute:66,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2017-2018/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2018-03-17',season:'2017/18',competition:'Serie A',player:'Ali Adnan Kadhim',minute:42,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2017-2018/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2018-09-02',season:'2018/19',competition:'Serie A',player:'Nicolás Spolli',minute:45,extra_minute:1,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2018-2019/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2018-11-04',season:'2018/19',competition:'Serie A',player:'Emanuele Giaccherini',minute:90,extra_minute:4,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2018-2019/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2018-12-16',season:'2018/19',competition:'Serie A',player:'Lorenzo Ariaudo',minute:43,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2018-2019/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2019-03-02',season:'2018/19',competition:'Serie A',player:'Pol Lirola',minute:35,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2018-2019/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2019-04-20',season:'2018/19',competition:'Serie A',player:'Pol Lirola',minute:80,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2018-2019/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2019-09-25',season:'2019/20',competition:'Serie A',player:'Mehdi Bourabia',minute:90,extra_minute:5,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2019-2020/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2020-06-21',season:'2019/20',competition:'Serie A',player:'Mehdi Bourabia',minute:37,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2019-2020/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2020-11-28',season:'2020/21',competition:'Serie A',player:'Vlad Chiricheș',minute:14,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2020-2021/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2021-03-03',season:'2020/21',competition:'Serie A',player:'Nikola Maksimović',minute:34,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2020-2021/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2021-11-07',season:'2021/22',competition:'Serie A',player:'Davide Frattesi',minute:39,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2021-2022/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2023-02-12',season:'2022/23',competition:'Serie A',player:'Nehuén Pérez',minute:45,extra_minute:2,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2022-2023/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2023-05-26',season:'2022/23',competition:'Serie A',player:'Martin Erlic',minute:78,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2022-2023/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2023-09-23',season:'2023/24',competition:'Serie A',player:'Federico Gatti',minute:90,extra_minute:5,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2023-2024/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2023-11-26',season:'2023/24',competition:'Serie A',player:'Matías Viña',minute:86,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2023-2024/goallogs/c11/Sassuolo-Goal-Logs-Serie-A'},
  {date:'2025-04-06',season:'2024/25',competition:'Serie B',player:'Jeremy Toljan',minute:25,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2024-2025/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2026-01-06',season:'2025/26',competition:'Serie A',player:'Tarik Muharemović',minute:16,forSassuolo:false,sourceUrl:'https://fbref.com/en/squads/e2befd26/2025-2026/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'},
  {date:'2026-01-31',season:'2025/26',competition:'Serie A',player:'Antonio Caracciolo',minute:45,extra_minute:1,forSassuolo:true,sourceUrl:'https://fbref.com/en/squads/e2befd26/2025-2026/goallogs/all_comps/Sassuolo-Goal-Logs-All-Competitions'}
];

initDb();
const backup=createBackupSnapshot('before-verified-own-goals-import');
const findMatch=db.prepare('SELECT id,home_team,away_team,home_score,away_score FROM matches WHERE substr(date,1,10)=? AND season=? AND competition=? LIMIT 1');
const playerRows=db.prepare('SELECT id,name FROM players').all() as {id:number;name:string}[];
const normalizeName=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const findPlayer=(name:string)=>playerRows.find(player=>{
  const a=normalizeName(player.name), b=normalizeName(name);
  return a===b || (b.length>=5 && a.includes(b.slice(0,5)));
});
const findEvent=db.prepare('SELECT id FROM match_events WHERE match_id=? AND minute=? AND COALESCE(extra_minute,-1)=COALESCE(?,-1) AND lower(COALESCE(player_name,\'\'))=lower(?) AND is_own_goal=1');
const updateExistingEvent=db.prepare('UPDATE match_events SET player_id=?,player_name=? WHERE id=?');
const markPlayerOwnGoal=db.prepare(`UPDATE player_seasons SET own_goals=CASE WHEN COALESCE(own_goals,0)<1 THEN 1 ELSE own_goals END WHERE player_id=? AND season=? AND competition=?`);
const insert=db.prepare(`INSERT INTO match_events(match_id,source_provider,provider_match_id,api_fixture_id,minute,extra_minute,team_name,player_id,player_name,type,detail,comments,scoring_play,home_score,away_score,source_url,verification_note,verified_by,last_verified_at,scoring_team_name,is_own_goal)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
let inserted=0, skipped=0, unresolved:string[]=[];
for(const g of goals){
  const m=findMatch.get(g.date,g.season,g.competition) as any;
  if(!m){unresolved.push(`${g.date} ${g.player}: fixture non trovata`);continue;}
  const player=findPlayer(g.player)?.id??null;
  const existing=findEvent.get(m.id,g.minute,g.extra_minute??null,g.player) as {id:number}|undefined;
  if(existing){
    if(player){
      updateExistingEvent.run(player,g.player,existing.id);
      if(g.forSassuolo) markPlayerOwnGoal.run(player,g.season,g.competition);
    }
    skipped++;continue;
  }
  const sassHome=String(m.home_team).toLowerCase().includes('sassuolo');
  const scorerTeam=g.forSassuolo ? 'U.S. Sassuolo Calcio' : (sassHome?m.away_team:m.home_team);
  const scoringTeam=g.forSassuolo ? 'U.S. Sassuolo Calcio' : (sassHome?m.home_team:m.away_team);
  const result=insert.run(m.id,'FBref',`fbref-og:${g.date}:${g.player}`,-m.id,g.minute,g.extra_minute??null,scorerTeam,player,g.player,'Goal','Own Goal','Verified from FBref goal log',1,m.home_score,m.away_score,g.sourceUrl,'Autogol: il nome identifica il calciatore che ha realizzato l’autogol.', 'Codex', nowIso(),scoringTeam,1);
  const eventId=Number(result.lastInsertRowid);recordSourceReference({entityType:'match_event',entityId:eventId,sourceUrl:g.sourceUrl,note:'FBref Goal Log: Own Goal'});inserted++;
  if(g.forSassuolo && player){
    db.prepare(`UPDATE player_seasons SET own_goals=COALESCE(own_goals,0)+1 WHERE player_id=? AND season=? AND competition=?`).run(player,g.season,g.competition);
  }
}
for(const season of [...new Set(goals.map(g=>g.season))]){
  const rows=goals.filter(g=>g.season===season);const forS=rows.filter(g=>g.forSassuolo).length;const against=rows.filter(g=>!g.forSassuolo).length;
  db.prepare(`UPDATE seasons SET own_goals_for=?,own_goals_against=?,last_verified_at=? WHERE season=? AND competition=?`).run(forS,against,nowIso(),season,rows[0].competition);
}
// The 2012/13 team total is 78 while the player table sums to 76: two opponent own goals are the residual.
db.prepare(`UPDATE seasons SET own_goals_for=2, last_verified_at=? WHERE season='2012/13' AND competition='Serie B'`).run(nowIso());
recordChange({entityType:'match_events',action:'create',after:{inserted,skipped,unresolved},sourceUrl:'https://fbref.com/en/squads/e2befd26/history/Sassuolo-Stats-and-History',note:'Import verificato autogol e contatori stagionali; 2012/13 own_goals_for=2 deriva dalla riconciliazione 78-76.',backupId:backup.id});
recomputeDerivedPlayerStats();
console.log(JSON.stringify({backup,inserted,skipped,unresolved},null,2));
