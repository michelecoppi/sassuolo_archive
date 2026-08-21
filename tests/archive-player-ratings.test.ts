import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-archive-ratings-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'ratings.db');
process.env.CURRENT_SEASON='2026/27';
const {db,initDb}=await import('../server/db/database.js');
const {ARCHIVE_RATING_VERSION,calculateArchiveRating,getCurrentMatchPlayerRatings,saveCurrentMatchPlayerRatings}=await import('../server/services/archivePlayerRatings.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

db.prepare(`INSERT INTO seasons(season,competition,matches) VALUES(?,?,?)`).run('2026/27','Serie A',38);
const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider) VALUES(?,?,?,?,?,?,?,?,?)`).run('rating-match','2026-08-22','2026/27','Serie A','U.S. Sassuolo Calcio','Parma',2,0,'manual').lastInsertRowid);
const incompleteMatchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,source_provider) VALUES(?,?,?,?,?,?,?)`).run('rating-match-incomplete','2026-08-29','2026/27','Serie A','Cremonese','U.S. Sassuolo Calcio','manual').lastInsertRowid);
const defenderId=Number(db.prepare(`INSERT INTO players(name,position,shirt_number,current_squad,source_provider) VALUES(?,?,?,?,?)`).run('Difensore Test','Defender',5,1,'manual').lastInsertRowid);
const attackerId=Number(db.prepare(`INSERT INTO players(name,position,shirt_number,current_squad,source_provider) VALUES(?,?,?,?,?)`).run('Attaccante Test','Attacker',9,1,'manual').lastInsertRowid);
const midfielderId=Number(db.prepare(`INSERT INTO players(name,position,shirt_number,current_squad,source_provider) VALUES(?,?,?,?,?)`).run('Centrocampista Test','Midfielder',8,1,'manual').lastInsertRowid);

test('la formula è autonoma, limitata e spiega i correttivi applicati',()=>{
  const result=calculateArchiveRating({minutes:90,position:'Attacker',goals:1,assists:1,shots_total:4,shots_on:2,passes_total:32,passes_key:2,pass_accuracy:82,duels_total:8,duels_won:5,yellow_cards:1},{result:'W',goalsAgainst:0});
  assert.equal(result.version,ARCHIVE_RATING_VERSION);
  assert.ok(result.rating!=null&&result.rating>7&&result.rating<=10);
  assert.equal(result.level,'STANDARD');
  assert.ok(result.breakdown.some(item=>item.key==='goals'));
  assert.ok(result.breakdown.some(item=>item.key==='yellow-cards'));
  assert.equal(calculateArchiveRating({minutes:7,position:'Midfielder'},{result:'D',goalsAgainst:1}).rating,null);
});

test('scenari di partita verosimili producono voti coerenti per ruolo',()=>{
  const scenarios=[
    {
      name:'portiere decisivo con sette parate e un rigore parato',
      row:{minutes:90,position:'Goalkeeper',saves:7,goals_conceded:1,penalty_saved:1,passes_total:35,pass_accuracy:74},
      context:{result:'W' as const,goalsAgainst:1},range:[7.7,8.1],factors:['penalty-saved','saves','goals-conceded'],
    },
    {
      name:'difensore da clean sheet con volume difensivo alto',
      row:{minutes:90,position:'Defender',tackles_total:4,blocks:2,interceptions:3,duels_total:10,duels_won:7,passes_total:55,pass_accuracy:88},
      context:{result:'W' as const,goalsAgainst:0},range:[7.2,7.6],factors:['defending','duels','clean-sheet'],
    },
    {
      name:'centrocampista creativo con assist e quattro passaggi chiave',
      row:{minutes:90,position:'Midfielder',assists:1,shots_total:2,shots_on:1,passes_total:65,passes_key:4,pass_accuracy:91,duels_total:12,duels_won:7,dribbles_attempts:4,dribbles_success:3,fouls_drawn:3,fouls_committed:1},
      context:{result:'D' as const,goalsAgainst:1},range:[7.2,7.6],factors:['assists','key-passes','passing'],
    },
    {
      name:'attaccante con doppietta ma alcune inefficienze',
      row:{minutes:86,position:'Attacker',goals:2,shots_total:6,shots_on:4,passes_total:25,passes_key:1,pass_accuracy:68,duels_total:10,duels_won:3,dribbles_attempts:5,dribbles_success:2,offsides:2},
      context:{result:'W' as const,goalsAgainst:1},range:[7.5,8],factors:['goals','shots-off','duels'],
    },
    {
      name:'difensore con autogol, rosso e rigore causato',
      row:{minutes:64,position:'Defender',own_goals:1,passes_total:20,pass_accuracy:60,duels_total:6,duels_won:1,fouls_committed:4,yellow_cards:1,red_cards:1,penalty_committed:1},
      context:{result:'L' as const,goalsAgainst:3},range:[3,3],factors:['own-goals','red-cards','penalty-committed'],
    },
  ];

  for(const scenario of scenarios){
    const result=calculateArchiveRating(scenario.row,scenario.context);
    assert.ok(result.rating!=null,`${scenario.name}: voto assente`);
    assert.ok(result.rating!>=scenario.range[0]&&result.rating!<=scenario.range[1],`${scenario.name}: voto ${result.rating} fuori da ${scenario.range.join('-')}`);
    for(const factor of scenario.factors)assert.ok(result.breakdown.some(item=>item.key===factor),`${scenario.name}: manca ${factor}`);
  }
});

test('casi limite: pochi minuti, eventi decisivi e limiti assoluti',()=>{
  const cameo=calculateArchiveRating({minutes:6,position:'Midfielder'},{result:'D',goalsAgainst:1});
  const decisiveCameo=calculateArchiveRating({minutes:6,position:'Midfielder',assists:1},{result:'D',goalsAgainst:1});
  const earlyRed=calculateArchiveRating({minutes:6,position:'Defender',red_cards:1},{result:'L',goalsAgainst:2});
  assert.equal(cameo.rating,null);
  assert.equal(cameo.reason,'insufficient-minutes');
  assert.ok(decisiveCameo.rating!=null&&decisiveCameo.rating>6);
  assert.ok(earlyRed.rating!=null&&earlyRed.rating<5);

  const maximum=calculateArchiveRating({minutes:90,position:'Attacker',goals:6,assists:3,shots_total:10,shots_on:9,passes_key:6},{result:'W',goalsAgainst:0});
  const minimum=calculateArchiveRating({minutes:90,position:'Defender',own_goals:3,red_cards:1,penalty_committed:2,fouls_committed:8},{result:'L',goalsAgainst:5});
  assert.equal(maximum.rating,10);
  assert.equal(minimum.rating,3);

  const attackerGoal=calculateArchiveRating({minutes:90,position:'Attacker',goals:1},{result:'D',goalsAgainst:1});
  const defenderGoal=calculateArchiveRating({minutes:90,position:'Defender',goals:1},{result:'D',goalsAgainst:1});
  assert.ok(defenderGoal.rating!>attackerGoal.rating!,'un gol di un difensore deve pesare più dello stesso gol di un attaccante');
});

test('salvataggio per partita conserva fonte, versione, confidenza e rende i dati rileggibili',()=>{
  const saved=saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://www.legaseriea.it/serie-a/match/example',verifiedBy:'Test',rows:[{player_id:defenderId,minutes:90,position:'Defender',substitute:0,goals:1,assists:0,tackles_total:3,blocks:1,interceptions:2,duels_total:7,duels_won:5,passes_total:48,pass_accuracy:85,yellow_cards:0,red_cards:0}]});
  assert.equal(saved.ok,true);
  assert.equal(saved.saved.length,1);
  assert.equal(saved.saved[0].archive_rating_version,ARCHIVE_RATING_VERSION);
  assert.ok(saved.saved[0].archive_rating>=3&&saved.saved[0].archive_rating<=10);
  assert.ok(saved.saved[0].archive_rating_confidence>0.5);

  const payload=getCurrentMatchPlayerRatings(matchId);
  const row=payload.rows.find(item=>item.player_id===defenderId);
  assert.equal(row?.selected,true);
  assert.equal(row?.source_provider,'manual-match-stats');
  assert.equal(row?.source_url,'https://www.legaseriea.it/serie-a/match/example');
  assert.ok(Array.isArray(row?.archive_rating_breakdown));
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM source_references WHERE entity_type='match_player_stats' AND field='archive_rating'`).get() as any).count,1);
});

test('il salvataggio è idempotente e aggiorna il voto senza duplicare la riga',()=>{
  const updated=saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://www.legaseriea.it/serie-a/match/example-recheck',verifiedBy:'Test revisione',rows:[{player_id:defenderId,minutes:90,position:'Defender',goals:1,tackles_total:5,blocks:2,interceptions:3,duels_total:9,duels_won:7,passes_total:51,pass_accuracy:87}]});
  assert.equal(updated.saved.length,1);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND player_id=?`).get(matchId,defenderId) as any).count,1);
  assert.equal(updated.saved[0].tackles_total,5);
  assert.equal(updated.saved[0].source_url,'https://www.legaseriea.it/serie-a/match/example-recheck');
  assert.ok((db.prepare(`SELECT COUNT(*) AS count FROM change_log WHERE entity_type='match_player_stats' AND entity_id=?`).get(updated.saved[0].id) as any).count>=2);
});

test('il salvataggio manuale non cambia provenienza né contenuto del raw provider',()=>{
  db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,team_api_id,team_name,player_id,api_football_player_id,player_name,minutes,rating) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(matchId,'kickoff','provider-rating',794,'U.S. Sassuolo Calcio',attackerId,7009,'Attaccante Test',88,6.7);
  const result=saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://example.test/referto-separato',verifiedBy:'Curatore',rows:[{player_id:defenderId,minutes:90,position:'Defender',tackles_total:4},{player_id:attackerId,minutes:88,position:'Attacker',shots_total:3,shots_on:1}]});
  assert.equal(result.saved.length,2);
  assert.equal((db.prepare(`SELECT source_provider FROM match_player_stats WHERE match_id=? AND api_football_player_id=7009`).get(matchId) as any).source_provider,'kickoff');
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND player_id=?`).get(matchId,attackerId) as any).count,2);
});

test('la distinta sostitutiva elimina solo righe manuali deselezionate e può essere svuotata',()=>{
  const partial=saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://example.test/distinta-ridotta',verifiedBy:'Curatore',rows:[{player_id:attackerId,minutes:20,position:'Attacker'}]});
  assert.ok(partial.removed>=1);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND player_id=? AND source_provider='manual-match-stats'`).get(matchId,defenderId) as any).count,0);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND player_id=? AND source_provider='kickoff'`).get(matchId,attackerId) as any).count,1);
  const emptied=saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://example.test/distinta-vuota',verifiedBy:'Curatore',rows:[]});
  assert.equal(emptied.saved.length,0);assert.equal(emptied.removed,1);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND source_provider='manual-match-stats'`).get(matchId) as any).count,0);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND source_provider='kickoff'`).get(matchId) as any).count,1);
});

test('gli eventi già registrati precompilano gol e assist',()=>{
  db.prepare(`INSERT INTO match_events(match_id,source_provider,provider_match_id,provider_event_id,minute,team_name,player_id,player_name,assist_player_id,assist_name,type,detail,scoring_play,is_own_goal) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(matchId,'manual','rating-match','goal-1',52,'U.S. Sassuolo Calcio',attackerId,'Attaccante Test',midfielderId,'Centrocampista Test','Goal','Normal Goal',1,0);
  const payload=getCurrentMatchPlayerRatings(matchId);
  assert.equal(payload.rows.find(item=>item.player_id===attackerId)?.goals,1);
  assert.equal(payload.rows.find(item=>item.player_id===midfielderId)?.assists,1);
});

test('la validazione respinge dati impossibili, duplicati, fonti non web e partite incomplete',()=>{
  const validRow={player_id:attackerId,minutes:90,position:'Attacker',shots_total:4,shots_on:2,duels_total:8,duels_won:4};
  assert.throws(()=>saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'file:///tmp/referto.csv',rows:[validRow]}),/http o https/);
  assert.throws(()=>saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://example.test/referto',rows:[{...validRow,minutes:131}]}),/1 e 130/);
  assert.throws(()=>saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://example.test/referto',rows:[{...validRow,shots_total:2,shots_on:3}]}),/non può superare il totale/);
  assert.throws(()=>saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://example.test/referto',rows:[validRow,validRow]}),/compare più di una volta/);
  assert.throws(()=>saveCurrentMatchPlayerRatings(incompleteMatchId,{sourceUrl:'https://example.test/referto',rows:[validRow]}),/risultato finale/);
});
