import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('offline usa snapshot versionati e service worker senza intercettare le API',()=>{
  const api=fs.readFileSync('src/services/api.ts','utf8');
  const worker=fs.readFileSync('public/sw.js','utf8');
  assert.match(api,/sassuolo-history-cache:/);assert.match(api,/savedAt/);assert.match(api,/readCached/);
  assert.match(worker,/request\.mode==='navigate'/);assert.match(worker,/url\.pathname\.startsWith\('\/api\/'\)/);
});

test('release dichiara volume persistente, health check e backup esterno verificato',()=>{
  const docker=fs.readFileSync('Dockerfile','utf8');const compose=fs.readFileSync('compose.production.yml','utf8');const backup=fs.readFileSync('scripts/export-backup.ts','utf8');
  assert.match(docker,/VOLUME \["\/data"\]/);assert.match(compose,/\/api\/health/);assert.match(compose,/sassuolo_data:\/data/);
  assert.match(backup,/BACKUP_EXPORT_DIR/);assert.match(backup,/integrity_check/);assert.match(backup,/sha256/);
});
