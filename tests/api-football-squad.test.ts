import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after,test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-api-football-squad-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'squad.db');
const {db,initDb}=await import('../server/db/database.js');
const {upsertPlayer}=await import('../server/services/apiFootballSync.js');
initDb();
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true})});

test('current-squad aggiorna un giocatore esistente passando tutti i parametri SQLite',()=>{
  const id=Number(db.prepare(`INSERT INTO players(api_football_id,name,source_provider) VALUES(?,?,?)`).run(488001,'D. Berardi','api-football').lastInsertRowid);
  assert.doesNotThrow(()=>upsertPlayer({id:488001,name:'D. Berardi',firstname:'Domenico',lastname:'Berardi',nationality:'Italy',birth:{date:'1994-08-01'},position:'Attacker',number:10},{position:'Attacker',number:10,currentSquad:true}));
  const player=db.prepare(`SELECT name,firstname,lastname,nationality,position,shirt_number,current_squad,source_external_id FROM players WHERE id=?`).get(id) as any;
  assert.deepEqual(player,{name:'Domenico Berardi',firstname:'Domenico',lastname:'Berardi',nationality:'Italy',position:'Attacker',shirt_number:10,current_squad:1,source_external_id:'488001'});
});
