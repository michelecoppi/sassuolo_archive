import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeNameForMatch } from '../server/db/database';

test('normalizeNameForMatch robust matching', () => {
  // Rogério → rogerio
  assert.strictEqual(normalizeNameForMatch('Rogério'), 'rogerio');
  assert.strictEqual(normalizeNameForMatch('Rogerio'), 'rogerio');

  // Šime Vrsaljko → sime vrsaljko
  assert.strictEqual(normalizeNameForMatch('Šime Vrsaljko'), 'sime vrsaljko');
  assert.strictEqual(normalizeNameForMatch('Sime Vrsaljko'), 'sime vrsaljko');

  // M'Bala Nzola → m'bala nzola
  assert.strictEqual(normalizeNameForMatch("M'Bala Nzola"), "m'bala nzola");
  assert.strictEqual(normalizeNameForMatch("M&apos;Bala Nzola"), "m'bala nzola");
  assert.strictEqual(normalizeNameForMatch("M&#39;Bala Nzola"), "m'bala nzola");

  // Mert Müldür → mert muldur
  assert.strictEqual(normalizeNameForMatch('Mert Müldür'), 'mert muldur');
  assert.strictEqual(normalizeNameForMatch('Mert Muldur'), 'mert muldur');

  // Gianmarco Ferrari vs Gian Marco Ferrari
  // Nota: il piano chiede se gestire lo spazio tra token. 
  // La specifica Fase 1.2 dice "collapse_whitespace(s).strip()". 
  // Quindi 'Gian Marco' rimane 'gian marco', mentre 'Gianmarco' è 'gianmarco'.
  // Questi non collimano automaticamente se non aggiungiamo la rimozione di TUTTI gli spazi,
  // ma il piano dice di gestirlo come alias se non automatico.
  // Verifichiamo il comportamento attuale.
  assert.strictEqual(normalizeNameForMatch('Gian Marco Ferrari'), 'gian marco ferrari');
  assert.strictEqual(normalizeNameForMatch('Gianmarco Ferrari'), 'gianmarco ferrari');
  
  // Apostrofi varianti
  assert.strictEqual(normalizeNameForMatch("N'Dicka"), "n'dicka");
  assert.strictEqual(normalizeNameForMatch("N’Dicka"), "n'dicka");
  assert.strictEqual(normalizeNameForMatch("N`Dicka"), "n'dicka");
  assert.strictEqual(normalizeNameForMatch("N´Dicka"), "n'dicka");

  // Whitespace
  assert.strictEqual(normalizeNameForMatch('  Filip   Djuricic  '), 'filip djuricic');
});
