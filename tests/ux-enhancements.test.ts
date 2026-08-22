import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after,test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-ux-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'ux.db');
const {createApp}=await import('../server/app.js');
const {db}=await import('../server/db/database.js');
const app=createApp({nodeEnv:'test'});const server=app.listen(0);const address=server.address();
if(!address||typeof address==='string')throw new Error('Server test non disponibile');
const base=`http://127.0.0.1:${address.port}/api`;
after(()=>{server.close();db.close();fs.rmSync(tempRoot,{recursive:true,force:true})});

test('ricerca tollera refusi e alias e applica periodo e competizione a tutte le entità',async()=>{
  const playerId=Number(db.prepare(`INSERT INTO players(name,position) VALUES(?,?)`).run('Domenico Berardi','Attaccante').lastInsertRowid);
  db.prepare(`INSERT INTO player_name_aliases(player_id,alias,alias_normalized) VALUES(?,?,?)`).run(playerId,'Mimmo','mimmo');
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances) VALUES(?,?,?,?)`).run(playerId,'2024/25','Serie A',10);
  db.prepare(`INSERT INTO seasons(season,competition,matches) VALUES(?,?,?)`).run('2024/25','Serie A',38);
  db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team) VALUES(?,?,?,?,?,?)`).run('ux-search','2025-01-01','2024/25','Serie A','Sassuolo','Atalanta');
  const typo=await (await fetch(`${base}/search?q=Beradi&competition=Serie%20A&from=2024&to=2024`)).json() as any;
  assert.equal(typo.players[0].id,playerId);
  const alias=await (await fetch(`${base}/search?q=Mimmo`)).json() as any;
  assert.equal(alias.players[0].matched_alias,'Mimmo');
  const excluded=await (await fetch(`${base}/search?q=Berardi&competition=Serie%20B`)).json() as any;
  assert.equal(excluded.players.length,0);
});

test('confronti avanzati espongono normalizzazione, copertura e avviso di omogeneità',async()=>{
  const first=Number(db.prepare(`INSERT INTO players(name) VALUES(?)`).run('UX Player A').lastInsertRowid);const second=Number(db.prepare(`INSERT INTO players(name) VALUES(?)`).run('UX Player B').lastInsertRowid);
  const insert=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,minutes,goals,assists) VALUES(?,?,?,?,?,?,?)`);
  insert.run(first,'2024/25','Serie A',10,900,5,2);insert.run(second,'2024/25','Serie A',8,720,2,4);
  const response=await (await fetch(`${base}/compare/players?enhanced=1&a=${first}&b=${second}&competition=Serie%20A`)).json() as any;
  assert.equal(response.meta.homogeneous,true);assert.equal(response.items[0].normalized.goals_per_90,0.5);assert.equal(response.items[1].normalized.assists_per_90,0.5);
  const mixed=await (await fetch(`${base}/compare/players?enhanced=1&a=${first}&b=${second}`)).json() as any;
  assert.match(mixed.meta.warning,/competizione/i);
});

test('export dichiara NULL, unità, filtri, fonti e data di generazione',()=>{
  const source=fs.readFileSync(path.resolve('src/components/ViewActions.tsx'),'utf8');
  for(const token of ['generated_at','null_value','source_providers','filters','[${column.unit}]','window.print()'])assert.ok(source.includes(token),token);
});

test('la navigazione mobile mantiene le destinazioni principali e un overflow accessibile',()=>{
  const source=fs.readFileSync(path.resolve('src/layouts/AppLayout.tsx'),'utf8');
  for(const token of [
    "const mobilePrimaryPaths=new Set(['/','/current-season','/museum','/seasons','/players'])",
    '<MobileNavigation/>',
    'aria-controls="mobile-more-navigation"',
    'aria-label="Altre sezioni"',
    "event.key==='Escape'",
  ])assert.ok(source.includes(token),token);
});

test('la revisione identità mostra destinazione e impatto prima della conferma',async()=>{
  const playerId=Number(db.prepare(`INSERT INTO players(name,position) VALUES(?,?)`).run('Profilo Canonico UX','Centrocampista').lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,minutes) VALUES(?,?,?,?,?)`).run(playerId,'2023/24','Serie B',12,800);
  db.prepare(`INSERT INTO transfers(external_key,player_id,player_name,direction) VALUES(?,?,?,?)`).run('ux-identity-transfer',playerId,'Profilo Canonico UX','IN');
  const conflictId=Number(db.prepare(`INSERT INTO player_match_conflicts(raw_name,normalized_name,source_provider,source_player_id,context,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).run('P. Canonico','p. canonico','TestProvider','source-42','controlled-import:players:ux','ambiguous-abbreviation',new Date().toISOString(),new Date().toISOString()).lastInsertRowid);
  const response=await fetch(`${base}/player-identity-conflicts/${conflictId}/preview?playerId=${playerId}`);
  assert.equal(response.status,200);
  const preview=await response.json() as any;
  assert.equal(preview.target.name,'Profilo Canonico UX');
  assert.equal(preview.stats.seasons,1);
  assert.equal(preview.stats.appearances,12);
  assert.equal(preview.related.transfers,1);
  assert.equal(preview.incoming.player_seasons,0);
  assert.equal(preview.effects.alias_to_save,'P. Canonico');
  assert.equal(preview.effects.source_id_to_link,'TestProvider · source-42');
  const source=fs.readFileSync(path.resolve('src/pages/PlayerIdentityManager.tsx'),'utf8');
  for(const token of ['Effetto esatto:','Statistiche trasferite: 0','non trasferisce statistiche'])assert.ok(source.includes(token),token);
});
