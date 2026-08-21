import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-rating-calibration-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'calibration.db');
process.env.CURRENT_SEASON='2026/27';
const {db,initDb}=await import('../server/db/database.js');
const {getArchiveRatingCalibration}=await import('../server/services/archiveRatingCalibration.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('il laboratorio aggrega ruoli, distribuzione, trend e salute senza mescolare i dati provider',()=>{
  db.prepare(`INSERT INTO seasons(season,competition) VALUES(?,?)`).run('2026/27','Serie A');
  const playerIds=['Portiere','Difensore','Attaccante'].map((name,index)=>Number(db.prepare(`INSERT INTO players(name,position,current_squad) VALUES(?,?,1)`).run(name,['Goalkeeper','Defender','Attacker'][index]).lastInsertRowid));
  const insertMatch=db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score) VALUES(?,?,?,?,?,?,?,?)`);
  const matchIds=[0,1].map(index=>Number(insertMatch.run(`calibration-${index}`,`2026-08-${10+index}`,'2026/27','Serie A','U.S. Sassuolo Calcio',index?'Parma':'Torino',index,1).lastInsertRowid));
  const insertStat=db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,player_id,player_name,position,minutes,archive_rating,archive_rating_confidence,archive_rating_version,source_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  insertStat.run(matchIds[0],'kickoff','raw-1',playerIds[0],'Portiere','Goalkeeper',90,null,null,null,'https://provider.test/raw');
  insertStat.run(matchIds[0],'manual-match-stats','archive-1',playerIds[0],'Portiere','Goalkeeper',90,4.5,.8,'sar-v1','https://source.test/one');
  insertStat.run(matchIds[0],'manual-match-stats','archive-1',playerIds[1],'Difensore','Defender',90,6.5,.7,'sar-v1','https://source.test/one');
  insertStat.run(matchIds[1],'manual-match-stats','archive-2',playerIds[2],'Attaccante','Attacker',90,8.5,.5,'sar-v2','https://source.test/two');

  const result=getArchiveRatingCalibration();
  assert.equal(result.ratings,3);assert.equal(result.ratedMatches,2);assert.equal(result.ratedPlayers,3);
  assert.equal(result.average,6.5);assert.equal(result.median,6.5);assert.equal(result.ready,false);assert.equal(result.remainingMatches,8);
  assert.equal(result.dataHealth.rawSnapshots,1);assert.equal(result.dataHealth.curatedRows,3);assert.equal(result.dataHealth.lowConfidence,1);assert.equal(result.dataHealth.healthy,true);
  assert.deepEqual(new Set(result.roles.map(item=>item.role)),new Set(['Portieri','Difensori','Attaccanti']));
  assert.equal(result.outliers.length,2);assert.equal(result.trends.length,2);assert.deepEqual(result.versions.map(item=>item.version),['sar-v1','sar-v2']);
});

test('il laboratorio gestisce una stagione senza voti',()=>{
  db.prepare(`DELETE FROM match_player_stats` ).run();
  const result=getArchiveRatingCalibration();
  assert.equal(result.ratings,0);assert.equal(result.average,null);assert.equal(result.median,null);assert.deepEqual(result.distribution.map(item=>item.count),[0,0,0,0,0]);
});
