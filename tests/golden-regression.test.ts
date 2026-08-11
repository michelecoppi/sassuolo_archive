import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-golden-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'golden.db');
const fixture=JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/golden-archive.json'),'utf8'));
const {db,initDb}=await import('../server/db/database.js');
const {hallOfFame,headToHead,records}=await import('../server/services/stats.js');

before(()=>{
  initDb();
  const match=db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider,source_url) VALUES(@external_key,@date,@season,@competition,@home_team,@away_team,@home_score,@away_score,'golden','https://example.test/golden')`);
  const player=db.prepare(`INSERT INTO players(name,position,source_provider,source_url) VALUES(?,?,'golden','https://example.test/golden')`);
  const season=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,minutes,goals,assists,source_provider,source_url) VALUES(?,?,?,?,?,?,?,'golden','https://example.test/golden')`);
  db.transaction(()=>{for(const row of fixture.matches)match.run(row);for(const item of fixture.players){const id=Number(player.run(item.name,item.position).lastInsertRowid);for(const stats of item.seasons)season.run(id,stats.season,stats.competition,stats.appearances,stats.minutes,stats.goals,stats.assists);}})();
});
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('il dataset golden congela H2H, streak, competizioni e semantica NULL',()=>{
  const h2h=headToHead('Milan');const archiveRecords=records();const hall=hallOfFame() as any;
  assert.equal(h2h.played,fixture.expected.milanPlayed);assert.equal(h2h.wins,fixture.expected.milanWins);assert.equal(h2h.currentStreak,fixture.expected.milanStreak);
  assert.equal(archiveRecords.longestWinningStreak,fixture.expected.longestWinningStreak);
  assert.equal(hall.byCompetition['Serie A'].goals[0].name,fixture.expected.serieAGoalsLeader);assert.equal(hall.byCompetition['Serie A'].goals[0].goals,fixture.expected.serieAGoals);
  assert.equal(hall.byCompetition['Coppa Italia'].goals[0].goals,fixture.expected.cupGoals);
  assert.equal((db.prepare(`SELECT ps.goals FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE p.name='Golden Unknown'`).get() as any).goals,null);
});
