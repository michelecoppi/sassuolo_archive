import { db, initDb } from '../server/db/database.js';

initDb();

const rows = db.prepare(`
  SELECT p.id, p.name, p.firstname, p.lastname, p.source_provider, p.source_external_id,
    COUNT(DISTINCT ps.season) AS seasons,
    COUNT(DISTINCT mps.id) AS match_stats,
    COUNT(DISTINCT me.id) AS events
  FROM players p
  LEFT JOIN player_seasons ps ON ps.player_id = p.id
  LEFT JOIN match_player_stats mps ON mps.player_id = p.id
  LEFT JOIN match_events me ON me.player_id = p.id
  WHERE p.name GLOB '[A-ZÀ-ÖØ-Ý].*'
  GROUP BY p.id
  ORDER BY p.name
`).all();

console.log(JSON.stringify(rows, null, 2));
db.close();
