import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.resolve(process.env.SASSUOLO_DB_PATH || 'server/db/sassuolo.db');
const db = new Database(dbPath, { readonly: true });
const canonical = new Set(['Goalkeeper', 'Defender', 'Midfielder', 'Attacker']);

type PositionCount = { position: string | null; count: number };
type PlayerPosition = {
  id: number;
  name: string;
  player_position: string | null;
  season_positions: string | null;
  match_positions: string | null;
};

const distributions = Object.fromEntries(
  (['players', 'player_seasons', 'match_player_stats'] as const).map(table => [
    table,
    db.prepare(`SELECT position, COUNT(*) AS count FROM ${table} GROUP BY position ORDER BY count DESC`).all() as PositionCount[]
  ])
);

const unexpected = Object.fromEntries(
  Object.entries(distributions).map(([table, rows]) => [
    table,
    rows.filter(row => row.position !== null && !canonical.has(row.position))
  ])
);

const players = db.prepare(`
  SELECT p.id, p.name, p.position AS player_position,
    (SELECT GROUP_CONCAT(position, ', ') FROM (
      SELECT DISTINCT position FROM player_seasons WHERE player_id=p.id AND position IS NOT NULL ORDER BY position
    )) AS season_positions,
    (SELECT GROUP_CONCAT(position, ', ') FROM (
      SELECT DISTINCT position FROM match_player_stats WHERE player_id=p.id AND position IS NOT NULL ORDER BY position
    )) AS match_positions
  FROM players p
  WHERE p.position IS NOT NULL
     OR EXISTS(SELECT 1 FROM player_seasons ps WHERE ps.player_id=p.id AND ps.position IS NOT NULL)
     OR EXISTS(SELECT 1 FROM match_player_stats mps WHERE mps.player_id=p.id AND mps.position IS NOT NULL)
  ORDER BY p.name
`).all() as PlayerPosition[];

const split = (value: string | null) => value ? value.split(', ').filter(Boolean) : [];
const conflicts = players.filter(player => {
  const roles = new Set([player.player_position, ...split(player.season_positions)].filter(Boolean));
  return roles.size > 1;
});

// Match roles are tactical assignments for a specific fixture. They may vary
// legitimately, so report them separately instead of treating them as an
// anagraphic conflict.
const matchRoleVariants = players.filter(player => split(player.match_positions).length > 1);
const conflictIds = conflicts.map(player => player.id);
const conflictDetails = conflictIds.length === 0 ? { identities: [], seasons: [], matches: [] } : {
  identities: db.prepare(`
    SELECT p.id,p.name,p.position,p.api_football_id,p.source_provider,p.source_external_id,
      psi.source_provider AS id_provider,psi.source_player_id
    FROM players p LEFT JOIN player_source_ids psi ON psi.player_id=p.id
    WHERE p.id IN (${conflictIds.map(() => '?').join(',')}) OR p.name LIKE '%Russo%'
    ORDER BY p.name,psi.source_provider
  `).all(...conflictIds),
  seasons: db.prepare(`
    SELECT ps.player_id,p.name,ps.season,ps.competition,ps.position,ps.source_provider,ps.last_verified_at
    FROM player_seasons ps JOIN players p ON p.id=ps.player_id
    WHERE ps.player_id IN (${conflictIds.map(() => '?').join(',')})
    ORDER BY p.name,ps.season,ps.competition
  `).all(...conflictIds),
  matches: db.prepare(`
    SELECT mps.player_id,mps.player_name,mps.position,mps.source_provider,mps.provider_player_id,
      m.id AS match_id,m.date,m.home_team,m.away_team
    FROM match_player_stats mps JOIN matches m ON m.id=mps.match_id
    WHERE mps.player_id IN (${conflictIds.map(() => '?').join(',')})
    ORDER BY mps.player_id,m.date
  `).all(...conflictIds)
};

console.log(JSON.stringify({ dbPath, distributions, unexpected, conflicts, conflictDetails, matchRoleVariants }, null, 2));
db.close();
