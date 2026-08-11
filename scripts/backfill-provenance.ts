import { backfillFieldProvenance, createBackupSnapshot, initDb } from '../server/db/database.js';

initDb();
const backup=createBackupSnapshot('before-provenance-backfill');
const result=backfillFieldProvenance();
console.log(JSON.stringify({ok:true,backupId:backup.id,backupSha256:backup.sha256,...result},null,2));
