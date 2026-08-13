import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createBackupSnapshot } from '../server/db/database.js';
import { backupFreshness, retentionCandidates } from '../server/services/backupPolicy.js';

const destination=process.env.BACKUP_EXPORT_DIR;
if(!destination)throw new Error('BACKUP_EXPORT_DIR è obbligatorio e deve puntare a uno storage esterno persistente');
const resolvedDestination=path.resolve(destination);fs.mkdirSync(resolvedDestination,{recursive:true});
const disk=fs.statfsSync(resolvedDestination),minimumFreeBytes=Number(process.env.BACKUP_MIN_FREE_BYTES??536_870_912);
if(disk.bavail*disk.bsize<minimumFreeBytes)throw new Error('Spazio libero insufficiente per il backup');
if(process.env.NODE_ENV==='production'&&process.env.BACKUP_ENCRYPTED!=='1')throw new Error('BACKUP_ENCRYPTED=1 è obbligatorio in produzione');
const snapshot=createBackupSnapshot('scheduled-external-export');
const target=path.join(resolvedDestination,path.basename(snapshot.filePath));
fs.copyFileSync(snapshot.filePath,target,fs.constants.COPYFILE_EXCL);
const digest=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
if(digest!==snapshot.sha256)throw new Error('Checksum del backup esportato non valido');
const copy=new Database(target,{readonly:true,fileMustExist:true});
try{if(String(copy.pragma('integrity_check',{simple:true}))!=='ok')throw new Error('Integrity check del backup esportato fallito');}finally{copy.close();}
fs.writeFileSync(`${target}.sha256`,`${digest}  ${path.basename(target)}\n`,{flag:'wx'});
const keep=Math.max(2,Number(process.env.BACKUP_RETENTION_COUNT??14)),days=Math.max(1,Number(process.env.BACKUP_RETENTION_DAYS??30));const removed:string[]=[];
for(const candidate of retentionCandidates(resolvedDestination,keep,Date.now(),days)){if(!candidate.file.startsWith(`${resolvedDestination}${path.sep}`))throw new Error('Candidato retention fuori destinazione');fs.rmSync(candidate.file);fs.rmSync(`${candidate.file}.sha256`,{force:true});removed.push(path.basename(candidate.file));}
console.log(JSON.stringify({backupId:snapshot.id,file:target,sha256:digest,sizeBytes:snapshot.sizeBytes,verifiedAt:new Date().toISOString(),freshness:backupFreshness(resolvedDestination),retention:{keep,days,removed}}));
