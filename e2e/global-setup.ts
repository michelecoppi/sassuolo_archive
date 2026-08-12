import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { createServer as createViteServer } from 'vite';

export default async function globalSetup(){
  const databasePath=process.env.SASSUOLO_E2E_DB??path.resolve(`.tmp/e2e-sassuolo-${process.pid}.db`);fs.mkdirSync(path.dirname(databasePath),{recursive:true});
  process.env.SASSUOLO_DB_PATH=databasePath;
  process.env.NODE_ENV='test';
  const apiPort=Number(process.env.SASSUOLO_E2E_API_PORT),webPort=Number(process.env.SASSUOLO_E2E_WEB_PORT);
  const {db,initDb}=await import('../server/db/database.js');const {createApp}=await import('../server/app.js');initDb();
  db.prepare(`INSERT INTO seasons(season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,source_provider) VALUES('2025/26','Serie A',8,38,15,8,15,52,50,53,'e2e')`).run();
  const insertPlayer=db.prepare(`INSERT INTO players(name,position,nationality,current_squad,source_provider) VALUES(?,?,?,?,?)`);
  const insertStats=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,minutes,goals,assists) VALUES(?,?,?,?,?,?,?)`);
  for(let index=0;index<120;index++){const name=index===0?'Domenico Berardi':`Giocatore Test ${String(index).padStart(3,'0')}`;const id=Number(insertPlayer.run(name,index%4===0?'Attacker':'Midfielder','Italia',index<25?1:0,'e2e').lastInsertRowid);insertStats.run(id,'2025/26','Serie A',index%35,900+index,index%12,index%8);}
  const insertMatch=db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider) VALUES(?,?,?,?,?,?,?,?,?)`);
  for(let index=0;index<120;index++)insertMatch.run(`e2e-${index}`,`2026-${String((index%8)+1).padStart(2,'0')}-${String((index%27)+1).padStart(2,'0')}T15:00:00Z`,'2025/26','Serie A',index%2?'Sassuolo':`Avversario ${index}`,index%2?`Avversario ${index}`:'Sassuolo',index%4,index%3,'e2e');
  db.prepare(`INSERT INTO data_conflicts(entity_type,entity_key,field,old_value,new_value,provider,status,created_at) VALUES('match','e2e-1','home_score','1','2','e2e','open',?)`).run(new Date().toISOString());
  const httpServer=createApp({nodeEnv:'test',adminToken:null,corsOrigins:[`http://127.0.0.1:${webPort}`]}).listen(apiPort,'127.0.0.1');await once(httpServer,'listening');
  const vite=await createViteServer({configFile:path.resolve('vite.config.ts'),server:{host:'127.0.0.1',port:webPort,strictPort:true,proxy:{'/api':`http://127.0.0.1:${apiPort}`}}});await vite.listen();
  return async()=>{await vite.close();await new Promise<void>((resolve,reject)=>httpServer.close(error=>error?reject(error):resolve()));db.close();for(const suffix of ['','-wal','-shm'])fs.rmSync(`${databasePath}${suffix}`,{force:true});};
}
