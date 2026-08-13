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
async function login(apiBase:string,token:string,name='Test curator'){
  const response=await fetch(`${apiBase}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,name})});
  assert.equal(response.status,200);const session=await response.json() as any;const cookie=response.headers.get('set-cookie')!;
  return {cookie,csrf:session.csrfToken,headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':session.csrfToken}};
}
const authenticated=await login(base,'test-admin-token-that-is-long');
after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('le letture sono pubbliche ma scritture e letture amministrative richiedono una sessione',async()=>{
  assert.equal((await fetch(`${base}/health`)).status,200);
  assert.equal((await fetch(`${base}/data-manager`)).status,401);
  assert.equal((await fetch(`${base}/current-season/matches/validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const missingCsrf=await fetch(`${base}/current-season/matches/validate`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:authenticated.cookie},body:'{}'});assert.equal(missingCsrf.status,403);
  const authorized=await fetch(`${base}/current-season/matches/validate`,{method:'POST',headers:authenticated.headers,body:'{}'});
  assert.notEqual(authorized.status,401);
});

test('il cookie di sessione è HttpOnly e logout revoca immediatamente la sessione',async()=>{
  const isolatedApp=createApp({adminToken:'logout-test-token-long',nodeEnv:'production'});const isolatedServer=isolatedApp.listen(0);const isolatedAddress=isolatedServer.address();if(!isolatedAddress||typeof isolatedAddress==='string')throw new Error('Server logout non disponibile');const isolatedBase=`http://127.0.0.1:${isolatedAddress.port}/api`;
  try{const auth=await login(isolatedBase,'logout-test-token-long');assert.match(auth.cookie,/HttpOnly/i);assert.match(auth.cookie,/SameSite=Strict/i);assert.match(auth.cookie,/Secure/i);assert.equal((await fetch(`${isolatedBase}/auth/session`,{headers:{Cookie:auth.cookie}})).status,200);assert.equal((await fetch(`${isolatedBase}/auth/logout`,{method:'POST',headers:auth.headers})).status,200);const afterLogout=await fetch(`${isolatedBase}/data-manager`,{headers:{Cookie:auth.cookie}});assert.equal(afterLogout.status,401);}finally{isolatedServer.close();}
});

test('una sessione scaduta non autorizza più le route amministrative',async()=>{
  const expiringApp=createApp({adminToken:'expiry-test-token-long',nodeEnv:'test',adminSessionTtlMs:10});const expiringServer=expiringApp.listen(0);const expiringAddress=expiringServer.address();if(!expiringAddress||typeof expiringAddress==='string')throw new Error('Server scadenza non disponibile');const expiringBase=`http://127.0.0.1:${expiringAddress.port}/api`;
  try{const auth=await login(expiringBase,'expiry-test-token-long');await new Promise(resolve=>setTimeout(resolve,25));assert.equal((await fetch(`${expiringBase}/data-manager`,{headers:{Cookie:auth.cookie}})).status,401);}finally{expiringServer.close();}
});

test('il rate limit protegge le operazioni di scrittura',async()=>{
  const limitedApp=createApp({adminToken:'rate-limit-test-token-long',nodeEnv:'test',mutationLimit:1});const limitedServer=limitedApp.listen(0);const limitedAddress=limitedServer.address();if(!limitedAddress||typeof limitedAddress==='string')throw new Error('Server rate limit non disponibile');const limitedBase=`http://127.0.0.1:${limitedAddress.port}/api`;const auth=await login(limitedBase,'rate-limit-test-token-long');const url=`${limitedBase}/current-season/matches/validate`;const init={method:'POST',headers:auth.headers,body:'{}'};
  try{assert.notEqual((await fetch(url,init)).status,429);assert.equal((await fetch(url,init)).status,429);}finally{limitedServer.close();}
});

test('i conflitti richiedono motivazione e possono essere riaperti con audit',async()=>{
  const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score) VALUES('security-conflict','2025-09-01','2025/26','Serie A','U.S. Sassuolo Calcio','Roma',1,0)`).run().lastInsertRowid);
  const conflictId=Number(db.prepare(`INSERT INTO data_conflicts(entity_type,entity_key,field,old_value,new_value,provider,status,created_at,updated_at) VALUES('match',?,'home_score','1','2','test','open',datetime('now'),datetime('now'))`).run(matchId).lastInsertRowid);
  const headers=authenticated.headers;
  const missingNote=await fetch(`${base}/manual/conflicts/${conflictId}/resolve`,{method:'POST',headers,body:JSON.stringify({choice:'new'})});assert.equal(missingNote.status,400);
  const resolved=await fetch(`${base}/manual/conflicts/${conflictId}/resolve`,{method:'POST',headers,body:JSON.stringify({choice:'new',note:'Referto verificato',reviewer:'Test curator',sourceUrl:'https://example.test/referto'})});assert.equal(resolved.status,200);
  assert.equal((db.prepare(`SELECT status FROM data_conflicts WHERE id=?`).get(conflictId) as any).status,'resolved');
  const reopened=await fetch(`${base}/manual/conflicts/${conflictId}/reopen`,{method:'POST',headers,body:JSON.stringify({note:'Nuova evidenza',reviewer:'Second reviewer'})});assert.equal(reopened.status,200);
  assert.equal((db.prepare(`SELECT status FROM data_conflicts WHERE id=?`).get(conflictId) as any).status,'open');
});
