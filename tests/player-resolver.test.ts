import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sassuolo-player-resolver-'));
process.env.SASSUOLO_DB_PATH = path.join(tempRoot, 'resolver.db');

const { db, initDb } = await import('../server/db/database.js');
const { resolvePlayer, seedHistoricalPlayerAliases } = await import('../server/services/playerResolver.js');

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
