import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { getPublicArchiveStatus, publicArchiveStatusRss, upsertPublicReleaseEntry } from '../server/services/publicStatus.js';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-public-status-'));
const manifest={version:'2026.08.21.1',generatedAt:'2026-08-21T12:00:00.000Z',schemaVersion:11,databaseSha256:`sha256:${'a'.repeat(64)}`,counts:{seasons:30,matches:800,players:340,playerSeasons:900,sourceReferences:20000},coverage:{scopeVersion:1,complete:20,partial:8,unknown:4}};
const releaseEntry={id:'release-2026-08-21-1',type:'release',status:'published',publishedAt:'2026-08-21T12:00:00.000Z',title:'Release pubblica 2026.08.21.1',summary:'Una release completa con dati verificati e collegamenti consultabili.',coverage:['Serie A 2025/26'],links:[{label:'Apri metodologia',href:'/methodology'}],releaseVersion:'2026.08.21.1'};

function fixture(entries:any[]){
  const folder=fs.mkdtempSync(path.join(tempRoot,'case-')),releaseFile=path.join(folder,'current.json'),changelogFile=path.join(folder,'changelog.json');
  fs.writeFileSync(releaseFile,JSON.stringify(manifest));fs.writeFileSync(changelogFile,JSON.stringify({version:1,entries}));
  return {releaseFile,changelogFile};
}

after(()=>fs.rmSync(tempRoot,{recursive:true,force:true}));

test('lo stato pubblico ordina le voci e non inventa incidenti',()=>{
  const source={id:'source-statsbomb',type:'source',status:'published',publishedAt:'2026-08-20T12:00:00.000Z',title:'Nuova fonte verificata',summary:'Aggiunta una nuova fonte con perimetro e controlli dichiarati.',coverage:['Serie A 2015/16'],links:[{label:'Apri partite',href:'/matches?season=2015%2F16'}],releaseVersion:null};
  const status=getPublicArchiveStatus(fixture([source,releaseEntry]));
  assert.equal(status.status.level,'operational');
  assert.deepEqual(status.entries.map(entry=>entry.id),[releaseEntry.id,source.id]);
  assert.deepEqual(status.summary,{releases:1,sources:1,corrections:0,incidents:0});
  assert.equal(status.dataset.counts.matches,800);
  assert.equal(status.dataset.coverage.complete,20);
});

test('un incidente aperto degrada lo stato, uno risolto resta solo nella cronologia',()=>{
  const incident={id:'incident-sync-2026-08-21',type:'incident',status:'monitoring',publishedAt:'2026-08-21T13:00:00.000Z',title:'Aggiornamenti correnti rallentati',summary:'Il provider corrente risponde lentamente; i dati storici restano consultabili.',coverage:['Stagione corrente'],links:[{label:'Consulta lo stato',href:'/status'}],releaseVersion:null};
  const degraded=getPublicArchiveStatus(fixture([incident,releaseEntry]));
  assert.equal(degraded.status.level,'incident');assert.match(degraded.status.message,/provider corrente/i);
  const resolved=getPublicArchiveStatus(fixture([{...incident,status:'resolved'},releaseEntry]));
  assert.equal(resolved.status.level,'operational');assert.equal(resolved.summary.incidents,1);
});

test('il contratto rifiuta release scollegate, ID duplicati e URL non sicuri',()=>{
  assert.throws(()=>getPublicArchiveStatus(fixture([{...releaseEntry,releaseVersion:'2026.08.20.1'}])),/deve comparire una sola volta/);
  assert.throws(()=>getPublicArchiveStatus(fixture([releaseEntry,{...releaseEntry,type:'source',releaseVersion:null}])),/ID changelog duplicato/);
  assert.throws(()=>getPublicArchiveStatus(fixture([{...releaseEntry,links:[{label:'Non sicuro',href:'javascript:alert(1)'}]}])),/URL changelog non consentito/);
  assert.throws(()=>getPublicArchiveStatus(fixture([{...releaseEntry,links:[{label:'Host ambiguo',href:'//evil.example'}]}])),/URL changelog non consentito/);
  assert.throws(()=>getPublicArchiveStatus(fixture([{...releaseEntry,type:'incident',releaseVersion:null,status:'published'}])),/incidente deve essere/);
});

test('la pubblicazione della stessa release è idempotente e conserva lo storico',()=>{
  const source={id:'source-legacy',type:'source',status:'published',publishedAt:'2026-08-20T12:00:00.000Z',title:'Fonte storica verificata',summary:'Una fonte storica verificata rimane disponibile nello storico pubblico.',coverage:['Serie B 2008/09'],links:[{label:'Apri metodologia',href:'/methodology'}],releaseVersion:null};
  const first=upsertPublicReleaseEntry({version:1,entries:[releaseEntry,source]},{...releaseEntry,title:'Release aggiornata'});
  const second=upsertPublicReleaseEntry(first,{...releaseEntry,title:'Release aggiornata'});
  assert.equal(first.entries.length,2);assert.deepEqual(second,first);assert.equal(second.entries[0].title,'Release aggiornata');assert.equal(second.entries[1].id,source.id);
});

test('il feed RSS usa URL assoluti e codifica i testi editoriali',()=>{
  const special={id:'source-special-chars',type:'source',status:'published',publishedAt:'2026-08-21T13:00:00.000Z',title:'Fonte A & B <verificata>',summary:'Statistiche A & B confrontate con una seconda evidenza verificabile.',coverage:['Coppa Italia > ottavi'],links:[{label:'Apri fonte',href:'/methodology#sources'}],releaseVersion:null};
  const status=getPublicArchiveStatus(fixture([special,releaseEntry])),rss=publicArchiveStatusRss(status,'https://archive.example/');
  assert.match(rss,/https:\/\/archive\.example\/methodology#sources/);
  assert.match(rss,/Fonte A &amp; B &lt;verificata&gt;/);
  assert.doesNotMatch(rss,/<verificata>/);
  assert.throws(()=>publicArchiveStatusRss(status,'file:///tmp/archive'),/HTTP o HTTPS/);
});

test('API pubblica espone JSON validato e feed RSS',async()=>{
  process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'api.db');
  process.env.PUBLIC_APP_URL='https://archive.example';
  const {createApp}=await import('../server/app.js');
  const {db}=await import('../server/db/database.js');
  const app=createApp({nodeEnv:'test'}),server=app.listen(0),address=server.address();
  if(!address||typeof address==='string')throw new Error('Server test non disponibile');
  try{
    const base=`http://127.0.0.1:${address.port}/api`;
    const response=await fetch(`${base}/status`),body=await response.json() as any;
    assert.equal(response.status,200);assert.equal(body.dataset.version,'2026.08.13.1');assert.equal(body.status.level,'operational');
    const feed=await fetch(`${base}/status/feed.xml`),xml=await feed.text();
    assert.equal(feed.status,200);assert.match(feed.headers.get('content-type')??'',/application\/rss\+xml/);assert.match(xml,/https:\/\/archive\.example\/methodology/);
    const revalidated=await fetch(`${base}/status/feed.xml`,{headers:{'If-None-Match':feed.headers.get('etag')??''}});
    assert.equal(revalidated.status,304);assert.equal(await revalidated.text(),'');
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});
