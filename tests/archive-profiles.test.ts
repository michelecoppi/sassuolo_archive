import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-archive-profiles-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'archive-profiles.db');
const {createApp}=await import('../server/app.js');
const {db,nowIso}=await import('../server/db/database.js');
const server=createApp({nodeEnv:'test'}).listen(0);
const address=server.address();
if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;

after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

function addMatch(name:string,extra:Record<string,unknown>={}){
  const result=db.prepare(`INSERT INTO matches(external_key,date,home_team,away_team,home_score,away_score,halftime_score,attendance,stadium,referee,scorers,possession_home) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    `archive-profile-${name}`,`2088-01-0${name.length}T15:00:00Z`,'Sassuolo',name,1,0,extra.halftime??null,extra.attendance??null,extra.stadium??null,extra.referee??null,extra.scorers??null,extra.possession??null
  );
  return Number(result.lastInsertRowid);
}

test('il centro partita deriva BASIC, STANDARD e DETAILED dai moduli realmente disponibili',async()=>{
  const basicId=addMatch('Basic');
  const standardId=addMatch('Standard',{halftime:'0-0',attendance:12345,stadium:'Mapei Stadium',referee:'Test Referee'});
  db.prepare(`INSERT INTO match_details(match_id,provider_match_id,extratime_home,extratime_away,penalty_home,penalty_away) VALUES(?,?,?,?,?,?)`).run(standardId,'standard',1,1,4,3);
  const detailedId=addMatch('Detailed',{possession:52});
  db.prepare(`INSERT INTO match_team_stats(match_id,provider_match_id,team_api_id,team_name,stats_json) VALUES(?,?,?,?,?)`).run(detailedId,'detailed',1,'Sassuolo','[{"type":"Shots","value":10}]');

  const basic=await (await fetch(`${base}/matches/${basicId}`)).json() as any;
  const standard=await (await fetch(`${base}/matches/${standardId}`)).json() as any;
  const detailed=await (await fetch(`${base}/matches/${detailedId}`)).json() as any;
  assert.equal(basic.match.completeness_level,'BASIC');
  assert.deepEqual({events:basic.modules.events,lineups:basic.modules.lineups,teamStats:basic.modules.teamStats,playerStats:basic.modules.playerStats},{events:false,lineups:false,teamStats:false,playerStats:false});
  assert.equal(standard.match.completeness_level,'STANDARD');
  assert.equal(standard.outcome.extraTime,'1-1');assert.equal(standard.outcome.penalties,'4-3');assert.equal(standard.match.attendance,12345);
  assert.equal(detailed.match.completeness_level,'DETAILED');assert.equal(detailed.modules.teamStats,true);
});

test('la scheda giocatore riconcilia aggregati, competizioni, fonti e identità dubbie',async()=>{
  const verified=nowIso();
  const playerId=Number(db.prepare(`INSERT INTO players(name,nationality,birth_date,birth_place,height,weight,source_provider,source_external_id,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run('Archive Profile Player','Italia','2000-01-02','Sassuolo','180 cm','75 kg','test','p-42','https://example.test/player',verified).lastInsertRowid);
  const insert=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,yellow_red_cards,red_cards,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insert.run(playerId,'2087/88','Serie A',3,2,200,1,2,1,0,0,'test','https://example.test/season-a',verified);
  insert.run(playerId,'2087/88','Coppa Italia',2,1,90,2,0,0,1,1,'test','https://example.test/season-cup',verified);
  db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at) VALUES(?,?,?,?,?)`).run(playerId,'test','p-42','https://example.test/player',verified);
  db.prepare(`INSERT INTO player_match_conflicts(raw_name,normalized_name,source_provider,source_player_id,status,candidates_json,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run('A. Profile','a. profile','other','candidate-7','open',JSON.stringify([{id:playerId,name:'Archive Profile Player'}]),'Possibile omonimia',verified,verified);

  const payload=await (await fetch(`${base}/players/${playerId}`)).json() as any;
  assert.equal(payload.player.appearances,5);assert.equal(payload.player.starts,3);assert.equal(payload.player.yellow_red_cards,1);assert.equal(payload.player.red_cards,1);
  assert.equal(payload.competitionTotals.length,2);
  assert.equal(payload.competitionTotals.reduce((sum:number,row:any)=>sum+row.appearances,0),payload.player.appearances);
  assert.equal(payload.identity.status,'review');assert.equal(payload.identity.conflicts.length,1);
  assert.ok(payload.sources.some((source:any)=>source.source_url==='https://example.test/season-a'));
});
