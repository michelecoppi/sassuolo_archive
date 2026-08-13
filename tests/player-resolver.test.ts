import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sassuolo-player-resolver-'));
process.env.SASSUOLO_DB_PATH = path.join(tempRoot, 'resolver.db');
process.env.SASSUOLO_BACKUPS_DIR = path.join(tempRoot, 'backups');

const { db, initDb } = await import('../server/db/database.js');
const { reopenPlayerIdentityConflict, resolvePlayer, resolvePlayerIdentityConflict, seedHistoricalPlayerAliases } = await import('../server/services/playerResolver.js');

function clearDb() {
  db.exec(`DELETE FROM player_match_conflicts; DELETE FROM player_name_aliases; DELETE FROM player_source_ids; DELETE FROM player_seasons; DELETE FROM players;`);
}

before(() => initDb());
after(() => { db.close(); fs.rmSync(tempRoot, { recursive: true, force: true }); });

test('resolvePlayer uses source provider ids before name matching', () => {
  clearDb();
  const playerId = Number(db.prepare(`INSERT INTO players(name) VALUES('Domenico Berardi')`).run().lastInsertRowid);
  db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id) VALUES(?,?,?)`).run(playerId, 'StatBunker', '42');
  const resolved = resolvePlayer({ name: 'D. Berardi', sourceProvider: 'StatBunker', sourcePlayerId: '42', allowCreate: false });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.playerId, playerId);
  assert.equal(resolved.matchedBy, 'source-id');
});

test('resolvePlayer uses seeded aliases and does not create duplicates', () => {
  clearDb();
  const playerId = Number(db.prepare(`INSERT INTO players(name) VALUES(?)`).run('Gian Marco Ferrari').lastInsertRowid);
  seedHistoricalPlayerAliases();
  const resolved = resolvePlayer({ name: 'Gianmarco Ferrari', sourceProvider: 'verified', allowCreate: false });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.playerId, playerId);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM players`).get() as any).count, 1);
});

test('resolvePlayer queues ambiguous abbreviations instead of guessing', () => {
  clearDb();
  db.prepare(`INSERT INTO players(name) VALUES('Andrea Rossi'),('Alessio Rossi')`).run();
  const resolved = resolvePlayer({ name: 'A. Rossi', sourceProvider: 'manual', allowCreate: false, context: 'test-ambiguity' });
  assert.equal(resolved.status, 'conflict');
  assert.equal(resolved.reason, 'ambiguous-abbreviation');
  assert.equal(resolved.candidates.length, 2);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM player_match_conflicts WHERE status='open'`).get() as any).count, 1);
});

test('resolvePlayer auto-learns canonical normalized matches as aliases', () => {
  clearDb();
  const playerId = Number(db.prepare(`INSERT INTO players(name) VALUES(?)`).run('Rogério').lastInsertRowid);
  const resolved = resolvePlayer({ name: 'Rogerio', sourceProvider: 'archive', allowCreate: false });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.playerId, playerId);
  assert.equal((db.prepare(`SELECT player_id FROM player_name_aliases WHERE alias_normalized='rogerio'`).get() as any).player_id, playerId);
});

test('resolvePlayer rejects a same-name player with a different provider id', () => {
  clearDb();
  const playerId = Number(db.prepare(`INSERT INTO players(name,source_provider,source_external_id) VALUES(?,?,?)`).run('Flavio Russo', 'api-football', '330758').lastInsertRowid);
  db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id) VALUES(?,?,?)`).run(playerId, 'api-football', '330758');
  const resolved = resolvePlayer({ name: 'Flavio Russo', sourceProvider: 'api-football', sourcePlayerId: '30766', allowCreate: true });
  assert.equal(resolved.status, 'conflict');
  assert.equal(resolved.reason, 'canonical-name-source-id-mismatch');
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM players`).get() as any).count, 1);
});

test('la revisione identità richiede evidenza, crea un backup ed è annullabile',()=>{
  clearDb();const playerId=Number(db.prepare(`INSERT INTO players(name) VALUES('Andrea Rossi')`).run().lastInsertRowid);db.prepare(`INSERT INTO players(name) VALUES('Alessio Rossi')`).run();
  const conflict=resolvePlayer({name:'A. Rossi',sourceProvider:'Wyscout',sourcePlayerId:'ws-10',sourceUrl:'https://example.test/player/ws-10',context:'player-season:2017/18',allowCreate:false});assert.equal(conflict.status,'conflict');if(conflict.status!=='conflict')return;
  assert.throws(()=>resolvePlayerIdentityConflict(conflict.conflictId,{action:'merge',playerId,reviewer:'Curatore',note:''}),/motivazione/i);
  const resolved=resolvePlayerIdentityConflict(conflict.conflictId,{action:'merge',playerId,reviewer:'Curatore QA',note:'Distinta ufficiale e data di nascita compatibili'});assert.ok(resolved.backupId);
  const decision=db.prepare(`SELECT status,reviewer,resolution_note,backup_id FROM player_match_conflicts WHERE id=?`).get(conflict.conflictId) as any;assert.equal(decision.status,'resolved');assert.equal(decision.reviewer,'Curatore QA');assert.ok(decision.backup_id);
  assert.equal((db.prepare(`SELECT player_id FROM player_source_ids WHERE source_provider='Wyscout' AND source_player_id='ws-10'`).get() as any).player_id,playerId);
  const reopened=reopenPlayerIdentityConflict(conflict.conflictId,'Secondo revisore','Nuova fonte contraddittoria');assert.ok(reopened.backupId);assert.equal((db.prepare(`SELECT status FROM player_match_conflicts WHERE id=?`).get(conflict.conflictId) as any).status,'open');assert.equal(db.prepare(`SELECT 1 FROM player_source_ids WHERE source_provider='Wyscout' AND source_player_id='ws-10'`).get(),undefined);
});
