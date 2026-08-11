import { db, getSetting } from '../db/database.js';
import { loadHistoricalScope, validateHistoricalScope, type CompetitionKind } from './historicalScope.js';

export type CoverageRow = {
  season: string; competition: string; expected_matches: number | null; found_matches: number;
  completed_matches: number; future_matches: number; unplayed_matches: number;
  standing_rows: number; squad_players: number; player_seasons_with_stats: number;
  detail_matches: number; event_matches: number; lineup_matches: number;
  team_stat_matches: number; player_stat_matches: number; complete_matches: number;
  manager_available: number; stadium_available: number; source_records: number;
  last_verified_at: string | null; status: 'complete' | 'partial' | 'unknown';
  declared_in_scope: boolean; competition_kind: CompetitionKind | 'unclassified'; gap_reason: string | null;
};

export function getCoverageMatrix() {
  const now = new Date().toISOString();
  const databaseRows = db.prepare(`SELECT s.season,s.competition,s.matches AS expected_matches,
    (SELECT COUNT(*) FROM matches m WHERE m.season=s.season AND m.competition=s.competition) AS found_matches,
    (SELECT COUNT(*) FROM matches m WHERE m.season=s.season AND m.competition=s.competition AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL) AS completed_matches,
    (SELECT COUNT(*) FROM matches m WHERE m.season=s.season AND m.competition=s.competition AND m.date>?) AS future_matches,
    (SELECT COUNT(*) FROM matches m WHERE m.season=s.season AND m.competition=s.competition AND m.date<=? AND (m.home_score IS NULL OR m.away_score IS NULL)) AS unplayed_matches,
    (SELECT COUNT(*) FROM season_standings st WHERE st.season=s.season AND st.competition=s.competition) AS standing_rows,
    (SELECT COUNT(DISTINCT ps.player_id) FROM player_seasons ps WHERE ps.season=s.season AND ps.competition=s.competition) AS squad_players,
    (SELECT COUNT(*) FROM player_seasons ps WHERE ps.season=s.season AND ps.competition=s.competition AND (ps.appearances IS NOT NULL OR ps.minutes IS NOT NULL OR ps.goals IS NOT NULL OR ps.assists IS NOT NULL)) AS player_seasons_with_stats,
    (SELECT COUNT(DISTINCT d.match_id) FROM match_details d JOIN matches m ON m.id=d.match_id WHERE m.season=s.season AND m.competition=s.competition) AS detail_matches,
    (SELECT COUNT(DISTINCT e.match_id) FROM match_events e JOIN matches m ON m.id=e.match_id WHERE m.season=s.season AND m.competition=s.competition) AS event_matches,
    (SELECT COUNT(DISTINCT l.match_id) FROM match_lineups l JOIN matches m ON m.id=l.match_id WHERE m.season=s.season AND m.competition=s.competition) AS lineup_matches,
    (SELECT COUNT(DISTINCT t.match_id) FROM match_team_stats t JOIN matches m ON m.id=t.match_id WHERE m.season=s.season AND m.competition=s.competition) AS team_stat_matches,
    (SELECT COUNT(DISTINCT p.match_id) FROM match_player_stats p JOIN matches m ON m.id=p.match_id WHERE m.season=s.season AND m.competition=s.competition) AS player_stat_matches,
    (SELECT COUNT(*) FROM matches m WHERE m.season=s.season AND m.competition=s.competition
      AND EXISTS(SELECT 1 FROM match_details d WHERE d.match_id=m.id)
      AND EXISTS(SELECT 1 FROM match_events e WHERE e.match_id=m.id)
      AND EXISTS(SELECT 1 FROM match_lineups l WHERE l.match_id=m.id)
      AND EXISTS(SELECT 1 FROM match_team_stats t WHERE t.match_id=m.id)
      AND EXISTS(SELECT 1 FROM match_player_stats p WHERE p.match_id=m.id)) AS complete_matches,
    CASE WHEN s.manager IS NULL OR trim(s.manager)='' THEN 0 ELSE 1 END AS manager_available,
    CASE WHEN s.stadium IS NULL OR trim(s.stadium)='' THEN 0 ELSE 1 END AS stadium_available,
    (CASE WHEN s.source_url IS NULL THEN 0 ELSE 1 END
      +(SELECT COUNT(*) FROM matches m WHERE m.season=s.season AND m.competition=s.competition AND m.source_url IS NOT NULL)
      +(SELECT COUNT(*) FROM player_seasons ps WHERE ps.season=s.season AND ps.competition=s.competition AND ps.source_url IS NOT NULL)) AS source_records,
    MAX(COALESCE(s.last_verified_at,''),
      COALESCE((SELECT MAX(m.last_verified_at) FROM matches m WHERE m.season=s.season AND m.competition=s.competition),''),
      COALESCE((SELECT MAX(ps.last_verified_at) FROM player_seasons ps WHERE ps.season=s.season AND ps.competition=s.competition),'')) AS last_verified_at
    FROM seasons s ORDER BY s.season DESC,s.competition`).all(now, now) as Array<Omit<CoverageRow,'status'|'declared_in_scope'|'competition_kind'|'gap_reason'>>;

  const scope = loadHistoricalScope();
  const scopeIssues = validateHistoricalScope(scope);
  if (scopeIssues.length) throw new Error(`Perimetro storico non valido: ${scopeIssues.join(' ')}`);
  const byKey = new Map(databaseRows.map(row => [`${row.season}\u0000${row.competition}`, row]));
  const empty = (season: string, competition: string) => ({
    season, competition, expected_matches: null, found_matches: 0, completed_matches: 0, future_matches: 0,
    unplayed_matches: 0, standing_rows: 0, squad_players: 0, player_seasons_with_stats: 0, detail_matches: 0,
    event_matches: 0, lineup_matches: 0, team_stat_matches: 0, player_stat_matches: 0, complete_matches: 0,
    manager_available: 0, stadium_available: 0, source_records: 0, last_verified_at: null,
  });
  const scopedRows = scope.entries.map(entry => {
    const key = `${entry.season}\u0000${entry.competition}`;
    const databaseRow = byKey.get(key) ?? empty(entry.season, entry.competition);
    byKey.delete(key);
    return {
      ...databaseRow,
      expected_matches: entry.expectedMatches ?? databaseRow.expected_matches,
      declared_in_scope: true,
      competition_kind: entry.kind,
      gap_reason: entry.gapReason,
    };
  });
  const undeclaredRows = [...byKey.values()].map(row => ({
    ...row,
    declared_in_scope: false,
    competition_kind: 'unclassified' as const,
    gap_reason: 'Competizione presente nel database ma non ancora classificata nel manifesto del perimetro storico.',
  }));

  const matrix: CoverageRow[] = [...scopedRows, ...undeclaredRows].map(row => {
    const expectedKnown = row.expected_matches != null && row.expected_matches > 0;
    const matchesComplete = expectedKnown && row.found_matches === row.expected_matches && row.unplayed_matches === 0;
    const coreComplete = matchesComplete && row.squad_players > 0 && row.player_seasons_with_stats === row.squad_players && row.source_records > 0;
    const anyCoverage = row.found_matches + row.squad_players + row.standing_rows > 0;
    const status: CoverageRow['status'] = coreComplete ? 'complete' : anyCoverage ? 'partial' : 'unknown';
    return {...row,last_verified_at:row.last_verified_at||null,status,gap_reason:status === 'complete' ? null : row.gap_reason};
  }).sort((a, b) => b.season.localeCompare(a.season) || a.competition.localeCompare(b.competition));
  return {
    generatedAt: now,
    lastAuditAt: getSetting('data_last_audit_at'),
    scope: {version: scope.version, startSeason: scope.startSeason, endSeason: scope.endSeason, inclusionPolicy: scope.inclusionPolicy, evidence: scope.evidence},
    definition: 'Complete richiede calendario atteso coperto, nessuna gara passata senza risultato, rosa con statistiche e almeno una provenienza puntuale. I blocchi di dettaglio restano esposti separatamente.',
    rows: matrix,
  };
}
