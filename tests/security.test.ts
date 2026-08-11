import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-security-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'security.db');
const {createApp}=await import('../server/app.js');
const {db}=await import('../server/db/database.js');
const app=createApp({adminToken:'test-admin-token-that-is-long',nodeEnv:'test',mutationLimit:20});
const server=app.listen(0);const address=server.address();if(!address||typeof address==='string')throw new Error('Server test non disponibile');const base=`http://127.0.0.1:${address.port}/api`;
after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('le letture sono pubbliche ma le scritture richiedono il ruolo admin',async()=>{
  assert.equal((await fetch(`${base}/health`)).status,200);
  assert.equal((await fetch(`${base}/current-season/matches/validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const authorized=await fetch(`${base}/current-season/matches/validate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-admin-token-that-is-long','X-Admin-Name':'Test curator'},body:'{}'});
  assert.notEqual(authorized.status,401);
});

test('il rate limit protegge le operazioni di scrittura',async()=>{
  const limitedApp=createApp({adminToken:'rate-limit-test-token-long',nodeEnv:'test',mutationLimit:1});const limitedServer=limitedApp.listen(0);const limitedAddress=limitedServer.address();if(!limitedAddress||typeof limitedAddress==='string')throw new Error('Server rate limit non disponibile');const url=`http://127.0.0.1:${limitedAddress.port}/api/current-season/matches/validate`;const init={method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer rate-limit-test-token-long'},body:'{}'};
  try{assert.notEqual((await fetch(url,init)).status,429);assert.equal((await fetch(url,init)).status,429);}finally{limitedServer.close();}
});

test('i conflitti richiedono motivazione e possono essere riaperti con audit',async()=>{
  const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score) VALUES('security-conflict','2025-09-01','2025/26','Serie A','U.S. Sassuolo Calcio','Roma',1,0)`).run().lastInsertRowid);
  const conflictId=Number(db.prepare(`INSERT INTO data_conflicts(entity_type,entity_key,field,old_value,new_value,provider,status,created_at,updated_at) VALUES('match',?,'home_score','1','2','test','open',datetime('now'),datetime('now'))`).run(matchId).lastInsertRowid);
  const headers={'Content-Type':'application/json',Authorization:'Bearer test-admin-token-that-is-long','X-Admin-Name':'Test curator'};
  const missingNote=await fetch(`${base}/manual/conflicts/${conflictId}/resolve`,{method:'POST',headers,body:JSON.stringify({choice:'new'})});assert.equal(missingNote.status,400);
  const resolved=await fetch(`${base}/manual/conflicts/${conflictId}/resolve`,{method:'POST',headers,body:JSON.stringify({choice:'new',note:'Referto verificato',reviewer:'Test curator',sourceUrl:'https://example.test/referto'})});assert.equal(resolved.status,200);
  assert.equal((db.prepare(`SELECT status FROM data_conflicts WHERE id=?`).get(conflictId) as any).status,'resolved');
  const reopened=await fetch(`${base}/manual/conflicts/${conflictId}/reopen`,{method:'POST',headers,body:JSON.stringify({note:'Nuova evidenza',reviewer:'Second reviewer'})});assert.equal(reopened.status,200);
  assert.equal((db.prepare(`SELECT status FROM data_conflicts WHERE id=?`).get(conflictId) as any).status,'open');
});
