import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.equal(preview.validRows, 0);
  assert.equal(preview.discardedRows, 1);
  assert.ok(preview.issues.some(issue => issue.code === 'missing_source'));
  assert.ok(preview.issues.some(issue => issue.code === 'incompatible_stat'));
});

test('il dry-run valido produce checksum e conteggi senza scrivere nel DB', () => {
  const preview = previewControlledImport('players', 'players.json', JSON.stringify([
    { name: '__CONTROLLED_IMPORT_PREVIEW_ONLY__', source_provider: 'test-fixture' },
  ]));
  assert.equal(preview.canApply, true);
  assert.equal(preview.created, 1);
  assert.equal(preview.rowPreview[0].status, 'valid');
  assert.match(preview.checksum, /^[a-f0-9]{64}$/);
});

test('il dry-run accetta un capitano verificato e rifiuta flag diversi da 0 o 1', () => {
  const valid = previewControlledImport('player-seasons', 'captain.csv', [
    'player_name,season,competition,captain,source_provider,source_url',
    'Domenico Berardi,2024/25,Serie B,1,Lega Serie B,https://www.legab.it/news/il-sassuolo-alza-la-coppa-nexus',
  ].join('\n'));
  assert.equal(valid.canApply, true);
  const invalid = previewControlledImport('player-seasons', 'captain.csv', [
    'player_name,season,competition,captain,source_provider',
    'Domenico Berardi,2024/25,Serie B,2,Lega Serie B',
  ].join('\n'));
  assert.equal(invalid.canApply, false);
  assert.ok(invalid.issues.some(issue => issue.code === 'invalid_flag'));
});

test('il dry-run riconosce tutti i campi della tranche Coppa Italia 2013/14',()=>{
  const content=fs.readFileSync('data/reconciliation/candidates/matches-coppa-italia-2013-14/data.csv','utf8');
  const preview=previewControlledImport('matches','data.csv',content);
  assert.equal(preview.canApply,true);assert.equal(preview.rows,2);assert.equal(preview.created+preview.updated,2);
  assert.ok(preview.columnMappings.every(mapping=>mapping.recognized));
});
