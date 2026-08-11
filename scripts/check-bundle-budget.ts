import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface ManifestChunk {
  file: string;
  imports?: string[];
  isEntry?: boolean;
}

export interface BundleBudgets {
  initialJavaScriptKiB: number;
  asyncChunkJavaScriptKiB: number;
}

export interface BundleMeasurement {
  initialBytes: number;
  largestChunkBytes: number;
  largestChunkFile: string;
  initialFiles: string[];
}

type Manifest = Record<string, ManifestChunk>;

function isJavaScript(file: string): boolean {
  return /\.(?:m?js)$/i.test(file);
}

export function measureBundle(manifest: Manifest, outputDirectory: string): BundleMeasurement {
  const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry);
  if (entries.length === 0) throw new Error('Il manifest Vite non contiene un entrypoint.');

  const initialKeys = new Set<string>();
  const visit = (key: string) => {
    if (initialKeys.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Import statico mancante nel manifest: ${key}`);
    initialKeys.add(key);
    for (const importedKey of chunk.imports ?? []) visit(importedKey);
  };
  for (const [key] of entries) visit(key);

  const initialFiles = [...initialKeys]
    .map((key) => manifest[key].file)
    .filter(isJavaScript);
  const initialBytes = initialFiles.reduce(
    (total, file) => total + fs.statSync(path.join(outputDirectory, file)).size,
    0
  );

  const javascriptFiles = [...new Set(Object.values(manifest).map((chunk) => chunk.file).filter(isJavaScript))];
  if (javascriptFiles.length === 0) throw new Error('Il manifest Vite non contiene file JavaScript.');
  const chunksBySize = javascriptFiles
    .map((file) => ({ file, bytes: fs.statSync(path.join(outputDirectory, file)).size }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    initialBytes,
    largestChunkBytes: chunksBySize[0].bytes,
    largestChunkFile: chunksBySize[0].file,
    initialFiles
  };
}

export function budgetFailures(measurement: BundleMeasurement, budgets: BundleBudgets): string[] {
  const failures: string[] = [];
  const initialLimit = budgets.initialJavaScriptKiB * 1024;
  const chunkLimit = budgets.asyncChunkJavaScriptKiB * 1024;
  if (measurement.initialBytes > initialLimit) {
    failures.push(`JavaScript iniziale ${formatKiB(measurement.initialBytes)} > budget ${budgets.initialJavaScriptKiB} KiB`);
  }
  if (measurement.largestChunkBytes > chunkLimit) {
    failures.push(
      `Chunk più grande ${measurement.largestChunkFile} (${formatKiB(measurement.largestChunkBytes)}) > budget ${budgets.asyncChunkJavaScriptKiB} KiB`
    );
  }
  return failures;
}

function formatKiB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function main() {
  const root = path.resolve();
  const outputDirectory = path.join(root, 'dist');
  const manifestPath = path.join(outputDirectory, '.vite', 'manifest.json');
  const budgetPath = path.join(root, 'bundle-budgets.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
  const budgets = JSON.parse(fs.readFileSync(budgetPath, 'utf8')) as BundleBudgets;
  const measurement = measureBundle(manifest, outputDirectory);
  const failures = budgetFailures(measurement, budgets);

  console.log(`JavaScript iniziale: ${formatKiB(measurement.initialBytes)} / ${budgets.initialJavaScriptKiB} KiB`);
  console.log(
    `Chunk più grande: ${measurement.largestChunkFile} (${formatKiB(measurement.largestChunkBytes)}) / ${budgets.asyncChunkJavaScriptKiB} KiB`
  );
  if (failures.length > 0) {
    for (const failure of failures) console.error(`BUDGET SUPERATO: ${failure}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
