import { createBackupSnapshot, db, initDb, normalizeNameForMatch, nowIso, recordChange } from '../server/db/database.js';

const nameColumns = [
  ['transfers', 'player_id', 'player_name'], ['match_events', 'player_id', 'player_name'],
  ['match_events', 'assist_player_id', 'assist_name'], ['match_player_stats', 'player_id', 'player_name'],
  ['match_injuries', 'player_id', 'player_name'],
] as const;

function main() {
  initDb();
  const backup = createBackupSnapshot('expand-remaining-player-initials');
  const tx = db.transaction(() => {
    const changed: any[] = [];
    const rows = db.prepare(`SELECT id,name,firstname,lastname FROM players WHERE name GLOB '[A-ZÀ-ÖØ-Ý].*' AND firstname IS NOT NULL AND lastname IS NOT NULL`).all() as any[];
    for (const row of rows) {
      const newName = `${row.firstname} ${row.lastname}`.trim();
      if (!newName || newName === row.name) continue;
      const conflict = db.prepare('SELECT id FROM players WHERE name=? AND id<>?').get(newName, row.id);
      if (conflict) throw new Error(`Nome già utilizzato: ${newName}`);
      db.prepare('UPDATE players SET name=? WHERE id=?').run(newName, row.id);
      for (const [table, idColumn, nameColumn] of nameColumns) {
        // Transfer rows have a logical unique index containing player_name;
        // leave the denormalized label untouched when the canonical transfer
        // already exists under the full name. The player_id remains correct.
        if (table === 'transfers') continue;
        db.prepare(`UPDATE ${table} SET ${nameColumn}=? WHERE ${idColumn}=?`).run(newName, row.id);
      }
      db.prepare('INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,note=excluded.note').run(row.id, row.name, normalizeNameForMatch(row.name), 'manual_reconciliation', `Nome completo da campi anagrafici: ${row.name} -> ${newName}`, nowIso());
      recordChange({ entityType: 'players', entityId: row.id, action: 'update', before: row, after: { id: row.id, name: newName }, note: `Espansione iniziale ${row.name} -> ${newName}`, backupId: backup.id });
      changed.push({ id: row.id, oldName: row.name, newName });
    }
    return changed;
  });
  console.log(JSON.stringify({ ok: true, backup, changed: tx() }, null, 2));
  db.close();
}
main();
