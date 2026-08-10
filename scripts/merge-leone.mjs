import Database from 'better-sqlite3';
const db=new Database('server/db/sassuolo.db');
const tx=db.transaction(()=>{
  const from=21,to=247,name='Giuseppe Kevin Leone';
  for(const [table,column] of [['player_seasons','player_id'],['match_events','player_id'],['match_events','assist_player_id'],['match_player_stats','player_id']]) db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${column}=?`).run(to,from);
  db.prepare("UPDATE match_events SET player_name=? WHERE player_id=?").run(name,to);
  db.prepare("UPDATE match_events SET assist_name=? WHERE assist_player_id=?").run(name,to);
  db.prepare("UPDATE match_player_stats SET player_name=? WHERE player_id=?").run(name,to);
  for(const row of db.prepare('SELECT id FROM transfers WHERE player_id=?').all(from)) {
    try { db.prepare('UPDATE transfers SET player_id=?,player_name=? WHERE id=?').run(to,name,row.id); }
    catch { db.prepare('DELETE FROM transfers WHERE id=?').run(row.id); }
  }
  db.prepare('UPDATE players SET name=? WHERE id=?').run(name,to);
  db.prepare('DELETE FROM players WHERE id=?').run(from);
});
tx(); console.log(db.prepare('SELECT id,name FROM players WHERE id=?').get(247)); db.close();
