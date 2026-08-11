import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-admin-enhancements-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'admin.db');
const {createApp}=await import('../server/app.js');
const {db,nowIso}=await import('../server/db/database.js');
const {createAdminApiClient}=await import('../src/services/adminApiClient.js');
const {createSyncScheduler}=await import('../server/services/syncScheduler.js');
const app=createApp({nodeEnv:'test',adminToken:null,cacheTtlMs:1});
const server=app.listen(0);const address=server.address();
if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;
after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('preview espone mapping, righe valide/scartate e client TypeScript validato',async()=>{
  const client=createAdminApiClient(base);
  const preview=await client.previewImport({entity:'matches',filename:'matches.csv',content:[
    'date,season,competition,homeTeam,awayTeam,sourceProvider',
    '2026-08-10,2026/27,Serie A,Sassuolo,Napoli,test',
  ].join('\n')});
  assert.equal(preview.validRows,1);assert.equal(preview.discardedRows,0);
  assert.equal(preview.columnMappings.find(column=>column.source==='homeTeam')?.target,'home_team');
  assert.equal(preview.rowPreview[0].action,'create');
});

test('OpenAPI è servito dalla API reale con versione ed esempi amministrativi',async()=>{
  const response=await fetch(`${base}/openapi.json`);const document=await response.json() as any;
  assert.equal(response.headers.get('x-api-version'),'1.0.0');assert.equal(document.openapi,'3.1.0');
  assert.ok(document.paths['/import/preview']);assert.ok(document.paths['/data-quality/{issueKey}']);assert.ok(document.paths['/sync/jobs/{name}/run']);
});

test('workflow qualità conserva stato e responsabile per la stessa anomalia',async()=>{
  const result=db.prepare(`INSERT INTO data_conflicts(entity_type,entity_key,field,old_value,new_value,provider,status,created_at) VALUES('match','99','score','1','2','test','open',?)`).run(nowIso());
  const issueKey=`conflict-${result.lastInsertRowid}`;
  const update=await fetch(`${base}/data-quality/${issueKey}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'in_progress',assignee:'Archivista',note:'Fonte in verifica'})});
  assert.equal(update.status,200);
  const quality=await (await fetch(`${base}/data-quality`)).json() as any;const issue=quality.issues.find((item:any)=>item.id===issueKey);
  assert.equal(issue.status,'in_progress');assert.equal(issue.assignee,'Archivista');assert.equal(issue.suggestedAction,issue.actionLabel);
});

test('scheduler applica lock, idempotenza e retry con alert azionabile',async()=>{
  let calls=0;const scheduler=createSyncScheduler(db,[{name:'test-retry',scheduleMinutes:5,maxAttempts:3,task:async()=>{calls++;if(calls<2)throw new Error('provider temporaneamente non disponibile');return {stored:1};}}],{backoffMs:1,lockMs:1_000});
  const [first,concurrent]=await Promise.all([scheduler.run('test-retry','slot-1'),scheduler.run('test-retry','slot-1')]);
  assert.equal(first.ok,true);assert.equal(first.attempts,2);assert.equal(concurrent.deduplicated,true);assert.equal(calls,2);
  let failures=0;const failing=createSyncScheduler(db,[{name:'test-failure',maxAttempts:2,task:async()=>{failures++;throw new Error('quota provider esaurita');}}],{backoffMs:1});
  const failed=await failing.run('test-failure','slot-failure');assert.equal(failed.ok,false);assert.equal(failures,2);
  const status=failing.status().jobs.find((job:any)=>job.job_name==='test-failure') as any;assert.match(status.last_alert,/Azione:/);
});
