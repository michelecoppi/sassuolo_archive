import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-stat-definitions-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'stats.db');
const {db,initDb}=await import('../server/db/database.js');
const {hallOfFame,records}=await import('../server/services/stats.js');
const {HALL_OF_FAME_COMPETITIONS,HALL_OF_FAME_DEFINITIONS,RECORD_DEFINITIONS}=await import('../server/services/statDefinitions.js');

before(()=>initDb());
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('record definitions are complete and equal values use the declared deterministic tie-break',()=>{
  const insert=db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score) VALUES(?,?,?,?,?,?,?,?)`);
  insert.run('later','2022-09-10','2022/23','Serie A','U.S. Sassuolo Calcio','Roma',3,1);
  insert.run('earlier','2022-09-01','2022/23','Serie A','U.S. Sassuolo Calcio','Milan',2,0);
  const result=records({competition:'Serie A'}) as any;
  assert.equal(result.biggestWin.date,'2022-09-01');
  assert.equal(result.meta.coverage.matches,2);
  assert.deepEqual(result.meta.coverage.competitions,['Serie A']);
  assert.deepEqual(result.evidence.biggestWin.map((match:any)=>match.id),[result.biggestWin.id]);
  assert.deepEqual(result.evidence.longestWinningStreak.map((match:any)=>match.date),['2022-09-01','2022-09-10']);
  assert.deepEqual(result.meta.definitions.map((item:any)=>item.key),RECORD_DEFINITIONS.map(item=>item.key));
  assert.equal(new Set(RECORD_DEFINITIONS.map(item=>item.key)).size,8);
  const empty=records({competition:'Serie B'}) as any;
  assert.equal(empty.longestWinningStreak,null);
  assert.deepEqual(empty.evidence.longestWinningStreak,[]);
});

test('Hall of Fame exposes applied thresholds, coverage, competitions and tie-break rules',()=>{
  const player=db.prepare(`INSERT INTO players(name,position) VALUES(?,?)`);
  const season=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals,last_verified_at) VALUES(?,?,?,?,?,?)`);
  const zeta=Number(player.run('Zeta Player','Attacker').lastInsertRowid);
  const alpha=Number(player.run('Alpha Player','Attacker').lastInsertRowid);
  season.run(zeta,'2022/23','Serie A',10,5,'2026-08-10T00:00:00.000Z');
  season.run(alpha,'2022/23','Serie A',10,5,'2026-08-11T00:00:00.000Z');
  const result=hallOfFame({competition:'Serie A',minGoals:5}) as any;
  assert.equal(result.goals[0].name,'Alpha Player');
  assert.equal(result.meta.filters.minimums.goals,5);
  assert.equal(result.meta.coverage.players,2);
  assert.equal(result.meta.coverage.playerSeasonRows,2);
  assert.deepEqual(result.meta.competitions,[...HALL_OF_FAME_COMPETITIONS]);
  assert.deepEqual(result.meta.definitions.map((item:any)=>item.key),HALL_OF_FAME_DEFINITIONS.map(item=>item.key));
});
