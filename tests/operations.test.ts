import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-operations-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'operations.db');
const {createApp}=await import('../server/app.js');
const {db,nowIso}=await import('../server/db/database.js');
const app=createApp({adminToken:'operations-test-admin-token',nodeEnv:'test',cacheTtlMs:60_000});
const server=app.listen(0);
const address=server.address();
if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;
const login=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'operations-test-admin-token',name:'Operations test'})});
const loginBody=await login.json() as any;const adminHeaders={'Content-Type':'application/json',Cookie:login.headers.get('set-cookie')!,'X-CSRF-Token':loginBody.csrfToken};

after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('le GET usano ETag e cache, poi una scrittura riuscita invalida le risposte',async()=>{
  const first=await fetch(`${base}/seasons`);
  assert.equal(first.status,200);
  assert.equal(first.headers.get('x-cache'),'MISS');
  assert.equal(first.headers.get('cache-control'),'public, max-age=0, must-revalidate');
  const etag=first.headers.get('etag');
  assert.ok(etag);
  const firstBody=await first.text();

  const cached=await fetch(`${base}/seasons`);
  assert.equal(cached.headers.get('x-cache'),'HIT');
  assert.equal(await cached.text(),firstBody);

  const unchanged=await fetch(`${base}/seasons`,{headers:{'If-None-Match':etag}});
  assert.equal(unchanged.status,304);
  assert.equal(unchanged.headers.get('x-cache'),'HIT');

  const mutation=await fetch(`${base}/manual/players`,{method:'POST',headers:adminHeaders,body:JSON.stringify({name:'Cache Invalidation Test'})});
  assert.equal(mutation.status,200);
  const refreshed=await fetch(`${base}/seasons`);
  assert.equal(refreshed.headers.get('x-cache'),'MISS');
});

test('partite, giocatori, trasferimenti e liste amministrative applicano limiti server-side',async()=>{
  const insertPlayer=db.prepare(`INSERT INTO players(name,position,nationality,current_squad) VALUES(?,?,?,?)`);
  const insertTransfer=db.prepare(`INSERT INTO transfers(external_key,player_name,date,direction,season) VALUES(?,?,?,?,?)`);
  for(let index=0;index<65;index++){insertPlayer.run(`Paged Player ${String(index).padStart(2,'0')}`,'Attacker','Italia',1);insertTransfer.run(`paged-transfer-${index}`,`Paged Player ${String(index).padStart(2,'0')}`,'2099-07-01',index%2?'IN':'OUT','2099/00');}
  const players=await (await fetch(`${base}/players?page=2&pageSize=20&sort=name&direction=asc`)).json() as any;
  assert.equal(players.page,2);assert.equal(players.pageSize,20);assert.equal(players.rows.length,20);assert.ok(players.total>=65);
  const transfers=await (await fetch(`${base}/transfers?season=2099%2F00&page=2&pageSize=20`)).json() as any;
  assert.equal(transfers.total,65);assert.equal(transfers.rows.length,20);
  const manual=await (await fetch(`${base}/manual/players?page=1&pageSize=10&q=Paged`)).json() as any;
  assert.equal(manual.total,65);assert.equal(manual.rows.length,10);
  assert.ok(JSON.stringify(manual).length<JSON.stringify(await db.prepare(`SELECT * FROM players`).all()).length);
});

test('il proxy immagini rifiuta host non ammessi con un fallback stabile',async()=>{
  const response=await fetch(`${base}/assets/image?url=${encodeURIComponent('https://example.test/missing.jpg')}`);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type')??'',/image\/svg\+xml/);assert.match(await response.text(),/<svg/);
});

test('health pubblico è sintetico e la diagnostica completa richiede admin',async()=>{
  const started=nowIso();
  db.prepare(`INSERT INTO sync_state(provider,resource,requests_used,last_request,last_successful_sync,last_error) VALUES(?,?,?,?,?,?)`).run('test-provider','matches',3,started,started,'token=super-secret provider unavailable');
  db.prepare(`INSERT INTO import_runs(kind,source_provider,area,status,started_at,finished_at) VALUES('provider_sync','test-provider','matches','failed',?,?)`).run('2026-08-11T10:00:00.000Z','2026-08-11T10:00:02.000Z');

  const publicResponse=await fetch(`${base}/health`);const publicHealth=await publicResponse.json() as any;
  assert.deepEqual(Object.keys(publicHealth).sort(),['checkedAt','ok','service','status']);
  assert.equal((await fetch(`${base}/health/details`)).status,401);
  const response=await fetch(`${base}/health/details`,{headers:{Cookie:adminHeaders.Cookie}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const health=await response.json() as any;
  assert.equal(health.ok,true);
  assert.equal(health.status,'degraded');
  assert.equal(health.database.integrity,'ok');
  assert.ok(health.database.sizeBytes>0);
  assert.ok(health.database.checkDurationMs>=0);
  assert.ok(health.requests.total>=1);
  assert.ok(health.cache.invalidations>=1);
  assert.equal(health.lastSyncAt,started);
  assert.equal(health.providers[0].lastError,'token=[redacted] provider unavailable');
  assert.equal(health.recentImports[0].durationMs,2000);
  assert.doesNotMatch(JSON.stringify(health),/super-secret/);
});

test('lista e dettaglio giocatore usano gli stessi totali canonici senza trasformare N/D in zero',async()=>{
  const playerId=Number(db.prepare(`INSERT INTO players(name,appearances,minutes,goals,assists,current_squad) VALUES(?,?,?,?,?,?)`).run('Canonical Totals Test',999,999,999,999,1).lastInsertRowid);
  const insert=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists) VALUES(?,?,?,?,?,?,?,?)`);
  insert.run(playerId,'2098/99','Serie A',2,1,90,null,null);
  insert.run(playerId,'2099/00','Coppa Italia',3,null,null,null,0);

  const listResponse=await fetch(`${base}/players?sort=appearances&season=2099%2F00`);
  assert.equal(listResponse.status,200);
  const list=await listResponse.json() as any[];
  const summary=list.find(player=>player.id===playerId);
  assert.ok(summary);

  const detailResponse=await fetch(`${base}/players/${playerId}`);
  assert.equal(detailResponse.status,200);
  const detail=await detailResponse.json() as any;

  for(const field of ['appearances','starts','minutes','goals','assists'])assert.equal(summary[field],detail.player[field]);
  assert.equal(summary.appearances,5);
  assert.equal(summary.starts,1);
  assert.equal(summary.minutes,90);
  assert.equal(summary.goals,null);
  assert.equal(summary.assists,0);

  const otherId=Number(db.prepare(`INSERT INTO players(name,appearances,current_squad) VALUES(?,?,?)`).run('Canonical Comparison Test',777,1).lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals) VALUES(?,?,?,?,?)`).run(otherId,'2099/00','Serie A',4,1);
  const comparisonResponse=await fetch(`${base}/compare/players?a=${playerId}&b=${otherId}`);
  assert.equal(comparisonResponse.status,200);
  const comparison=await comparisonResponse.json() as any[];
  assert.equal(comparison[0].player.appearances,5);
  assert.equal(comparison[0].player.goals,null);
  assert.equal(comparison[1].player.appearances,4);
});

test('la lista giocatori ordina le statistiche in entrambe le direzioni e lascia N/D in fondo',async()=>{
  const insertPlayer=db.prepare(`INSERT INTO players(name,current_squad) VALUES(?,1)`);
  const insertSeason=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals,assists,minutes) VALUES(?,?,?,?,?,?,?)`);
  const lowId=Number(insertPlayer.run('Ascending Low Test').lastInsertRowid);
  const highId=Number(insertPlayer.run('Ascending High Test').lastInsertRowid);
  const unknownId=Number(insertPlayer.run('Ascending Unknown Test').lastInsertRowid);
  insertSeason.run(lowId,'2100/01','Serie A',1,2,3,100);
  insertSeason.run(highId,'2100/01','Serie A',2,8,4,200);
  insertSeason.run(unknownId,'2100/01','Serie A',3,null,5,300);

  const ascending=await (await fetch(`${base}/players?season=2100%2F01&sort=goals&direction=asc`)).json() as any[];
  assert.deepEqual(ascending.map(player=>player.id),[lowId,highId,unknownId]);

  const descending=await (await fetch(`${base}/players?season=2100%2F01&sort=goals&direction=desc`)).json() as any[];
  assert.deepEqual(descending.map(player=>player.id),[highId,lowId,unknownId]);
});
