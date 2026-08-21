import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { after,test } from 'node:test';
import Database from 'better-sqlite3';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-schema-compat-'));
const databasePath=path.join(tempRoot,'schema.db'),backupsPath=path.join(tempRoot,'backups');fs.mkdirSync(backupsPath);
const childEnvironment={...process.env,SASSUOLO_DB_PATH:databasePath,SASSUOLO_BACKUPS_DIR:backupsPath,NODE_ENV:'test'};
execFileSync(process.execPath,['--import','tsx',path.resolve('scripts/init-db.ts')],{cwd:process.cwd(),env:childEnvironment,stdio:'pipe'});
const legacy=new Database(databasePath);legacy.pragma('wal_checkpoint(TRUNCATE)');legacy.exec(fs.readFileSync(path.resolve('tests/fixtures/schema/v8.sql'),'utf8'));legacy.pragma('wal_checkpoint(TRUNCATE)');legacy.close();
const legacyBackupPath=path.join(backupsPath,'schema-v8.db');fs.copyFileSync(databasePath,legacyBackupPath);
process.env.SASSUOLO_DB_PATH=databasePath;process.env.SASSUOLO_BACKUPS_DIR=backupsPath;
const {db,getSchemaVersion,initDb,restoreBackupSnapshot,verifyBackupFile}=await import('../server/db/database.js');initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true})});

test('la fixture schema 8 migra alla versione corrente conservando gli invarianti',()=>{
  assert.equal(getSchemaVersion(),11);assert.equal(String(db.pragma('integrity_check',{simple:true})),'ok');assert.equal(String(db.pragma('foreign_key_check',{simple:true})??''),'');
  const columns=new Set((db.prepare(`PRAGMA table_info(player_match_conflicts)`).all() as any[]).map(row=>row.name));
  for(const column of ['resolution_action','resolved_player_id','reviewer','resolution_note','resolved_at','backup_id','decision_json'])assert.ok(columns.has(column));
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM players WHERE name='Giocatore fixture schema 8'`).get() as any).total,1);
  initDb();assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM schema_migrations WHERE version=11`).get() as any).total,1);
});

test('i dati della versione precedente possono essere ripristinati nel nuovo schema',()=>{
  const verification=verifyBackupFile(legacyBackupPath);assert.equal(verification.sha256,crypto.createHash('sha256').update(fs.readFileSync(legacyBackupPath)).digest('hex'));
  const backupId=Number(db.prepare(`INSERT INTO backup_runs(reason,file_path,sha256,size_bytes,verified_at,created_at) VALUES(?,?,?,?,?,?)`).run('qa-schema-v8',legacyBackupPath,verification.sha256,verification.sizeBytes,verification.verifiedAt,new Date().toISOString()).lastInsertRowid);
  db.prepare(`UPDATE players SET name='Valore da annullare' WHERE name='Giocatore fixture schema 8'`).run();
  restoreBackupSnapshot(backupId,verification.sha256,'QA-04');
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM players WHERE name='Giocatore fixture schema 8'`).get() as any).total,1);assert.equal(getSchemaVersion(),11);assert.equal(String(db.pragma('integrity_check',{simple:true})),'ok');
});
