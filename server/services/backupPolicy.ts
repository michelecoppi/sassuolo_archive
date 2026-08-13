import fs from 'node:fs';import path from 'node:path';
export const BACKUP_PREFIX='sassuolo-scheduled-external-export-';
export function backupFiles(directory:string){return fs.readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.startsWith(BACKUP_PREFIX)&&entry.name.endsWith('.db')).map(entry=>{const file=path.resolve(directory,entry.name);return{file,modifiedAt:fs.statSync(file).mtimeMs};}).sort((a,b)=>b.modifiedAt-a.modifiedAt);}
export function retentionCandidates(directory:string,keep:number,now=Date.now(),days=30){const cutoff=now-days*86_400_000;return backupFiles(directory).filter((item,index)=>index>=keep&&item.modifiedAt<cutoff);}
export function backupFreshness(directory:string,maxAgeHours=26,now=Date.now()){const newest=backupFiles(directory)[0];return{ok:Boolean(newest&&now-newest.modifiedAt<=maxAgeHours*3_600_000),newest:newest?.file??null,ageHours:newest?Number(((now-newest.modifiedAt)/3_600_000).toFixed(2)):null};}
