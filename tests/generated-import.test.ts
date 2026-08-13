import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

// Seed fisso: ogni regressione deve essere riproducibile localmente e in CI.
const SEED = 0x5a55010;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sassuolo-generated-import-'));
process.env.SASSUOLO_DB_PATH = path.join(tempRoot, 'generated-import.db');
const { applyControlledImport, parseImportFile, previewControlledImport } = await import('../server/services/controlledImport.js');
const { db } = await import('../server/db/database.js');

after(() => {
  db.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function random(seed = SEED) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

test('QA-05: 120 casi generati preservano Unicode, virgole e virgolette nel CSV', () => {
  const next = random();
  const fragments = ['Bérardi', 'D’Andrea', 'Rossi, Mario', 'Neri "Junior"', 'Łukasz', 'José'];
  const names = Array.from({ length: 120 }, (_, index) => `${fragments[Math.floor(next() * fragments.length)]} ${index}-${Math.floor(next() * 10_000)}`);
  const content = ['name,source_provider', ...names.map(name => `${csvCell(name)},generated-${SEED}`)].join('\n');
  const parsed = parseImportFile('generated.csv', content);
  assert.equal(parsed.rows.length, 120);
  assert.deepEqual(parsed.rows.map(row => row.name), names);
  const preview = previewControlledImport('players', 'generated.csv', content);
  assert.equal(preview.canApply, true);
  assert.equal(preview.validRows, 120);
});

test('QA-05: 120 input estremi sono rifiutati in modo deterministico senza eccezioni', () => {
  const next = random(SEED ^ 0xa11ce);
  for (let index = 0; index < 120; index++) {
    const appearances = Math.floor(next() * 20);
    const content = JSON.stringify([{ player_name: `Generated ${index}`, season: index % 2 ? '20x5/26' : '2025-26', competition: 'Serie A', appearances, starts: appearances + 1, source_provider: 'generated-test' }]);
    const preview = previewControlledImport('player-seasons', `invalid-${index}.json`, content);
    assert.equal(preview.canApply, false);
    assert.ok(preview.issues.some(issue => issue.code === 'invalid_season'));
    assert.ok(preview.issues.some(issue => issue.code === 'incompatible_stat'));
  }
});

test('QA-05: un errore a metà import annulla tutte le scritture', () => {
  const first = `__QA05_FIRST_${SEED}__`;
  const second = `__QA05_FAIL_${SEED}__`;
  db.exec(`CREATE TRIGGER qa05_force_mid_import_failure BEFORE INSERT ON players WHEN NEW.name='${second}' BEGIN SELECT RAISE(ABORT, 'qa05 forced failure'); END`);
  const content = JSON.stringify([
    { name: first, source_provider: 'generated-test' },
    { name: second, source_provider: 'generated-test' },
  ]);
  assert.throws(() => applyControlledImport('players', 'atomic.json', content), /qa05 forced failure/);
  assert.equal((db.prepare('SELECT count(*) AS total FROM players WHERE name IN (?,?)').get(first, second) as { total: number }).total, 0);
  assert.equal((db.pragma('integrity_check', { simple: true }) as string).toLowerCase(), 'ok');
});
