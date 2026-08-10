import { createBackupSnapshot, db, initDb, normalizeNameForMatch, nowIso, recordChange } from '../server/db/database.js';

const mappings = [
  ['J. Doig', 'Josh Doig'],
  ['M. Viña', 'Matías Viña'],
  ['P. Nuamah', 'Patrick Nuamah'],
  ['M. Pedersen', 'Marcus Pedersen'],
  ['H. Moldovan', 'Horaţiu Moldovan'],
  ['E. Ceïde', 'Emil Ceïde'],
  ['A. Vranckx', 'Aster Vranckx'],
  ['D. Bakola', 'Darryl Bakola'],
  ['U. Garcia', 'Ulisses Garcia'],
  ['W. Cheddira', 'Walid Cheddira'],
  ['W. Coulibaly', 'Woyo Coulibaly'],
] as const;

const nameColumns = [
  ['transfers', 'player_id', 'player_name'],
  ['match_events', 'player_id', 'player_name'],
  ['match_events', 'assist_player_id', 'assist_name'],
  ['match_player_stats', 'player_id', 'player_name'],
  ['match_injuries', 'player_id', 'player_name'],
] as const;

function main() {
  initDb();
  const backup = createBackupSnapshot('reconcile-final-player-names');
  const tx = db.transaction(() => {
    const changed: Array<{ id: number; oldName: string; newName: string }> = [];
    for (const [oldName, newName] of mappings) {
      const rows = db.prepare('SELECT id,name,firstname,lastname FROM players WHERE name=?').all(oldName) as any[];
      if (rows.length !== 1) throw new Error(`Nome assente o ambiguo: ${oldName}`);
      const conflict = db.prepare('SELECT id FROM players WHERE name=? AND id<>?').get(newName, rows[0].id);
      if (conflict) throw new Error(`Nome già utilizzato: ${newName}`);
      const [firstname, ...surname] = newName.split(' ');
      db.prepare('UPDATE players SET name=?,firstname=?,lastname=? WHERE id=?').run(newName, firstname, surname.join(' '), rows[0].id);
      for (const [table, idColumn, nameColumn] of nameColumns) db.prepare(`UPDATE ${table} SET ${nameColumn}=? WHERE ${idColumn}=?`).run(newName, rows[0].id);
      db.prepare('INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,note=excluded.note').run(rows[0].id, oldName, normalizeNameForMatch(oldName), 'manual_reconciliation', `Rinomina finale ${oldName} -> ${newName}`, nowIso());
      recordChange({ entityType: 'players', entityId: rows[0].id, action: 'update', before: rows[0], after: { id: rows[0].id, name: newName, firstname, lastname: surname.join(' ') }, note: `Riconciliazione finale ${oldName} -> ${newName}`, backupId: backup.id });
      changed.push({ id: rows[0].id, oldName, newName });
    }
    return changed;
  });
  console.log(JSON.stringify({ ok: true, backup, changed: tx() }, null, 2));
  db.close();
}

main();
