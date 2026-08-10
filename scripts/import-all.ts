import { initDb } from '../server/db/database.js';
import { importAll } from '../server/services/importer.js';
import { execFileSync } from 'node:child_process';
initDb();
console.log('Import complete:', importAll());
execFileSync(process.execPath,['--import','tsx','scripts/reconcile-history.ts'],{stdio:'inherit'});
