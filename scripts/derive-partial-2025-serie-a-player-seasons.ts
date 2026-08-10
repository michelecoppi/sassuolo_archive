import { createBackupSnapshot, db, initDb, nowIso, recordChange, recordSourceReference } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';

const season = '2025/26';
const competition = 'Serie A';

initDb();
const matches = db.prepare('SELECT COUNT(*) AS total FROM matches WHERE season=? AND competition=?').get(season, competition) as { total: number };
const covered = db.prepare(`SELECT COUNT(DISTINCT p.match_id) AS total
  FROM match_player_stats p JOIN matches m ON m.id=p.match_id
  WHERE m.season=? AND m.competition=? AND lower(p.team_name)='sassuolo' AND p.minutes IS NOT NULL`).get(season, competition) as { total: number };
if (matches.total !== 38 || covered.total !== 8) throw new Error(`Copertura inattesa ${covered.total}/${matches.total}; importazione parziale annullata`);

const rows = db.prepare(`SELECT p.player_id, p.player_name, m.season, m.competition,
    COUNT(*) AS appearances,
    SUM(CASE WHEN p.substitute=0 THEN 1 ELSE 0 END) AS starts,
    SUM(p.minutes) AS minutes, SUM(p.goals) AS goals, SUM(p.assists) AS assists,
    SUM(p.yellow_cards) AS yellow_cards, SUM(p.red_cards) AS red_cards,
    GROUP_CONCAT(DISTINCT m.source_url) AS source_urls
  FROM match_player_stats p JOIN matches m ON m.id=p.match_id
  WHERE m.season=? AND m.competition=? AND lower(p.team_name)='sassuolo' AND p.player_id IS NOT NULL AND p.minutes IS NOT NULL
  GROUP BY p.player_id,m.season,m.competition`).all(season, competition) as any[];

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ mode: 'dry-run', coverage: `${covered.total}/${matches.total}`, rows: rows.map(row => ({ player: row.player_name, appearances: row.appearances, starts: row.starts, goals: row.goals })) }, null, 2));
  process.exit(0);
}

const backup = createBackupSnapshot('before-kickoff-partial-2025-serie-a-player-seasons-import');
const save = db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,source_provider,source_url,last_verified_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=excluded.appearances,starts=excluded.starts,minutes=excluded.minutes,goals=excluded.goals,assists=excluded.assists,yellow_cards=excluded.yellow_cards,red_cards=excluded.red_cards,source_provider=excluded.source_provider,source_url=COALESCE(excluded.source_url,player_seasons.source_url),last_verified_at=excluded.last_verified_at
  WHERE COALESCE(player_seasons.source_provider,'') <> 'manual'`);
const saved = db.transaction(() => {
  let stored = 0;
  for (const row of rows) {
    stored += Number(save.run(row.player_id, row.season, row.competition, row.appearances, row.starts, row.minutes, row.goals, row.assists, row.yellow_cards, row.red_cards, 'kickoff-derived (partial 8/38)', null, nowIso()).changes);
    const entity = db.prepare('SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?').get(row.player_id, row.season, row.competition) as { id: number };
    for (const sourceUrl of String(row.source_urls ?? '').split(',').filter(Boolean)) recordSourceReference({ entityType: 'player_seasons', entityId: entity.id, sourceUrl, note: 'Derivato dalle statistiche Kickoff disponibili; copertura parziale esplicita: 8 delle 38 partite di Serie A 2025/26.' });
  }
  return { stored };
})();
recomputeDerivedPlayerStats();
recordChange({ entityType: 'player_seasons', action: 'create', after: { ...saved, coverage: `${covered.total}/${matches.total}`, rows: rows.length }, note: 'Derivazione parziale PlayerSeason Serie A 2025/26 da 8 match Kickoff completi', backupId: backup.id });
console.log(JSON.stringify({ mode: 'applied', backup, ...saved, coverage: `${covered.total}/${matches.total}`, rows: rows.length }, null, 2));
