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

test('la formula è autonoma, limitata e spiega i correttivi applicati',()=>{
  const result=calculateArchiveRating({minutes:90,position:'Attacker',goals:1,assists:1,shots_total:4,shots_on:2,passes_total:32,passes_key:2,pass_accuracy:82,duels_total:8,duels_won:5,yellow_cards:1},{result:'W',goalsAgainst:0});
  assert.equal(result.version,ARCHIVE_RATING_VERSION);
  assert.ok(result.rating!=null&&result.rating>7&&result.rating<=10);
  assert.equal(result.level,'STANDARD');
  assert.ok(result.breakdown.some(item=>item.key==='goals'));
  assert.ok(result.breakdown.some(item=>item.key==='yellow-cards'));
  assert.equal(calculateArchiveRating({minutes:7,position:'Midfielder'},{result:'D',goalsAgainst:1}).rating,null);
});

test('salvataggio per partita conserva fonte, versione, confidenza e rende i dati rileggibili',()=>{
  db.prepare(`INSERT INTO seasons(season,competition,matches) VALUES(?,?,?)`).run('2026/27','Serie A',38);
  const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider) VALUES(?,?,?,?,?,?,?,?,?)`).run('rating-match','2026-08-22','2026/27','Serie A','U.S. Sassuolo Calcio','Parma',2,0,'manual').lastInsertRowid);
  const playerId=Number(db.prepare(`INSERT INTO players(name,position,shirt_number,current_squad,source_provider) VALUES(?,?,?,?,?)`).run('Mario Prova','Defender',5,1,'manual').lastInsertRowid);

  const saved=saveCurrentMatchPlayerRatings(matchId,{sourceUrl:'https://www.legaseriea.it/serie-a/match/example',verifiedBy:'Test',rows:[{player_id:playerId,minutes:90,position:'Defender',substitute:0,goals:1,assists:0,tackles_total:3,blocks:1,interceptions:2,duels_total:7,duels_won:5,passes_total:48,pass_accuracy:85,yellow_cards:0,red_cards:0}]});
  assert.equal(saved.ok,true);
  assert.equal(saved.saved.length,1);
  assert.equal(saved.saved[0].archive_rating_version,ARCHIVE_RATING_VERSION);
  assert.ok(saved.saved[0].archive_rating>=3&&saved.saved[0].archive_rating<=10);
  assert.ok(saved.saved[0].archive_rating_confidence>0.5);

  const payload=getCurrentMatchPlayerRatings(matchId);
  const row=payload.rows.find(item=>item.player_id===playerId);
  assert.equal(row?.selected,true);
  assert.equal(row?.source_provider,'manual-match-stats');
  assert.equal(row?.source_url,'https://www.legaseriea.it/serie-a/match/example');
  assert.ok(Array.isArray(row?.archive_rating_breakdown));
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM source_references WHERE entity_type='match_player_stats' AND field='archive_rating'`).get() as any).count,1);
});
