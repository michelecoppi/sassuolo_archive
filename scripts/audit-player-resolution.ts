import { db, initDb, normalizeNameForMatch } from '../server/db/database.js';
import { resolvePlayer } from '../server/services/playerResolver.js';

initDb();

const normalizedCollisions = db.prepare(`
  SELECT normalized_name, COUNT(*) AS duplicates, GROUP_CONCAT(name, ' | ') AS names
  FROM (
    SELECT name, lower(trim(name)) AS normalized_name FROM players
  )
  GROUP BY normalized_name
  HAVING COUNT(*) > 1
`).all() as Array<{ normalized_name: string; duplicates: number; names: string }>;

const abbreviatedWithoutAlias = (db.prepare(`SELECT id,name FROM players`).all() as Array<{ id: number; name: string }>)
  .filter(player => /\b[A-ZÀ-ÖØ-Ý]\./u.test(player.name))
  .filter(player => !(db.prepare(`SELECT 1 FROM player_name_aliases WHERE player_id=? LIMIT 1`).get(player.id) as unknown));

const duplicateSourceIds = db.prepare(`
  SELECT source_provider,source_player_id,COUNT(DISTINCT player_id) AS players
  FROM player_source_ids
  GROUP BY source_provider,source_player_id
  HAVING COUNT(DISTINCT player_id) > 1
`).all();

const unresolvedTextRows = db.prepare(`
  SELECT 'match_player_stats' AS table_name,id,player_name AS raw_name,source_provider,provider_player_id AS source_player_id
  FROM match_player_stats WHERE player_id IS NULL AND player_name IS NOT NULL
  UNION ALL
  SELECT 'match_injuries',id,player_name,source_provider,player_api_id FROM match_injuries WHERE player_id IS NULL AND player_name IS NOT NULL
  UNION ALL
  SELECT 'match_events',id,player_name,source_provider,player_provider_id FROM match_events WHERE player_id IS NULL AND player_name IS NOT NULL
`).all() as Array<{ table_name: string; id: number; raw_name: string; source_provider: string | null; source_player_id: string | null }>;

const resolvableNullLinks = unresolvedTextRows.map(row => ({
  ...row,
  resolution: resolvePlayer({ name: row.raw_name, sourceProvider: row.source_provider, sourcePlayerId: row.source_player_id, context: `${row.table_name}:${row.id}` }),
})).filter(row => row.resolution.status === 'resolved');

const denormalizedNameDrift = db.prepare(`
  SELECT 'match_player_stats' AS table_name,mps.id,p.name AS canonical_name,mps.player_name AS stored_name
  FROM match_player_stats mps JOIN players p ON p.id=mps.player_id
  WHERE normalize(replace(mps.player_name, '  ', ' ')) IS NOT NULL
`).all().filter((row: any) => normalizeNameForMatch(row.canonical_name) !== normalizeNameForMatch(row.stored_name));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  normalizedCollisions,
  abbreviatedWithoutAlias,
  duplicateSourceIds,
  resolvableNullLinks,
  denormalizedNameDrift,
}, null, 2));
