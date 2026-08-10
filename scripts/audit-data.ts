import { initDb, db, setSetting } from '../server/db/database.js';

initDb();

const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
const number = (sql: string) => Number((db.prepare(sql).get() as { value: number }).value);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    seasons: number('SELECT COUNT(1) value FROM seasons'),
    matches: number('SELECT COUNT(1) value FROM matches'),
    players: number('SELECT COUNT(1) value FROM players'),
    playerSeasonMemberships: number('SELECT COUNT(1) value FROM player_seasons'),
  },
  coverage: {
    matchesBySeason: rows<{ season: string; competition: string; matches: number }>(`SELECT season, competition, COUNT(1) matches FROM matches GROUP BY season, competition ORDER BY season`),
    matchesBySeasonAndSource: rows<{ season: string; source: string; matches: number }>(`SELECT season, COALESCE(source_provider, 'unknown') source, COUNT(1) matches FROM matches GROUP BY season, source_provider ORDER BY season, source_provider`),
    squadsBySeason: rows<{ season: string; players: number; rowsWithStats: number }>(`SELECT season, COUNT(DISTINCT player_id) players, SUM(CASE WHEN appearances IS NOT NULL THEN 1 ELSE 0 END) rowsWithStats FROM player_seasons GROUP BY season ORDER BY season`),
  },
  issues: {
    duplicateFixtures: rows<{ date: string; home_team: string; away_team: string; duplicates: number; providers: string }>(`SELECT substr(date, 1, 10) date, home_team, away_team, COUNT(1) duplicates, GROUP_CONCAT(DISTINCT source_provider) providers FROM matches GROUP BY substr(date, 1, 10), lower(home_team), lower(away_team) HAVING COUNT(1) > 1 ORDER BY date`),
    repeatedSeasonPairs: rows<{ season: string; competition: string; home_team: string; away_team: string; matches: number; dates: string; providers: string }>(`SELECT season, competition, home_team, away_team, COUNT(1) matches, GROUP_CONCAT(substr(date, 1, 10)) dates, GROUP_CONCAT(DISTINCT source_provider) providers FROM matches WHERE season IS NOT NULL GROUP BY season, competition, lower(home_team), lower(away_team) HAVING COUNT(1) > 1 ORDER BY season, competition, home_team, away_team`),
    fallbackOnlyCurrentSeason: rows<{ date: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null }>(`SELECT substr(date, 1, 10) date, home_team, away_team, home_score, away_score FROM matches WHERE season='2025/26' AND source_provider='football-data.co.uk' ORDER BY date`),
    seasonsWithoutLeagueMatches: rows<{ season: string; competition: string }>(`SELECT s.season, s.competition FROM seasons s WHERE s.season <> '2026/27' AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.season=s.season AND m.competition=s.competition) ORDER BY s.season`),
    historicalSquadRowsWithoutStats: number(`SELECT COUNT(1) value FROM player_seasons WHERE season < '2013/14' AND appearances IS NULL`),
    invalidEventTimes: rows<{ id: number; match_id: number; minute: number | null; extra_minute: number | null }>(`SELECT id,match_id,minute,extra_minute FROM match_events WHERE minute < 0 OR minute > 130 OR extra_minute < 0 OR extra_minute > 30`),
    invalidPlayerStats: rows<{ id: number; player_id: number; season: string; field: string }>(`SELECT id,player_id,season,'numeric-stat' AS field FROM player_seasons WHERE appearances < 0 OR starts < 0 OR minutes < 0 OR goals < 0 OR assists < 0 OR yellow_cards < 0 OR red_cards < 0`),
    duplicateEvents: rows<{ match_id: number; event_key: string; duplicates: number }>(`SELECT match_id,COALESCE(provider_event_id,player_name||'|'||minute||'|'||type||'|'||detail) AS event_key,COUNT(1) AS duplicates FROM match_events GROUP BY match_id,event_key HAVING COUNT(1)>1`),
    duplicateTransfers: rows<{ player_name: string; direction: string; duplicates: number }>(`SELECT player_name,direction,COUNT(1) AS duplicates FROM transfers GROUP BY lower(trim(player_name)),lower(trim(COALESCE(from_team_name,''))),lower(trim(COALESCE(to_team_name,''))),lower(trim(COALESCE(type,''))),direction,COALESCE(season,'') HAVING COUNT(1)>1`),
    dataConflicts: number(`SELECT COUNT(1) value FROM data_conflicts`),
  },
};

setSetting('data_last_audit_at', report.generatedAt);
console.log(JSON.stringify(report, null, 2));
