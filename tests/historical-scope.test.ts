import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadHistoricalScope, validateHistoricalScope } from '../server/services/historicalScope.js';

test('historical scope is continuous and every declared gap is motivated', () => {
  const scope = loadHistoricalScope();
  assert.equal(scope.startSeason, '2007/08');
  assert.equal(scope.endSeason, '2026/27');
  assert.deepEqual(validateHistoricalScope(scope), []);
  assert.equal(new Set(scope.entries.map(entry => entry.season)).size, 20);
  assert.ok(scope.entries.every(entry => entry.gapReason.trim().length > 0));
});

test('historical scope keeps league, postseason and cups separate', () => {
  const scope = loadHistoricalScope();
  const kinds = new Set(scope.entries.map(entry => entry.kind));
  for (const kind of ['league', 'playoff', 'domestic_cup', 'continental_cup', 'super_cup']) assert.ok(kinds.has(kind), `missing scope kind: ${kind}`);
  assert.deepEqual(scope.entries.filter(entry => entry.kind === 'playoff').map(entry => entry.season), ['2009/10', '2011/12']);
  assert.ok(scope.entries.some(entry => entry.season === '2007/08' && entry.competition === 'Coppa Italia Serie C'));
  assert.ok(scope.entries.some(entry => entry.season === '2016/17' && entry.competition === 'Europa League'));
});

