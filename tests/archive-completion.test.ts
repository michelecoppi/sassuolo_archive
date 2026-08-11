import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after,test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-archive-completion-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'archive-completion.db');
const {createApp}=await import('../server/app.js');
const {db}=await import('../server/db/database.js');
const server=createApp({adminToken:'archive-completion-admin-token',nodeEnv:'test'}).listen(0);
const address=server.address();if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;const adminHeaders={'Content-Type':'application/json',Authorization:'Bearer archive-completion-admin-token','X-Admin-Name':'Archivista test'};
after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('Club e Timeline condividono gli stessi eventi strutturati e fonti',async()=>{
  const club=await (await fetch(`${base}/club-history`)).json() as any;
  const timeline=await (await fetch(`${base}/timeline`)).json() as any[];
  assert.deepEqual(timeline,club.milestones);assert.ok(club.honours.length>=4);assert.ok(club.venues.length>=3);assert.ok(club.leadership.length>=3);assert.ok(club.kitHistory.length>=2);
  assert.ok(timeline.every(event=>event.date&&event.title&&/^https:\/\//.test(event.sourceUrl)));
});

test('archivio tecnico conserva incarichi multipli, stagioni e staff senza inferenze',async()=>{
  const archive=await (await fetch(`${base}/coaches`)).json() as any;
  const diFrancesco=archive.profiles.find((profile:any)=>profile.coach==='Eusebio Di Francesco');
  assert.equal(diFrancesco.terms.length,2);assert.ok(diFrancesco.terms.every((term:any)=>term.startDate&&term.seasons.length&&term.sourceUrl));
  const promotion=archive.staffTerms.find((staff:any)=>staff.season==='2024/25');assert.equal(promotion.coach,'Fabio Grosso');assert.ok(promotion.members.some((member:any)=>member.name==='Paolo Orlandoni'));
  const current=archive.staffTerms.find((staff:any)=>staff.season==='2026/27');assert.equal(current.coach,'Alberto Aquilani');assert.ok(current.members.some((member:any)=>member.role==='Match analyst'));
});

test('movimenti rosa espongono sessione, costo, fonte e identità riconciliata',async()=>{
  const playerId=Number(db.prepare(`INSERT INTO players(name) VALUES(?)`).run('Transfer Test Player').lastInsertRowid);
  db.prepare(`INSERT INTO transfers(external_key,player_id,player_name,date,type,direction,from_team_name,to_team_name,season,movement_type,session,fee_amount,fee_currency,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`).run('transfer-test',playerId,'Transfer Test Player','2026-01-10','Loan','IN','Club A','Sassuolo','2025/26','LOAN','WINTER',1500000,'EUR','test','https://example.test/transfer');
  db.prepare(`INSERT INTO transfers(external_key,player_name,date,type,direction,from_team_name,to_team_name,season,movement_type,session) VALUES(?,?,?,?,?,?,?,?,?,?)`).run('transfer-unresolved','Unresolved Player','2025-07-01','Free','OUT','Sassuolo','Club B','2025/26','FREE','SUMMER');
  const winter=await (await fetch(`${base}/transfers?season=2025%2F26&session=WINTER&movement=LOAN`)).json() as any[];
  assert.equal(winter.length,1);assert.equal(winter[0].fee_currency,'EUR');assert.equal(winter[0].identity_status,'reconciled');assert.equal(winter[0].source_url,'https://example.test/transfer');
  const unresolved=await (await fetch(`${base}/transfers?session=SUMMER`)).json() as any[];assert.equal(unresolved[0].identity_status,'unresolved');
});

test('una segnalazione pubblica entra in coda e solo la revisione alimenta il change log',async()=>{
  const submitted=await fetch(`${base}/corrections`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'season',entityId:'2012/13',field:'manager',currentValue:'A',proposedValue:'B',sourceUrl:'https://example.test/source',explanation:'La fonte ufficiale indica il valore B.'})});
  assert.equal(submitted.status,201);const {id}=await submitted.json() as any;
  assert.equal((db.prepare(`SELECT status FROM correction_requests WHERE id=?`).get(id) as any).status,'pending');
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM change_log WHERE entity_type='correction_request' AND entity_id=?`).get(id) as any).count,0);
  assert.equal((await fetch(`${base}/corrections`)).status,401);
  const denied=await fetch(`${base}/corrections/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'approved',reviewer:'X',note:'Verificata'})});assert.equal(denied.status,401);
  const approved=await fetch(`${base}/corrections/${id}`,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({status:'approved',reviewer:'Archivista test',note:'Fonte verificata; applicazione separata.'})});assert.equal(approved.status,200);
  const change=db.prepare(`SELECT action,source_url,author FROM change_log WHERE entity_type='correction_request' AND entity_id=?`).get(id) as any;assert.equal(change.action,'approve-correction');assert.equal(change.author,'Archivista test');assert.equal(change.source_url,'https://example.test/source');
});

test('le partite Europa League sono separate in qualificazioni e girone con aggregati coerenti',()=>{
  const file=path.join(process.cwd(),'data','matches','sassuolo-europa-league-2016-17.json');
  const matches=JSON.parse(fs.readFileSync(file,'utf8')) as any[];
  const qualifiers=matches.filter(match=>/qualificazione|play-off/i.test(match.round));
  const group=matches.filter(match=>/gironi/i.test(match.round));
  assert.equal(qualifiers.length,4);assert.equal(group.length,6);
  let wins=0,draws=0,losses=0,goalsFor=0,goalsAgainst=0;
  for(const match of matches){const home=/sassuolo/i.test(match.home_team);const scored=home?match.home_score:match.away_score;const conceded=home?match.away_score:match.home_score;goalsFor+=scored;goalsAgainst+=conceded;if(scored>conceded)wins++;else if(scored===conceded)draws++;else losses++;}
  assert.deepEqual({wins,draws,losses,goalsFor,goalsAgainst},{wins:3,draws:4,losses:3,goalsFor:17,goalsAgainst:13});
});
