import { createBackupSnapshot, db, initDb, normalizeNameForMatch, nowIso, recordChange } from '../server/db/database.js';

type Row = { id: number; name: string; [key: string]: any };
type Pair = { oldName: string; newName: string; oldId?: number; newId?: number };
const PAIRS: Pair[] = [
  { oldName: 'Sime Vrsaljko', newName: 'Šime Vrsaljko', oldId: 3323, newId: 81 },
  { oldName: 'Dejan Lazarevic', newName: 'Dejan Lazarević', oldId: 3324, newId: 104 },
  { oldName: 'Rogerio', newName: 'Rogério', oldId: 3341, newId: 231 },
  { oldName: 'Hamed Junior Traore', newName: 'Hamed Junior Traorè', oldId: 3362, newId: 3792 },
];
const FKS = [['transfers', 'player_id'], ['match_events', 'player_id'], ['match_events', 'assist_player_id'], ['match_player_stats', 'player_id'], ['match_injuries', 'player_id']] as const;
const NAMES = [['transfers', 'player_id', 'player_name'], ['match_events', 'player_id', 'player_name'], ['match_events', 'assist_player_id', 'assist_name'], ['match_player_stats', 'player_id', 'player_name'], ['match_injuries', 'player_id', 'player_name']] as const;

function parseArgs() {
  const a = process.argv.slice(2); const get = (x: string) => { const i = a.indexOf(x); return i < 0 ? undefined : a[i + 1]; };
  return { oldName: get('--old'), newName: get('--new'), all: a.includes('--all'), dryRun: a.includes('--dry-run'), yes: a.includes('--yes') };
}
function player(name: string, id?: number): Row {
  const rows = (id === undefined ? db.prepare('SELECT * FROM players WHERE name=?').all(name) : db.prepare('SELECT * FROM players WHERE id=?').all(id)) as Row[];
  if (rows.length !== 1) throw new Error(`Nome/player assente o ambiguo: ${name} (${rows.length} risultati)`);
  return rows[0];
}
function refs(id: number) { const r: Record<string, number> = {}; for (const [t, c] of FKS) r[`${t}.${c}`] = Number((db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${c}=?`).get(id) as any).n); r['player_source_ids.player_id'] = Number((db.prepare('SELECT COUNT(*) n FROM player_source_ids WHERE player_id=?').get(id) as any).n); r['player_seasons.player_id'] = Number((db.prepare('SELECT COUNT(*) n FROM player_seasons WHERE player_id=?').get(id) as any).n); return r; }
function fillPlayer(old: Row, keep: Row, backupId: number | null) {
  const cols = (db.prepare('PRAGMA table_info(players)').all() as any[]).map(x => x.name).filter((x: string) => !['id', 'name', 'firstname', 'lastname', 'api_football_id'].includes(x)); const set: string[] = [], values: any[] = [], before: Row = { id: keep.id, name: keep.name }, after: Row = { id: keep.id, name: keep.name };
  for (const c of cols) if ((keep[c] == null || keep[c] === '') && old[c] != null && old[c] !== '') { set.push(`${c}=?`); values.push(old[c]); before[c] = keep[c]; after[c] = old[c]; }
  if (set.length) { db.prepare(`UPDATE players SET ${set.join(',')} WHERE id=?`).run(...values, keep.id); recordChange({ entityType: 'players', entityId: keep.id, action: 'update', before, after, note: `Campi recuperati dal duplicato ${old.id}`, backupId }); }
}
function merge(pair: Pair, backupId: number | null) {
  const oldRows = pair.oldId === undefined ? db.prepare('SELECT * FROM players WHERE name=?').all(pair.oldName) as Row[] : db.prepare('SELECT * FROM players WHERE id=?').all(pair.oldId) as Row[];
  const keep = player(pair.newName, pair.newId);
  if (!oldRows.length) {
    if (pair.oldId !== undefined && !db.prepare('SELECT 1 FROM player_name_aliases WHERE player_id=? AND alias_normalized=?').get(keep.id, normalizeNameForMatch(pair.oldName))) throw new Error(`Vecchio player mancante senza alias: ${pair.oldName}`);
    return { skipped: true, reason: 'already-merged', newId: keep.id };
  }
  if (oldRows.length !== 1) throw new Error(`Nome/player assente o ambiguo: ${pair.oldName}`);
  const old = oldRows[0]; if (old.id === keep.id) throw new Error('I record coincidono'); const beforeOld = refs(old.id), beforeKeep = refs(keep.id);
  if (keep.api_football_id == null && old.api_football_id != null) {
    db.prepare('UPDATE players SET api_football_id=NULL WHERE id=?').run(old.id);
    db.prepare('UPDATE players SET api_football_id=? WHERE id=?').run(old.api_football_id, keep.id);
    keep.api_football_id = old.api_football_id;
  }
  fillPlayer(old, keep, backupId);
  for (const row of db.prepare('SELECT * FROM player_seasons WHERE player_id=?').all(old.id) as Row[]) {
    const conflict = db.prepare('SELECT * FROM player_seasons WHERE player_id=? AND season=? AND competition=?').get(keep.id, row.season, row.competition) as Row | undefined;
    if (!conflict) { db.prepare('UPDATE player_seasons SET player_id=? WHERE id=?').run(keep.id, row.id); continue; }
    const cols = (db.prepare('PRAGMA table_info(player_seasons)').all() as any[]).map(x => x.name).filter((x: string) => !['id', 'player_id', 'season', 'competition'].includes(x)); const set: string[] = [], values: any[] = [], filled: Row = {} as Row;
    for (const c of cols) if (conflict[c] == null && row[c] != null) { set.push(`${c}=?`); values.push(row[c]); filled[c] = row[c]; }
    if (set.length) db.prepare(`UPDATE player_seasons SET ${set.join(',')} WHERE id=?`).run(...(values as any[]), conflict.id); db.prepare('DELETE FROM player_seasons WHERE id=?').run(row.id); recordChange({ entityType: 'player_seasons', entityId: conflict.id, action: 'resolve-conflict', before: { discarded: row }, after: { kept: conflict, filled }, note: `Merge ${old.id} -> ${keep.id}`, backupId });
  }
  // Transfers have a stricter logical unique index on names and movement
  // fields. Remove only old rows that would become exact duplicates.
  const oldTransfers = db.prepare('SELECT * FROM transfers WHERE player_id=?').all(old.id) as Row[];
  for (const transfer of oldTransfers) {
    const duplicate = db.prepare(`SELECT id FROM transfers WHERE id<>? AND lower(trim(player_name))=lower(trim(?)) AND lower(trim(ifnull(from_team_name,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(to_team_name,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(type,'')))=lower(trim(ifnull(?,''))) AND lower(trim(ifnull(direction,'')))=lower(trim(ifnull(?,''))) AND ifnull(season,'')=ifnull(?,'')`).get(transfer.id, keep.name, transfer.from_team_name, transfer.to_team_name, transfer.type, transfer.direction, transfer.season);
    if (duplicate) {
      db.prepare('DELETE FROM transfers WHERE id=?').run(transfer.id);
      recordChange({ entityType: 'transfers', entityId: Number((duplicate as any).id), action: 'resolve-conflict', before: transfer, after: { keptTransferId: (duplicate as any).id }, note: `Transfer duplicato eliminato durante merge ${old.id} -> ${keep.id}`, backupId });
    }
  }
  for (const [t, c] of FKS) db.prepare(`UPDATE ${t} SET ${c}=? WHERE ${c}=?`).run(keep.id, old.id);
  for (const [t, idc, nc] of NAMES) db.prepare(`UPDATE ${t} SET ${nc}=? WHERE ${idc}=?`).run(keep.name, keep.id);
  for (const s of db.prepare('SELECT * FROM player_source_ids WHERE player_id=?').all(old.id) as any[]) { const duplicate = db.prepare('SELECT id FROM player_source_ids WHERE source_provider=? AND source_player_id=? AND player_id<>?').get(s.source_provider, s.source_player_id, old.id); if (duplicate) db.prepare('DELETE FROM player_source_ids WHERE id=?').run(s.id); else db.prepare('UPDATE player_source_ids SET player_id=? WHERE id=?').run(keep.id, s.id); }
  for (const alias of db.prepare('SELECT * FROM player_name_aliases WHERE player_id=?').all(old.id) as any[]) {
    db.prepare(`INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note,created_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,source_provider=COALESCE(player_name_aliases.source_provider,excluded.source_provider),note=excluded.note`)
      .run(keep.id, alias.alias, alias.alias_normalized, alias.source_provider, `Alias trasferito durante merge ${old.id} -> ${keep.id}`, alias.created_at ?? nowIso());
  }
  db.prepare('INSERT INTO player_name_aliases(player_id,alias,alias_normalized,source_provider,note,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(alias_normalized) DO UPDATE SET player_id=excluded.player_id,note=excluded.note').run(keep.id, old.name, normalizeNameForMatch(old.name), 'manual_merge', `Alias ${old.id} -> ${keep.id}`, nowIso());
  const remaining = refs(old.id); if (Object.values(remaining).some(x => x !== 0)) throw new Error(`Riferimenti residui ${old.id}: ${JSON.stringify(remaining)}`); db.prepare('DELETE FROM players WHERE id=?').run(old.id); recordChange({ entityType: 'players', entityId: keep.id, action: 'update', before: { merged: old, refs: beforeOld, keepRefs: beforeKeep }, after: { playerId: keep.id, alias: old.name }, note: `Merge duplicato ${old.id} -> ${keep.id}`, backupId }); return { oldId: old.id, newId: keep.id, beforeOld, beforeKeep };
}
function main() { const a = parseArgs(); if ((!a.all && (!a.oldName || !a.newName)) || (!a.dryRun && !a.yes)) throw new Error('Uso: --all oppure --old "..." --new "..."; usare --dry-run o --yes'); initDb(); const pairs = a.all ? PAIRS : [{ oldName: a.oldName!, newName: a.newName! }]; const backup = a.dryRun ? null : createBackupSnapshot('merge-player-duplicates'); const tx = db.transaction(() => { const result = pairs.map(p => merge(p, backup?.id ?? null)); if (a.dryRun) throw new Error('__DRY_RUN__'); return result; }); try { const result = tx(); console.log(JSON.stringify({ ok: true, backup, merged: result }, null, 2)); } catch (e) { if (e instanceof Error && e.message === '__DRY_RUN__') console.log('Dry-run completato: rollback eseguito.'); else throw e; } finally { db.close(); } }
main();
