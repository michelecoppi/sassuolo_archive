import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const source=process.argv[2];
if(!source)throw new Error('Uso: npm run ops:restore-drill -- <backup.db>');
const resolved=path.resolve(source);if(!fs.existsSync(resolved))throw new Error(`Backup non trovato: ${resolved}`);
const db=new Database(resolved,{readonly:true,fileMustExist:true});
try{
  const integrity=String(db.pragma('integrity_check',{simple:true}));
  const tables=Number((db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table'").get() as {count:number}).count);
  const matches=Number((db.prepare('SELECT count(*) AS count FROM matches').get() as {count:number}).count);
  if(integrity!=='ok'||tables<10||matches<1)throw new Error(`Restore drill fallito: integrity=${integrity}, tables=${tables}, matches=${matches}`);
  console.log(JSON.stringify({ok:true,file:resolved,integrity,tables,matches,checkedAt:new Date().toISOString()}));
}finally{db.close();}
