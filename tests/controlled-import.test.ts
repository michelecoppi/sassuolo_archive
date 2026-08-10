import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImportFile, previewControlledImport } from '../server/services/controlledImport.js';

test('il parser CSV gestisce virgolette e rifiuta intestazioni duplicate', () => {
  assert.deepEqual(parseImportFile('players.csv', 'name,source_provider\n"Rossi, Mario",archive\n').rows, [
    { name: 'Rossi, Mario', source_provider: 'archive' },
  ]);
  assert.throws(() => parseImportFile('bad.csv', 'name,name\na,b\n'), /duplicate/);
});

test('il dry-run blocca righe senza fonte e statistiche incompatibili', () => {
  const preview = previewControlledImport('player-seasons', 'stats.csv', [
    'player_name,season,competition,appearances,starts',
    'Giocatore Test,2025/26,Serie A,2,3',
  ].join('\n'));
  assert.equal(preview.canApply, false);
  assert.ok(preview.issues.some(issue => issue.code === 'missing_source'));
  assert.ok(preview.issues.some(issue => issue.code === 'incompatible_stat'));
});

test('il dry-run valido produce checksum e conteggi senza scrivere nel DB', () => {
  const preview = previewControlledImport('players', 'players.json', JSON.stringify([
    { name: '__CONTROLLED_IMPORT_PREVIEW_ONLY__', source_provider: 'test-fixture' },
  ]));
  assert.equal(preview.canApply, true);
  assert.equal(preview.created, 1);
  assert.match(preview.checksum, /^[a-f0-9]{64}$/);
});
