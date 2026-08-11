import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-ops-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'operations.db');
process.env.SASSUOLO_BACKUPS_DIR=path.join(tempRoot,'backups');
const {createBackupSnapshot,db,getSchemaVersion,initDb,restoreBackupSnapshot}=await import('../server/db/database.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('lo schema usa migrazioni versionate e include i metadati P0',()=>{
  assert.equal(getSchemaVersion(),7);
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM schema_migrations`).get() as any).total,7);
  const conflictColumns=new Set((db.prepare(`PRAGMA table_info(data_conflicts)`).all() as any[]).map(x=>x.name));
  assert.ok(conflictColumns.has('resolved_by'));assert.ok(conflictColumns.has('resolution_note'));
  const provenanceColumns=new Set((db.prepare(`PRAGMA table_info(source_references)`).all() as any[]).map(x=>x.name));
  assert.ok(provenanceColumns.has('import_run_id'));assert.ok(provenanceColumns.has('transformation'));
});

test('backup verificato e restore recuperano i dati creando uno snapshot di sicurezza',()=>{
  db.prepare(`INSERT INTO seasons(season,competition,points) VALUES('2040/41','Serie A',10)`).run();
  const backup=createBackupSnapshot('operations-test');assert.match(backup.sha256,/^[a-f0-9]{64}$/);assert.ok(backup.sizeBytes>0);
  db.prepare(`UPDATE seasons SET points=99 WHERE season='2040/41'`).run();
  const restored=restoreBackupSnapshot(backup.id,backup.sha256,'Test runner');
  assert.equal((db.prepare(`SELECT points FROM seasons WHERE season='2040/41'`).get() as any).points,10);
  assert.ok(restored.safetyBackupId>backup.id);
});
