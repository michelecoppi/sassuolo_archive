import { createBackupSnapshot, db, initDb, nowIso, recordChange } from '../server/db/database.js';
initDb();
const ids=[3352,4214,3762,4213];
const backup=createBackupSnapshot('clear-stale-current-squad');
const changed:any[]=[];
db.transaction(()=>{for(const id of ids){const p=db.prepare('SELECT id,name,current_squad FROM players WHERE id=?').get(id) as any;if(!p||!p.current_squad)continue;db.prepare('UPDATE players SET current_squad=0,last_verified_at=? WHERE id=?').run(nowIso(),id);recordChange({entityType:'players',entityId:id,action:'update',before:p,after:{...p,current_squad:0},note:'Rimosso dalla rosa attuale: record storico/non appartenente alla rosa corrente',backupId:backup.id});changed.push({id,name:p.name});}})();
console.log(JSON.stringify({backup,changed},null,2));db.close();
