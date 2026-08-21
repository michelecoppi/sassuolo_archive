import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-kickoff-safety-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'kickoff.db');
const {db,initDb}=await import('../server/db/database.js');
const {saveKickoffPlayerStats}=await import('../server/services/kickoffSync.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score) VALUES(?,?,?,?,?,?,?,?)`).run('kickoff-safety','2026-08-22','2026/27','Serie A','U.S. Sassuolo Calcio','Parma',2,0).lastInsertRowid);
db.prepare(`INSERT INTO match_details(match_id,source_provider,provider_match_id,api_fixture_id) VALUES(?,?,?,?)`).run(matchId,'kickoff','9001',9001);
const playerId=Number(db.prepare(`INSERT INTO players(name,position,current_squad,source_provider) VALUES(?,?,?,?)`).run('Difensore Sicuro','Defender',1,'manual').lastInsertRowid);
db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,team_name,player_id,provider_player_id,player_name,position,minutes,archive_rating,archive_rating_version,source_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(matchId,'manual-match-stats',`archive:${matchId}`,'U.S. Sassuolo Calcio',playerId,`archive-player:${playerId}`,'Difensore Sicuro','Defender',90,7.2,'sar-1.0.0','https://example.test/referto');
db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,team_api_id,team_name,api_football_player_id,player_name,minutes,rating) VALUES(?,?,?,?,?,?,?,?,?)`).run(matchId,'kickoff','9001',794,'U.S. Sassuolo Calcio',501,'Difensore Sicuro',80,6.5);
db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,team_name,provider_player_id,player_name,minutes,rating) VALUES(?,?,?,?,?,?,?,?)`).run(matchId,'statsbomb','sb-9001','U.S. Sassuolo Calcio','sb-501','Difensore Sicuro',90,6.8);

const providerRow=(minutes:number,playerIdValue=501)=>({
  team:{id:794,name:'U.S. Sassuolo Calcio'},player:{id:playerIdValue,name:'Difensore Sicuro'},
  statistics:[{games:{minutes,number:5,position:'D',rating:'7.0'},goals:{total:0,assists:0},cards:{yellow:0,red:0}}],
});

test('un refresh Kickoff sostituisce il raw provider ma conserva la riga curata e il SAR',async()=>{
  assert.equal(await saveKickoffPlayerStats(matchId,9001,{data:[providerRow(90)]},794),1);
  const manual=db.prepare(`SELECT minutes,archive_rating,source_url FROM match_player_stats WHERE match_id=? AND source_provider='manual-match-stats'`).get(matchId) as any;
  const raw=db.prepare(`SELECT minutes,rating FROM match_player_stats WHERE match_id=? AND source_provider='kickoff'`).get(matchId) as any;
  assert.deepEqual(manual,{minutes:90,archive_rating:7.2,source_url:'https://example.test/referto'});
  assert.deepEqual(raw,{minutes:90,rating:7});
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND source_provider='statsbomb'`).get(matchId) as any).count,1);
});

test('una risposta vuota non cancella l’ultimo snapshot provider valido',async()=>{
  assert.equal(await saveKickoffPlayerStats(matchId,9001,{data:[]},794),0);
  assert.equal((db.prepare(`SELECT minutes FROM match_player_stats WHERE match_id=? AND source_provider='kickoff'`).get(matchId) as any).minutes,90);
});

test('un errore a metà sostituzione esegue rollback senza lasciare dati parziali',async()=>{
  const before=db.prepare(`SELECT id,minutes,rating FROM match_player_stats WHERE match_id=? AND source_provider='kickoff'`).get(matchId);
  await assert.rejects(()=>saveKickoffPlayerStats(matchId,9001,{data:[providerRow(60),providerRow(30)]},794),/UNIQUE constraint failed/);
  const after=db.prepare(`SELECT id,minutes,rating FROM match_player_stats WHERE match_id=? AND source_provider='kickoff'`).get(matchId);
  assert.deepEqual(after,before);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats WHERE match_id=? AND source_provider='manual-match-stats'`).get(matchId) as any).count,1);
});
