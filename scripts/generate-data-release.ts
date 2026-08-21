import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { db, getSchemaVersion, initDb } from '../server/db/database.js';
import { getCoverageMatrix } from '../server/services/coverage.js';
import { getPublicArchiveStatus, isPublicChangelogHref, upsertPublicReleaseEntry } from '../server/services/publicStatus.js';

const output=path.resolve('data/releases/current.json');
const changelogOutput=path.resolve('data/releases/changelog.json');
const check=process.argv.includes('--check');
if(check){
  if(!fs.existsSync(output))throw new Error('Manifest release dati assente');
  const manifest=JSON.parse(fs.readFileSync(output,'utf8'));
  for(const key of ['version','generatedAt','schemaVersion','databaseSha256','counts','coverage','imports','changes'])if(manifest[key]==null)throw new Error(`Manifest release: ${key} assente`);
  if(!/^sha256:[a-f0-9]{64}$/.test(manifest.databaseSha256))throw new Error('Checksum database release non valido');
  const publicStatus=getPublicArchiveStatus({releaseFile:output,changelogFile:changelogOutput});
  console.log(`Release dati ${manifest.version} valida (${manifest.databaseSha256}); ${publicStatus.entries.length} voci pubbliche.`);process.exit(0);
}
initDb();db.pragma('wal_checkpoint(TRUNCATE)');
const args:Record<string,string|boolean>={};for(let index=2;index<process.argv.length;index++){const value=process.argv[index];if(!value.startsWith('--'))continue;const next=process.argv[index+1];args[value.slice(2)]=next&&!next.startsWith('--')?(index++,next):true;}
const version=String(args.version??process.env.DATA_RELEASE_VERSION??'').trim();if(!/^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/.test(version))throw new Error('Usare --version YYYY.MM.DD.N');
const generatedAt=new Date(String(args['generated-at']??process.env.SOURCE_DATE_EPOCH??new Date().toISOString())).toISOString();
const summary=String(args.summary??process.env.DATA_RELEASE_SUMMARY??'').trim();if(summary.length<20||summary.length>800)throw new Error('Usare --summary con una sintesi pubblica tra 20 e 800 caratteri');
const publicCoverage=String(args.coverage??process.env.DATA_RELEASE_COVERAGE??'').split('|').map(value=>value.trim()).filter(Boolean);if(!publicCoverage.length||publicCoverage.some(value=>value.length>120))throw new Error('Usare --coverage con uno o più perimetri separati da |');
const linkHref=String(args['link-url']??process.env.DATA_RELEASE_LINK_URL??'/methodology').trim();if(!isPublicChangelogHref(linkHref))throw new Error('--link-url deve essere un percorso interno o un URL HTTPS');
const linkLabel=String(args['link-label']??process.env.DATA_RELEASE_LINK_LABEL??'Consulta fonti e copertura').trim();if(linkLabel.length<2||linkLabel.length>80)throw new Error('--link-label non valido');
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
const history=fs.existsSync(changelogOutput)?JSON.parse(fs.readFileSync(changelogOutput,'utf8')):{version:1,entries:[]};
const releaseEntry={id:`release-${version.replace(/\./g,'-')}`,type:'release',status:'published',publishedAt:generatedAt,title:`Release dati ${version}`,summary,coverage:publicCoverage,links:[{label:linkLabel,href:linkHref}],releaseVersion:version};
const nextHistory=upsertPublicReleaseEntry(history,releaseEntry);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(changelogOutput,JSON.stringify(nextHistory,null,2)+'\n');
getPublicArchiveStatus({releaseFile:output,changelogFile:changelogOutput});
console.log(`Release dati ${version} generata e aggiunta al changelog pubblico: ${output}`);db.close();
