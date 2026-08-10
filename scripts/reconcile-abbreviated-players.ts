import { createBackupSnapshot, db, initDb, normalizeNameForMatch, nowIso, recordChange } from '../server/db/database.js';

const mappings = [
  ['A. Cisco', 'Andrea Cisco'], ['A. Donis', 'Anastasios Donis'], ['A. Kolaj', 'Aristidi Kolaj'], ['A. Mattioli', 'Alessandro Mattioli'], ['A. Mărginean', 'Andrei Mărginean'], ['A. Meroni', 'Andrea Meroni'], ['A. Vita', 'Alessio Vita'], ['A. Zapata', 'Alexis Zapata'], ['B. Gjyla', 'Briajan Gjyla'], ['C. Aucelli', 'Christian Aucelli'], ['C. Martey', 'Carlton Martey'], ['D. Daniels', 'Daishawn Daniels'], ['D. Theiner', 'Daniel Theiner'], ['E. Lopes', 'Emanuele Lopes'], ['F. Artioli', 'Federico Artioli'], ['F. Bandinelli', 'Filippo Bandinelli'], ['F. Corradini', 'Giovanni Corradini'], ['F. Viero', 'Federico Viero'], ['G. Aurelio', 'Giuseppe Aurelio'], ['G. Guri', 'Gabriel Guri'], ['G. Sbrissa', 'Giovanni Sbrissa'], ['G. Vezzosi', 'Giorgio Vezzosi'], ['G. Zecca', 'Giacomo Zecca'], ['J. Broh', 'Jeremie Broh'], ['K. Bowie', 'Kieron Bowie'], ['K. Jashari', 'Kaonis Jashari'], ['L. Barani', 'Luca Barani'], ['L. Lattanzi', 'Lorenzo Lattanzi'], ['L. Nyarko', 'Loris Nyarko'], ['L. Ravanelli', 'Luca Ravanelli'], ['L. Reggiani', 'Luca Reggiani'], ['M. Agazzi', 'Michael Agazzi'], ['M. Campani', 'Matteo Campani'], ['M. Ferrini', 'Manuel Ferrini'], ['M. Marin', 'Marius Marin'], ['M. Piacentini', 'Matteo Piacentini'], ['M. Pinato', 'Marco Pinato'], ['M. Saccani', 'Matteo Saccani'], ['N. Baffoh', 'Nathan Baffoh'], ['N. Bruschi', 'Nicolò Bruschi'], ['P. Cianci', 'Pietro Cianci'], ['R. Celia', 'Raffaele Celia'], ['R. Șteau', 'Raul Șteau'], ['S. Cinquegrano', 'Stefano Cinquegrano'], ['S. Daldum', 'Sonosi Daldum'], ['S. Vitale', 'Stefano Vitale'],
] as const;

function updateNames(id: number, name: string) {
  for (const [table, idColumn, nameColumn] of [['transfers', 'player_id', 'player_name'], ['match_events', 'player_id', 'player_name'], ['match_events', 'assist_player_id', 'assist_name'], ['match_player_stats', 'player_id', 'player_name'], ['match_injuries', 'player_id', 'player_name']] as const) {
    db.prepare(`UPDATE ${table} SET ${nameColumn}=? WHERE ${idColumn}=?`).run(name, id);
  }
}

function main() {
  initDb();
  const backup = createBackupSnapshot('reconcile-abbreviated-players');
  const tx = db.transaction(() => {
    const result: Array<{ id: number; oldName: string; newName: string }> = [];
    for (const [oldName, newName] of mappings) {
      const oldRows = db.prepare('SELECT id, name, firstname, lastname FROM players WHERE name=?').all(oldName) as any[];
      if (oldRows.length !== 1) throw new Error(`Vecchio nome assente o ambiguo: ${oldName}`);
      const existing = db.prepare('SELECT id FROM players WHERE name=? AND id<>?').get(newName, oldRows[0].id);
      if (existing) throw new Error(`Nuovo nome già assegnato a un altro giocatore: ${newName}`);
      const [firstname, ...last] = newName.split(' ');
      db.prepare('UPDATE players SET name=?, firstname=?, lastname=? WHERE id=?').run(newName, firstname, last.join(' '), oldRows[0].id);
      updateNames(oldRows[0].id, newName);
      db.prepare('INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,note=excluded.note').run(oldRows[0].id, oldName, normalizeNameForMatch(oldName), 'manual_reconciliation', `Rinomina da ${oldName} a ${newName}`, nowIso());
      recordChange({ entityType: 'players', entityId: oldRows[0].id, action: 'update', before: oldRows[0], after: { id: oldRows[0].id, name: newName, firstname, lastname: last.join(' ') }, note: `Riconciliazione nome abbreviato ${oldName} -> ${newName}`, backupId: backup.id });
      result.push({ id: oldRows[0].id, oldName, newName });
    }
    return result;
  });
  console.log(JSON.stringify({ ok: true, backup, renamed: tx() }, null, 2));
  db.close();
}

main();
