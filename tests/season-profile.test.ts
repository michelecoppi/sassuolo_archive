import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-season-profile-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'season-profile.db');
const {createApp}=await import('../server/app.js');
const {db}=await import('../server/db/database.js');
const app=createApp({nodeEnv:'test'});
const server=app.listen(0);
const address=server.address();
if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;

after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('a declared season remains consultable when every record is missing',async()=>{
  const response=await fetch(`${base}/seasons/2007%2F08?competition=Serie%20C1`);
  assert.equal(response.status,200);
  const body=await response.json() as any;
  assert.equal(body.season.season,'2007/08');
  assert.equal(body.season.competition,'Serie C1');
  assert.equal(body.season.declared_only,true);
  assert.equal(body.profile.reliability.level,'unknown');
  assert.ok(body.profile.gaps.length>0);
  assert.ok(body.profile.gaps.every((gap:any)=>gap.reason));
  assert.ok(body.competitions.some((row:any)=>row.competition==='Coppa Italia Serie C'));
});

test('all declared Coppa Italia editions are listed and have a sourced base page',async()=>{
  const listResponse=await fetch(`${base}/seasons`);
  assert.equal(listResponse.status,200);
  const seasons=await listResponse.json() as any[];
  const cupEditions=seasons.filter(row=>row.competition==='Coppa Italia');
  for(let year=2008;year<=2026;year++){
    const edition=`${year}/${String(year+1).slice(-2)}`;
    assert.ok(cupEditions.some(row=>row.season===edition),`missing Coppa Italia ${edition}`);
  }

  const detailResponse=await fetch(`${base}/seasons/2014%2F15?competition=Coppa%20Italia`);
  assert.equal(detailResponse.status,200);
  const detail=await detailResponse.json() as any;
  assert.equal(detail.season.competition,'Coppa Italia');
  assert.equal(detail.season.declared_only,true);
  assert.equal(detail.season.cup_exit,'Ottavi');
  assert.equal(detail.season.source_provider,'Transfermarkt');
  assert.equal(detail.topScorer,null);
  assert.ok(!detail.profile.gaps.some((gap:any)=>gap.field==='sources'));
});

test('season profile reuses verified coach terms and seasonal staff',async()=>{
  const response=await fetch(`${base}/seasons/2024%2F25?competition=Serie%20B`);
  assert.equal(response.status,200);
  const body=await response.json() as any;
  assert.equal(body.profile.managerTerms[0].name,'Fabio Grosso');
  assert.equal(body.profile.managerTerms[0].precision,'exact');
  assert.equal(body.profile.staff.coach,'Fabio Grosso');
  assert.ok(body.profile.staff.members.some((member:any)=>member.name==='Raffaele Longo'&&member.role==='Vice allenatore'));
  assert.ok(!body.profile.gaps.some((gap:any)=>gap.field==='manager'));
  assert.ok(!body.profile.gaps.some((gap:any)=>gap.field==='technical_staff'));
});

test('Europa League espone traguardo, classifica del girone e tabellone finale',async()=>{
  const response=await fetch(`${base}/seasons/2016%2F17?competition=Europa%20League`);
  assert.equal(response.status,200);
  const body=await response.json() as any;
  assert.equal(body.competitionProfile.resultShort,'Fase a gironi');
  assert.equal(body.competitionProfile.groupPosition,4);
  assert.equal(body.competitionProfile.groupPoints,5);
  assert.equal(body.competitionProfile.groupStandings.find((row:any)=>row.team_name==='Sassuolo').points,5);
  assert.equal(body.competitionProfile.qualifyingTies.length,2);
  assert.equal(body.competitionProfile.knockout.final.winner,'Manchester United');
  assert.ok(!body.profile.gaps.some((gap:any)=>gap.field==='standings'));
  assert.ok(!body.profile.gaps.some((gap:any)=>gap.field==='final_position'));
});

test('season profile exposes sourced context and keeps unknown manager intervals explicit',async()=>{
  const seasonId=Number(db.prepare(`INSERT INTO seasons(season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,manager,stadium,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('2098/99','Serie A',1,1,1,0,0,2,1,3,'Allenatore Test','Stadio Test','Archivio Test','https://example.test/season','2099-06-01T00:00:00.000Z').lastInsertRowid);
  assert.ok(seasonId>0);
  db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run('season-profile-match','2099-05-01','2098/99','Serie A','U.S. Sassuolo Calcio','Avversaria',2,1,'Archivio Test','https://example.test/match','2099-06-01T00:00:00.000Z');
  const playerId=Number(db.prepare(`INSERT INTO players(name,current_squad) VALUES('Capitano Test',0)`).run().lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,minutes,goals,assists,captain,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(playerId,'2098/99','Serie A',1,90,2,0,1,'Archivio Test','https://example.test/player','2099-06-01T00:00:00.000Z');

  const response=await fetch(`${base}/seasons/2098%2F99?competition=Serie%20A`);
  assert.equal(response.status,200);
  const body=await response.json() as any;
  assert.equal(body.profile.reliability.level,'high');
  assert.equal(body.profile.captain.name,'Capitano Test');
  assert.deepEqual(body.profile.managerTerms,[{name:'Allenatore Test',from:null,to:null,precision:'season-only'}]);
  assert.ok(body.profile.gaps.some((gap:any)=>gap.field==='manager_terms'));
  for(const field of ['manager','stadium','captain','top_scorer','sources'])assert.ok(!body.profile.gaps.some((gap:any)=>gap.field===field),`unexpected gap: ${field}`);
  assert.ok(body.profile.sourceBreakdown.some((source:any)=>source.provider==='Archivio Test'));
});
