import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-current-center-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'current-center.db');
process.env.CURRENT_SEASON='2026/27';
const {db,initDb}=await import('../server/db/database.js');
const {getCurrentSeasonDashboard}=await import('../server/services/currentSeason.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('il centro stagione riunisce gare, forma, classifica, rosa, indisponibili e freschezza senza toccare lo storico',()=>{
  db.prepare(`INSERT INTO seasons(season,competition,points) VALUES(?,?,?)`).run('2008/09','Serie B',51);
  db.prepare(`INSERT INTO seasons(season,competition,matches) VALUES(?,?,?)`).run('2026/27','Serie A',38);
  const insertMatch=db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  insertMatch.run('current-old','2026-08-01','2026/27','Serie A','U.S. Sassuolo Calcio','Modena',2,1,'verified','2026-08-01T22:00:00.000Z');
  const nextId=Number(insertMatch.run('current-next','2026-08-20','2026/27','Serie A','Parma','U.S. Sassuolo Calcio',null,null,'kickoff','2026-08-10T09:00:00.000Z').lastInsertRowid);
  db.prepare(`INSERT INTO season_standings(season,competition,api_football_team_id,team_name,rank,played,points,goals_diff,group_name,source_provider,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run('2026/27','Serie A',794,'U.S. Sassuolo Calcio',4,1,3,1,'','api-football','2026-08-10T09:05:00.000Z');
  const injuredId=Number(db.prepare(`INSERT INTO players(name,position,current_squad,injured,source_provider,last_verified_at) VALUES(?,?,?,?,?,?)`).run('Giocatore Infortunato','Defender',1,1,'api-football','2099-08-10T09:05:00.000Z').lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals) VALUES(?,?,?,?,?)`).run(injuredId,'2026/27','Serie A',1,0);
  db.prepare(`INSERT INTO match_injuries(match_id,source_provider,provider_match_id,team_name,player_name,type,reason) VALUES(?,?,?,?,?,?,?)`).run(nextId,'kickoff','fixture-1','Sassuolo','Giocatore Squalificato','Missing Fixture','Suspended');
  db.prepare(`INSERT INTO sync_state(provider,resource,last_request,last_successful_sync,last_error) VALUES(?,?,?,?,?)`).run('api-football','standings','2026-08-10T09:05:00.000Z','2026-08-10T09:05:00.000Z',null);

  const historicalBefore=db.prepare(`SELECT * FROM seasons WHERE season='2008/09'`).get();
  const dashboard=getCurrentSeasonDashboard();

  assert.equal(dashboard.season,'2026/27');
  assert.equal(dashboard.latestResult?.id,(dashboard.matches.find(match=>match.external_key==='current-old') as any)?.id);
  assert.equal(dashboard.nextMatch?.id,nextId);
  assert.deepEqual(dashboard.form.map(item=>item.result),['W']);
  assert.equal(dashboard.standings[0]?.rank,4);
  assert.equal(dashboard.squad[0]?.name,'Giocatore Infortunato');
  assert.deepEqual(new Set(dashboard.absences.map(item=>item.kind)),new Set(['injury','suspension']));
  assert.equal(dashboard.freshness.lastSyncAt,'2026-08-10T09:05:00.000Z');
  assert.deepEqual(db.prepare(`SELECT * FROM seasons WHERE season='2008/09'`).get(),historicalBefore);
});
