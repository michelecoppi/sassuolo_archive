import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-telemetry-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'telemetry.db');
const {createApp}=await import('../server/app.js');
const {db}=await import('../server/db/database.js');
const {sanitizeFrontendTelemetry}=await import('../server/services/frontendTelemetry.js');
const {normalizeClientRoute,shouldSample}=await import('../src/services/telemetry.js');
const app=createApp({adminToken:'telemetry-admin-token-long',nodeEnv:'test',mutationLimit:20});
const server=app.listen(0);const address=server.address();if(!address||typeof address==='string')throw new Error('Server telemetria non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;
after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('route, contenuti sensibili e contesto vengono minimizzati',()=>{
  const event=sanitizeFrontendTelemetry({eventType:'exception',release:'0.5.0',route:'/players/123?search=Mario&token=secret',online:false,message:'Errore per mario@example.com token=supersecret https://example.test/a?q=privata',stack:'Bearer abc.def.ghi',context:{component:'Player',query:'privata',token:'segreto'}});
  assert.equal(event.route,'/players/:id');assert.equal(event.online,0);
  assert.doesNotMatch(event.message??'',/mario@example|supersecret|privata/);assert.ok(event.stackHash);assert.deepEqual(event.context,{component:'Player'});
});

test('campionamento Web Vitals e normalizzazione client sono deterministici',()=>{
  assert.equal(shouldSample('exception',0.99),true);assert.equal(shouldSample('web_vital',0.19),true);assert.equal(shouldSample('web_vital',0.2),false);
  assert.equal(normalizeClientRoute('/seasons/2025%2F26?search=Berardi'),'/seasons/:season');
});

test('evento pubblico consultabile solo dalla sessione admin',async()=>{
  const posted=await fetch(`${base}/telemetry/frontend`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType:'boundary',release:'0.5.0',route:'/matches/987?q=privata',online:true,message:'Boundary di test',stack:'stack tecnico',context:{component:'La pagina'}})});
  assert.equal(posted.status,202);assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM security_audit_log WHERE path='/telemetry/frontend'`).get() as any).count,0);assert.equal((await fetch(`${base}/telemetry/frontend/summary`)).status,401);
  const login=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'telemetry-admin-token-long',name:'Test'})});
  const cookie=login.headers.get('set-cookie')!;
  const summaryResponse=await fetch(`${base}/telemetry/frontend/summary`,{headers:{Cookie:cookie}});const summary=await summaryResponse.json() as any;
  assert.equal(summaryResponse.status,200);assert.equal(summary.recent[0].release,'0.5.0');assert.equal(summary.recent[0].route,'/matches/:id');assert.equal(summary.recent[0].context.component,'La pagina');assert.equal(summary.retentionDays,30);
});
