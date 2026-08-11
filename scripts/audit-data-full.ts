import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, initDb, recordAuditRun } from '../server/db/database.js';
import { getCoverageMatrix } from '../server/services/coverage.js';

initDb();

type CountRow = { total: number };

const tables = [
  'teams', 'team_aliases', 'seasons', 'matches', 'players', 'player_source_ids',
  'player_seasons', 'season_standings', 'team_season_stats', 'transfers',
  'match_details', 'match_events', 'match_lineups', 'match_team_stats',
  'match_player_stats', 'match_injuries', 'news_articles', 'sync_state',
  'data_conflicts', 'app_settings', 'source_references', 'change_log', 'backup_runs',
  'import_runs', 'audit_runs', 'research_candidates', 'schema_migrations', 'security_audit_log',
] as const;

const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
const one = <T>(sql: string) => db.prepare(sql).get() as T;
const count = (table: (typeof tables)[number]) => (one<CountRow>(`SELECT COUNT(*) AS total FROM ${table}`).total);

const report = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  tableCounts: Object.fromEntries(tables.map(table => [table, count(table)])),
  coverage: {
    seasons: getCoverageMatrix().rows,
    detailedMatches: rows<{
      season: string; competition: string; matches: number; details: number; event_matches: number;
      lineup_matches: number; team_stat_matches: number; player_stat_matches: number; injury_matches: number;
    }>(`
      SELECT m.season, m.competition, COUNT(*) AS matches,
        (SELECT COUNT(*) FROM match_details d JOIN matches x ON x.id=d.match_id WHERE x.season=m.season AND x.competition=m.competition) AS details,
        (SELECT COUNT(DISTINCT e.match_id) FROM match_events e JOIN matches x ON x.id=e.match_id WHERE x.season=m.season AND x.competition=m.competition) AS event_matches,
        (SELECT COUNT(DISTINCT l.match_id) FROM match_lineups l JOIN matches x ON x.id=l.match_id WHERE x.season=m.season AND x.competition=m.competition) AS lineup_matches,
        (SELECT COUNT(DISTINCT ts.match_id) FROM match_team_stats ts JOIN matches x ON x.id=ts.match_id WHERE x.season=m.season AND x.competition=m.competition) AS team_stat_matches,
        (SELECT COUNT(DISTINCT ps.match_id) FROM match_player_stats ps JOIN matches x ON x.id=ps.match_id WHERE x.season=m.season AND x.competition=m.competition) AS player_stat_matches,
        (SELECT COUNT(DISTINCT i.match_id) FROM match_injuries i JOIN matches x ON x.id=i.match_id WHERE x.season=m.season AND x.competition=m.competition) AS injury_matches
      FROM matches m
      GROUP BY m.season, m.competition
      ORDER BY m.season, m.competition
    `),
  },
  provenance: {
    byEntity: rows<{ entity: string; provider: string; records: number; source_urls: number; verified: number }>(`
      SELECT 'seasons' AS entity, COALESCE(source_provider,'NULL') AS provider, COUNT(*) AS records, SUM(source_url IS NOT NULL) AS source_urls, SUM(last_verified_at IS NOT NULL) AS verified FROM seasons GROUP BY source_provider
      UNION ALL SELECT 'matches', COALESCE(source_provider,'NULL'), COUNT(*), SUM(source_url IS NOT NULL), SUM(last_verified_at IS NOT NULL) FROM matches GROUP BY source_provider
      UNION ALL SELECT 'players', COALESCE(source_provider,'NULL'), COUNT(*), SUM(source_url IS NOT NULL), SUM(last_verified_at IS NOT NULL) FROM players GROUP BY source_provider
      UNION ALL SELECT 'player_seasons', COALESCE(source_provider,'NULL'), COUNT(*), SUM(source_url IS NOT NULL), SUM(last_verified_at IS NOT NULL) FROM player_seasons GROUP BY source_provider
      UNION ALL SELECT 'transfers', COALESCE(source_provider,'NULL'), COUNT(*), SUM(source_url IS NOT NULL), SUM(last_verified_at IS NOT NULL) FROM transfers GROUP BY source_provider
      ORDER BY entity, provider
    `),
    manualRecords: rows<{ entity: string; records: number }>(`
      SELECT 'seasons' AS entity, COUNT(*) AS records FROM seasons WHERE source_provider='manual'
      UNION ALL SELECT 'matches', COUNT(*) FROM matches WHERE source_provider='manual'
      UNION ALL SELECT 'players', COUNT(*) FROM players WHERE source_provider='manual'
      UNION ALL SELECT 'player_seasons', COUNT(*) FROM player_seasons WHERE source_provider='manual'
      UNION ALL SELECT 'transfers', COUNT(*) FROM transfers WHERE source_provider='manual'
      UNION ALL SELECT 'match_events', COUNT(*) FROM match_events WHERE source_provider='manual'
    `),
    playerIdentity: one<{ players: number; without_source_id: number; with_multiple_source_ids: number }>(`
      SELECT COUNT(*) AS players,
        SUM(CASE WHEN source_ids=0 THEN 1 ELSE 0 END) AS without_source_id,
        SUM(CASE WHEN source_ids>1 THEN 1 ELSE 0 END) AS with_multiple_source_ids
      FROM (SELECT p.id, COUNT(psi.id) AS source_ids FROM players p LEFT JOIN player_source_ids psi ON psi.player_id=p.id GROUP BY p.id)
    `),
  },
  nulls: {
    matches: one<Record<string, number>>(`
      SELECT COUNT(*) AS total, SUM(halftime_score IS NULL) AS no_halftime, SUM(referee IS NULL) AS no_referee,
        SUM(stadium IS NULL) AS no_stadium, SUM(attendance IS NULL) AS no_attendance,
        SUM(shots_home IS NULL OR shots_away IS NULL) AS no_shots,
        SUM(shots_on_target_home IS NULL OR shots_on_target_away IS NULL) AS no_shots_on_target,
        SUM(corners_home IS NULL OR corners_away IS NULL) AS no_corners,
        SUM(fouls_home IS NULL OR fouls_away IS NULL) AS no_fouls,
        SUM(xg_home IS NULL OR xg_away IS NULL) AS no_xg,
        SUM(scorers IS NULL) AS no_scorers, SUM(assists IS NULL) AS no_assists,
        SUM(cards IS NULL) AS no_cards
      FROM matches
    `),
    players: one<Record<string, number>>(`
      SELECT COUNT(*) AS total, SUM(nationality IS NULL) AS no_nationality,
        SUM(birth_date IS NULL) AS no_birth_date, SUM(position IS NULL) AS no_position,
        SUM(photo_url IS NULL) AS no_photo, SUM(api_football_id IS NULL) AS no_api_football_id,
        SUM(source_url IS NULL) AS no_source_url
      FROM players
    `),
    news: one<Record<string, number | string | null>>(`
      SELECT COUNT(*) AS total, SUM(image_url IS NULL) AS no_image, SUM(description IS NULL) AS no_description,
        MIN(published_at) AS oldest_published_at, MAX(published_at) AS newest_published_at, MAX(cached_at) AS last_cached_at
      FROM news_articles
    `),
  },
  integrity: {
    foreignKeyViolations: rows<unknown>('PRAGMA foreign_key_check'),
    duplicateFixtures: rows<{ date: string; home_team: string; away_team: string; duplicates: number; ids: string }>(`
      SELECT substr(date,1,10) AS date, lower(trim(home_team)) AS home_team, lower(trim(away_team)) AS away_team,
        COUNT(*) AS duplicates, GROUP_CONCAT(id) AS ids
      FROM matches
      GROUP BY substr(date,1,10), lower(trim(home_team)), lower(trim(away_team))
      HAVING COUNT(*)>1
    `),
    nearDuplicatePlayers: rows<{ normalized_name: string; duplicates: number; records: string }>(`
      SELECT lower(replace(replace(replace(trim(name),'.',''),' ',''),'-','')) AS normalized_name,
        COUNT(*) AS duplicates, GROUP_CONCAT(id || ':' || name, ' | ') AS records
      FROM players
      GROUP BY normalized_name
      HAVING COUNT(*)>1
    `),
    teamNameVariants: rows<{ normalized_name: string; variants: number; names: string; matches: number }>(`
      WITH opponents AS (
        SELECT CASE WHEN lower(home_team) LIKE '%sassuolo%' THEN away_team ELSE home_team END AS name FROM matches
      )
      SELECT lower(replace(replace(trim(name),'.',''),' ','')) AS normalized_name,
        COUNT(DISTINCT name) AS variants, GROUP_CONCAT(DISTINCT name) AS names, COUNT(*) AS matches
      FROM opponents
      GROUP BY normalized_name
      HAVING COUNT(DISTINCT name)>1
      ORDER BY variants DESC, matches DESC
    `),
    invalidMatches: rows<unknown>(`SELECT id,date,season,competition,home_score,away_score FROM matches WHERE home_score<0 OR away_score<0`),
    invalidPlayerSeasons: rows<unknown>(`
      SELECT ps.id,p.name,ps.season,ps.competition,ps.appearances,ps.starts,ps.minutes,ps.goals,ps.assists
      FROM player_seasons ps JOIN players p ON p.id=ps.player_id
      WHERE ps.appearances<0 OR ps.starts<0 OR ps.minutes<0 OR ps.goals<0 OR ps.assists<0
        OR (ps.appearances IS NOT NULL AND ps.starts IS NOT NULL AND ps.starts>ps.appearances)
        OR (ps.appearances IS NOT NULL AND ps.minutes IS NOT NULL AND ps.minutes>ps.appearances*130)
    `),
    invalidEvents: rows<unknown>(`
      SELECT id,match_id,minute,extra_minute,sequence_number,type,detail,player_name,assist_name
      FROM match_events
      WHERE minute<0 OR minute>130 OR extra_minute<0 OR extra_minute>30 OR sequence_number<0
    `),
    eventsWithoutMinute: rows<unknown>(`
      SELECT id,match_id,type,detail,player_name FROM match_events WHERE minute IS NULL
    `),
    duplicateEvents: rows<unknown>(`
      SELECT match_id, COALESCE(provider_event_id,player_name || '|' || minute || '|' || type || '|' || detail) AS event_key, COUNT(*) AS duplicates
      FROM match_events GROUP BY match_id,event_key HAVING COUNT(*)>1
    `),
    duplicateTransfers: rows<unknown>(`
      SELECT lower(trim(player_name)) AS player_name,direction,COALESCE(season,'') AS season,
        COALESCE(date,'') AS date,COALESCE(from_team_name,'') AS from_team_name,COALESCE(to_team_name,'') AS to_team_name,
        COALESCE(type,'') AS type,COUNT(*) AS duplicates
      FROM transfers
      GROUP BY player_name,direction,season,date,from_team_name,to_team_name,type
      HAVING COUNT(*)>1
    `),
    duplicateNewsTitles: rows<unknown>(`
      SELECT normalized_title,COUNT(*) AS duplicates,GROUP_CONCAT(url,' | ') AS urls
      FROM news_articles GROUP BY normalized_title HAVING COUNT(*)>1
    `),
  },
  sync: rows<unknown>(`SELECT * FROM sync_state ORDER BY provider,resource`),
  conflicts: rows<unknown>(`SELECT * FROM data_conflicts WHERE status='open' ORDER BY created_at DESC`),
};

const auditDir = path.resolve('data/reconciliation/audits');
fs.mkdirSync(auditDir, { recursive: true });
const reportText = JSON.stringify(report, null, 2) + '\n';
const reportPath = path.join(auditDir, `audit-full-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(reportPath, reportText, 'utf8');
const digest = crypto.createHash('sha256').update(reportText).digest('hex');
const issueCount = Object.values(report.integrity).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)
  + report.conflicts.length;
const blockingIssueCount = report.integrity.foreignKeyViolations.length
  + report.integrity.duplicateFixtures.length
  + report.integrity.invalidMatches.length
  + report.integrity.invalidPlayerSeasons.length
  + report.integrity.invalidEvents.length
  + report.integrity.duplicateEvents.length
  + report.integrity.duplicateTransfers.length;
const auditRunId = recordAuditRun({
  status: 'succeeded',
  generatedAt: report.generatedAt,
  reportPath,
  reportSha256: digest,
  issueCount,
  blockingIssueCount,
  tableCounts: report.tableCounts,
  issues: { integrity: report.integrity, conflicts: report.conflicts },
});
console.log(JSON.stringify({ ...report, auditRunId, reportPath, reportSha256: digest }, null, 2));
if (blockingIssueCount > 0) process.exitCode = 1;
