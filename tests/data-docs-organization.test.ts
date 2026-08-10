import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

test('i documenti DATA_* non sono lasciati nella root del progetto', () => {
  const root = resolve(import.meta.dirname, '..');
  const misplaced = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.startsWith('DATA_'))
    .map(entry => entry.name);

  assert.deepEqual(
    misplaced,
    [],
    `Spostare i documenti in data/docs/: ${misplaced.join(', ')}`,
  );
});
