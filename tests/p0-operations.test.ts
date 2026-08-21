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
  assert.equal(getSchemaVersion(),11);
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM schema_migrations`).get() as any).total,11);
  const conflictColumns=new Set((db.prepare(`PRAGMA table_info(data_conflicts)`).all() as any[]).map(x=>x.name));
  assert.ok(conflictColumns.has('resolved_by'));assert.ok(conflictColumns.has('resolution_note'));
  const provenanceColumns=new Set((db.prepare(`PRAGMA table_info(source_references)`).all() as any[]).map(x=>x.name));
  assert.ok(provenanceColumns.has('import_run_id'));assert.ok(provenanceColumns.has('transformation'));
  const specialEventColumns=new Set((db.prepare(`PRAGMA table_info(match_special_events)`).all() as any[]).map(x=>x.name));
  for(const field of ['event_type','effective_at','match_minute','remaining_minutes','reason','source_url','last_verified_at'])assert.ok(specialEventColumns.has(field));
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name='frontend_telemetry'`).get() as any).total,1);
  const ratingColumns=new Set((db.prepare(`PRAGMA table_info(match_player_stats)`).all() as any[]).map(x=>x.name));
  for(const field of ['archive_rating','archive_rating_version','archive_rating_confidence','archive_rating_level','archive_rating_breakdown_json'])assert.ok(ratingColumns.has(field));
});

test('gli avvenimenti particolari richiedono fonte e rispettano i vincoli temporali',()=>{
  const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,home_team,away_team) VALUES('special-test','2040-08-12','Sassuolo','Cesena')`).run().lastInsertRowid);
  db.prepare(`INSERT INTO match_special_events(match_id,event_type,effective_at,match_minute,remaining_minutes,description,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(matchId,'SUSPENDED','2040-08-12',74,17,'Sospesa per maltempo','Test','https://example.com/referto',new Date().toISOString());
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM match_special_events WHERE match_id=?`).get(matchId) as any).total,1);
  assert.throws(()=>db.prepare(`INSERT INTO match_special_events(match_id,event_type,effective_at,match_minute,description,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?)`).run(matchId,'SUSPENDED','2040-08-13',131,'Minuto impossibile','Test','https://example.com/referto',new Date().toISOString()),/CHECK constraint failed/);
});

test('backup verificato e restore recuperano i dati creando uno snapshot di sicurezza',()=>{
  db.prepare(`INSERT INTO seasons(season,competition,points) VALUES('2040/41','Serie A',10)`).run();
  const backup=createBackupSnapshot('operations-test');assert.match(backup.sha256,/^[a-f0-9]{64}$/);assert.ok(backup.sizeBytes>0);
  db.prepare(`UPDATE seasons SET points=99 WHERE season='2040/41'`).run();
  const restored=restoreBackupSnapshot(backup.id,backup.sha256,'Test runner');
  assert.equal((db.prepare(`SELECT points FROM seasons WHERE season='2040/41'`).get() as any).points,10);
  assert.ok(restored.safetyBackupId>backup.id);
});
