import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after,test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-time-machine-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'time-machine.db');
const {createApp}=await import('../server/app.js');
const {db}=await import('../server/db/database.js');
const app=createApp({nodeEnv:'test'}),server=app.listen(0),address=server.address();
if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;

const source='https://example.test/season-2012-13',verified='2013-06-01T10:00:00.000Z';
db.prepare(`INSERT INTO seasons(season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,manager,stadium,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('2012/13','Serie B',1,42,25,10,7,78,40,85,'Eusebio Di Francesco','Stadio Alberto Braglia','Fixture verificata',source,verified);
const match=db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
match.run('tm-1','2012-09-01','2012/13','Serie B','1','Sassuolo','Crotone',3,1,'Fixture verificata','https://example.test/m1',verified);
match.run('tm-2','2012-09-08','2012/13','Serie B','2','Modena','U.S. Sassuolo Calcio',0,4,'Fixture verificata','https://example.test/m2',verified);
match.run('tm-3','2012-09-15','2012/13','Serie B','3','Sassuolo','Brescia',1,1,'Fixture verificata','https://example.test/m3',verified);
match.run('tm-4','2012-10-01','2012/13','Coppa Italia','Terzo turno','Sassuolo','Avellino',4,0,'Fixture verificata','https://example.test/m4',verified);
match.run('tm-invalid','2012-10-08','2012/13','Serie B','4','Sassuolo','Errore dati',-1,0,'Fixture non valida','https://example.test/invalid',verified);

const player=db.prepare(`INSERT INTO players(name,position,current_squad) VALUES(?,?,0)`),stats=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,minutes,goals,assists,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
const berardi=Number(player.run('Domenico Berardi','Attacker').lastInsertRowid),pavoletti=Number(player.run('Leonardo Pavoletti','Attacker').lastInsertRowid),unknown=Number(player.run('Giocatore con dato parziale','Midfielder').lastInsertRowid);
stats.run(berardi,'2012/13','Serie B',37,2700,11,6,'Fixture verificata','https://example.test/berardi-league',verified);
stats.run(berardi,'2012/13','Coppa Italia',2,120,2,1,'Fixture verificata','https://example.test/berardi-cup',verified);
stats.run(pavoletti,'2012/13','Serie B',33,2200,12,2,'Fixture verificata','https://example.test/pavoletti',verified);
stats.run(unknown,'2012/13','Serie B',2,45,null,null,'Fixture verificata','https://example.test/partial',verified);

after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('la Time Machine usa riepiloghi verificati e ricostruisce il viaggio senza mescolare le coppe',async()=>{
  const response=await fetch(`${base}/time-machine`);assert.equal(response.status,200);
  const body=await response.json() as any,season=body.seasons.find((item:any)=>item.season==='2012/13');
  assert.equal(body.range.from,'2007/08');assert.equal(body.range.to,'2026/27');assert.equal(body.range.total,20);
  assert.equal(season.primaryCompetition,'Serie B');assert.deepEqual(season.record,{matches:42,wins:25,draws:10,losses:7,goalsFor:78,goalsAgainst:40,points:85});
  assert.deepEqual(season.journey.points.map((point:any)=>[point.result,point.cumulativePoints]),[['W',3],['W',6],['D',7]]);
  assert.equal(season.journey.points.some((point:any)=>point.opponent==='Errore dati'),false);
  assert.ok(season.competitions.includes('Coppa Italia'));assert.ok(season.milestones.some((item:any)=>item.title==='Prima promozione in Serie A'));
});

test('migliore vittoria e protagonisti sono deterministici anche con casa, trasferta, pari merito e null',async()=>{
  const body=await (await fetch(`${base}/time-machine`)).json() as any,season=body.seasons.find((item:any)=>item.season==='2012/13');
  assert.equal(season.bestWin.date,'2012-09-08');assert.equal(season.bestWin.awayTeam,'U.S. Sassuolo Calcio');assert.equal(season.bestWin.margin,4);
  assert.deepEqual(season.keyPlayers.map((item:any)=>[item.name,item.appearances,item.goals,item.assists]),[
    ['Domenico Berardi',39,13,7],['Leonardo Pavoletti',33,12,2],['Giocatore con dato parziale',2,null,null],
  ]);
});

test('una stagione dichiarata ma vuota resta selezionabile e non trasforma le assenze in zeri',async()=>{
  const body=await (await fetch(`${base}/time-machine`)).json() as any,season=body.seasons.find((item:any)=>item.season==='2007/08');
  assert.equal(season.primaryCompetition,'Serie C1');assert.deepEqual(season.record,{matches:null,wins:null,draws:null,losses:null,goalsFor:null,goalsAgainst:null,points:null});
  assert.equal(season.bestWin,null);assert.deepEqual(season.keyPlayers,[]);assert.deepEqual(season.journey.points,[]);assert.equal(season.coverage.status,'unknown');
  assert.equal(typeof body.methodology,'string');assert.match(body.methodology,/null|N\/D/i);
});
