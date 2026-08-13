import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';

test('la documentazione generale è raccolta sotto docs/', () => {
  const root = resolve(import.meta.dirname, '..');
  const misplaced = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map(entry => entry.name);

  assert.deepEqual(
    misplaced,
    [],
    `Spostare i documenti generali in docs/: ${misplaced.join(', ')}`,
  );
  const categories = new Set(readdirSync(resolve(root, 'docs'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name));
  for (const category of ['product', 'setup', 'operations', 'quality', 'data', 'architecture']) assert.ok(categories.has(category), `Categoria docs/${category} assente`);
});

test('gli ADR accettati hanno formato uniforme e sono indicizzati', () => {
  const root = resolve(import.meta.dirname, '..');
  const directory = resolve(root, 'docs/architecture');
  const index = readFileSync(resolve(directory, 'README.md'), 'utf8');
  const decisions = readdirSync(directory).filter(name => /^\d{4}-.+\.md$/.test(name));
  assert.ok(decisions.length >= 5);
  for (const name of decisions) {
    const content = readFileSync(resolve(directory, name), 'utf8');
    assert.match(content, /^# ADR-\d{4} — .+/);
    assert.match(content, /- Stato: (?:Proposto|Accettato|Sostituito)/);
    assert.match(content, /## Contesto[\s\S]+## Decisione[\s\S]+## Conseguenze/);
    assert.match(index, new RegExp(`\\(${name.replace('.', '\\.')}\\)`));
  }
});

test('l’indice documentale non contiene collegamenti locali rotti', () => {
  const root = resolve(import.meta.dirname, '..');
  const markdownFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? markdownFiles(resolve(directory, entry.name)) : entry.name.endsWith('.md') ? [resolve(directory, entry.name)] : [],
  );
  const files = [resolve(root, 'README.md'), ...markdownFiles(resolve(root, 'docs'))];
  const broken: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#', 1)[0].trim().replace(/^<|>$/g, '');
      if (!target || /^(?:https?:|mailto:)/i.test(target)) continue;
      if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) broken.push(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});
