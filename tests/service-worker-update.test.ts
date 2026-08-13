import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import pkg from '../package.json' with { type: 'json' };

test('UX-09: la cache applicativa è versionata e gli aggiornamenti richiedono consenso', () => {
  const source = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(source, new RegExp(`sassuolo-history-shell-v${pkg.version.replaceAll('.', '\\.')}`));
  assert.doesNotMatch(source, /install[^;]+skipWaiting/s);
  assert.match(source, /SKIP_WAITING/);
});
