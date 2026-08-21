import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-current-center-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'current-center.db');
process.env.CURRENT_SEASON='2026/27';
const {db,initDb}=await import('../server/db/database.js');
const {archiveToday,currentSeason,getCurrentSeasonDashboard,validateCurrentMatch}=await import('../server/services/currentSeason.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('il centro stagione riunisce gare, forma, classifica, rosa, indisponibili e freschezza senza toccare lo storico',()=>{
  db.prepare(`INSERT INTO seasons(season,competition,points) VALUES(?,?,?)`).run('2008/09','Serie B',51);
  db.prepare(`INSERT INTO seasons(season,competition,matches) VALUES(?,?,?)`).run('2026/27','Serie A',38);
  const insertMatch=db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  insertMatch.run('current-old','2026-08-01','2026/27','Serie A','U.S. Sassuolo Calcio','Modena',2,1,'verified','2026-08-01T22:00:00.000Z');
  const nextId=Number(insertMatch.run('current-next','2099-08-20','2026/27','Serie A','Parma','U.S. Sassuolo Calcio',null,null,'kickoff','2026-08-10T09:00:00.000Z').lastInsertRowid);
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

test('la data operativa rispetta il fuso dell’archivio anche attorno a mezzanotte',()=>{
  const instant=new Date('2026-08-20T22:30:00.000Z');
  assert.equal(archiveToday(instant,'Europe/Rome'),'2026-08-21');
  assert.equal(archiveToday(instant,'UTC'),'2026-08-20');
});

test('i turni testuali sono normalizzati prima del controllo della giornata precedente',()=>{
  db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,source_provider) VALUES(?,?,?,?,?,?,?,?)`)
    .run('round-one-text','2099-08-21','2026/27','Serie A','Regular Season - Giornata 1','U.S. Sassuolo Calcio','Udinese','manual');
  const validation=validateCurrentMatch({date:'2099-08-28',competition:'Serie A',round:'Giornata 2',home_team:'Torino',away_team:'U.S. Sassuolo Calcio'});
  assert.equal(validation.valid,true);
  assert.equal(validation.warnings.some(message=>message.includes('giornata 1')),false);
});

test('in produzione la stagione corrente non viene dedotta implicitamente',()=>{
  const previousSeason=process.env.CURRENT_SEASON,previousNodeEnv=process.env.NODE_ENV;
  delete process.env.CURRENT_SEASON;process.env.NODE_ENV='production';
  try{assert.equal(currentSeason(),'');}
  finally{process.env.CURRENT_SEASON=previousSeason;process.env.NODE_ENV=previousNodeEnv;}
});
