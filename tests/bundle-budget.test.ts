import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { budgetFailures, measureBundle } from '../scripts/check-bundle-budget';

test('bundle budget counts only static imports as initial JavaScript', () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sassuolo-bundle-'));
  try {
    for (const [file, size] of [
      ['assets/entry.js', 100],
      ['assets/shared.js', 50],
      ['assets/dashboard.js', 300]
    ] as const) {
      const target = path.join(outputDirectory, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.alloc(size));
    }
    const measurement = measureBundle(
      {
        'src/main.tsx': { file: 'assets/entry.js', imports: ['_shared.js'], isEntry: true },
        '_shared.js': { file: 'assets/shared.js' },
        'src/pages/Dashboard.tsx': { file: 'assets/dashboard.js' }
      },
      outputDirectory
    );

    assert.equal(measurement.initialBytes, 150);
    assert.equal(measurement.largestChunkBytes, 300);
    assert.deepEqual(budgetFailures(measurement, {
      initialJavaScriptKiB: 1,
      asyncChunkJavaScriptKiB: 1
    }), []);
    assert.equal(budgetFailures(measurement, {
      initialJavaScriptKiB: 0.1,
      asyncChunkJavaScriptKiB: 0.2
    }).length, 2);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});
