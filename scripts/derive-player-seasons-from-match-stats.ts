import { createBackupSnapshot, db, initDb, nowIso, recordChange, recordSourceReference } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';

const targets = [
  ['2024/25', 'Coppa Italia'],
  ['2025/26', 'Coppa Italia'],
] as const;

initDb();
const rows = targets.map(([season, competition]) => {
  const matches = db.prepare(`SELECT COUNT(*) AS total FROM matches WHERE season=? AND competition=?`).get(season, competition) as { total: number };
  const covered = db.prepare(`SELECT COUNT(DISTINCT p.match_id) AS total FROM match_player_stats p JOIN matches m ON m.id=p.match_id WHERE m.season=? AND m.competition=? AND lower(p.team_name)='sassuolo'`).get(season, competition) as { total: number };
  if (matches.total !== covered.total) throw new Error(`${season} ${competition}: dati match-player incompleti (${covered.total}/${matches.total}); derivazione annullata`);
  return db.prepare(`SELECT p.player_id, p.player_name, m.season, m.competition,
      COUNT(CASE WHEN p.minutes IS NOT NULL THEN 1 END) AS appearances,
      SUM(CASE WHEN p.minutes IS NOT NULL AND p.substitute=0 THEN 1 ELSE 0 END) AS starts,
      SUM(p.minutes) AS minutes, SUM(p.goals) AS goals, SUM(p.assists) AS assists,
      SUM(p.yellow_cards) AS yellow_cards, SUM(p.red_cards) AS red_cards,
      GROUP_CONCAT(DISTINCT m.source_url) AS source_urls
    FROM match_player_stats p JOIN matches m ON m.id=p.match_id
    WHERE m.season=? AND m.competition=? AND lower(p.team_name)='sassuolo' AND p.player_id IS NOT NULL AND p.minutes IS NOT NULL
    GROUP BY p.player_id,m.season,m.competition`).all(season, competition) as any[];
}).flat();

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ mode: 'dry-run', rows: rows.map(row => ({ season: row.season, competition: row.competition, player: row.player_name, appearances: row.appearances })) }, null, 2));
  process.exit(0);
}

const backup = createBackupSnapshot('before-kickoff-derived-player-seasons-import');
const save = db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,source_provider,source_url,last_verified_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=excluded.appearances,starts=excluded.starts,minutes=excluded.minutes,goals=excluded.goals,assists=excluded.assists,yellow_cards=excluded.yellow_cards,red_cards=excluded.red_cards,source_provider=excluded.source_provider,source_url=COALESCE(excluded.source_url,player_seasons.source_url),last_verified_at=excluded.last_verified_at
  WHERE COALESCE(player_seasons.source_provider,'') <> 'manual'`);
const result = db.transaction(() => {
  let stored = 0;
  for (const row of rows) {
    const changed = save.run(row.player_id, row.season, row.competition, row.appearances, row.starts, row.minutes, row.goals, row.assists, row.yellow_cards, row.red_cards, 'kickoff-derived', null, nowIso());
    stored += Number(changed.changes);
    const entity = db.prepare(`SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(row.player_id, row.season, row.competition) as { id: number };
    for (const sourceUrl of String(row.source_urls ?? '').split(',').filter(Boolean)) recordSourceReference({ entityType: 'player_seasons', entityId: entity.id, sourceUrl, note: 'Derivato da match_player_stats Kickoff completi per tutte le partite della competizione.' });
  }
  return { stored };
})();
recomputeDerivedPlayerStats();
recordChange({ entityType: 'player_seasons', action: 'create', after: { ...result, targets, rows: rows.length }, note: 'Derivazione PlayerSeason da statistiche match Kickoff complete', backupId: backup.id });
console.log(JSON.stringify({ mode: 'applied', backup, ...result, rows: rows.length, targets }, null, 2));
