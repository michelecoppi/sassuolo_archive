import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createBackupSnapshot } from '../server/db/database.js';

const destination=process.env.BACKUP_EXPORT_DIR;
if(!destination)throw new Error('BACKUP_EXPORT_DIR è obbligatorio e deve puntare a uno storage esterno persistente');
const snapshot=createBackupSnapshot('scheduled-external-export');
fs.mkdirSync(destination,{recursive:true});
const target=path.join(path.resolve(destination),path.basename(snapshot.filePath));
fs.copyFileSync(snapshot.filePath,target,fs.constants.COPYFILE_EXCL);
const digest=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
if(digest!==snapshot.sha256)throw new Error('Checksum del backup esportato non valido');
const copy=new Database(target,{readonly:true,fileMustExist:true});
try{if(String(copy.pragma('integrity_check',{simple:true}))!=='ok')throw new Error('Integrity check del backup esportato fallito');}finally{copy.close();}
fs.writeFileSync(`${target}.sha256`,`${digest}  ${path.basename(target)}\n`,{flag:'wx'});
console.log(JSON.stringify({backupId:snapshot.id,file:target,sha256:digest,sizeBytes:snapshot.sizeBytes,verifiedAt:new Date().toISOString()}));
