import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { db, getSchemaVersion, initDb } from '../server/db/database.js';
import { getCoverageMatrix } from '../server/services/coverage.js';

const output=path.resolve('data/releases/current.json');
const check=process.argv.includes('--check');
if(check){
  if(!fs.existsSync(output))throw new Error('Manifest release dati assente');
  const manifest=JSON.parse(fs.readFileSync(output,'utf8'));
  for(const key of ['version','generatedAt','schemaVersion','databaseSha256','counts','coverage','imports','changes'])if(manifest[key]==null)throw new Error(`Manifest release: ${key} assente`);
  if(!/^sha256:[a-f0-9]{64}$/.test(manifest.databaseSha256))throw new Error('Checksum database release non valido');
  console.log(`Release dati ${manifest.version} valida (${manifest.databaseSha256}).`);process.exit(0);
}
initDb();db.pragma('wal_checkpoint(TRUNCATE)');
const args:Record<string,string|boolean>={};for(let index=2;index<process.argv.length;index++){const value=process.argv[index];if(!value.startsWith('--'))continue;const next=process.argv[index+1];args[value.slice(2)]=next&&!next.startsWith('--')?(index++,next):true;}
const version=String(args.version??process.env.DATA_RELEASE_VERSION??'').trim();if(!/^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/.test(version))throw new Error('Usare --version YYYY.MM.DD.N');
const generatedAt=new Date(String(args['generated-at']??process.env.SOURCE_DATE_EPOCH??new Date().toISOString())).toISOString();
const databaseFile=(db.pragma('database_list') as any[]).find(row=>row.name==='main')?.file;if(!databaseFile)throw new Error('Database principale assente');
const checksum=crypto.createHash('sha256').update(fs.readFileSync(databaseFile)).digest('hex');
const count=(table:string)=>Number((db.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as any).count);
const coverage=getCoverageMatrix();
const manifest={
  version,generatedAt,schemaVersion:getSchemaVersion(),databaseSha256:`sha256:${checksum}`,
  counts:{seasons:count('seasons'),matches:count('matches'),players:count('players'),playerSeasons:count('player_seasons'),sourceReferences:count('source_references')},
  coverage:{scopeVersion:coverage.scope.version,complete:coverage.rows.filter(row=>row.status==='complete').length,partial:coverage.rows.filter(row=>row.status==='partial').length,unknown:coverage.rows.filter(row=>row.status==='unknown').length},
  imports:db.prepare(`SELECT id,kind,source_provider AS sourceProvider,area,season,competition,status,finished_at AS finishedAt FROM import_runs WHERE status IN ('succeeded','partial') ORDER BY id`).all(),
  changes:db.prepare(`SELECT id,entity_type AS entityType,action,note,created_at AS createdAt FROM change_log ORDER BY id DESC LIMIT 100`).all(),
};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log(`Release dati ${version} generata: ${output}`);db.close();
