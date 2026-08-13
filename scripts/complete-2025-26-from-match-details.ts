import fs from 'node:fs';
import path from 'node:path';
import { createBackupSnapshot, db, initDb, nowIso, recordChange } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';

const season = '2025/26';
const competition = 'Serie A';
const clubPattern = '%sassuolo%';
const apply = process.argv.includes('--apply');

type Match = Record<string, any> & { id: number; date: string; home_team: string; away_team: string; home_score: number; away_score: number };

initDb();

const matches = db.prepare(`SELECT * FROM matches WHERE season=? AND competition=? ORDER BY date,id`).all(season, competition) as Match[];
if (matches.length !== 38 || matches.some(match => match.home_score == null || match.away_score == null)) {
  throw new Error(`Calendario ${season} incompleto: attese 38 partite concluse, trovate ${matches.length}`);
}

const covered = db.prepare(`SELECT COUNT(DISTINCT ps.match_id) AS total
  FROM match_player_stats ps JOIN matches m ON m.id=ps.match_id
  WHERE m.season=? AND m.competition=? AND lower(ps.team_name) LIKE ? AND ps.minutes IS NOT NULL`).get(season, competition, clubPattern) as { total: number };
if (covered.total < 37) throw new Error(`Copertura dettagli insufficiente: ${covered.total}/38 partite`);

const sumFields = [
  'shots_total','shots_on','goals','goals_conceded','assists','saves','passes_total','passes_key',
  'tackles_total','blocks','interceptions','duels_total','duels_won','dribbles_attempts','dribbles_success',
  'fouls_drawn','fouls_committed','yellow_cards','red_cards','penalty_won','penalty_committed',
  'penalty_scored','penalty_missed','penalty_saved',
] as const;
const sums = sumFields.map(field => `SUM(ps.${field}) AS ${field}`).join(',\n    ');
const playerRows = db.prepare(`SELECT ps.player_id,MAX(ps.player_name) AS player_name,m.season,m.competition,
    COUNT(*) AS appearances,
    SUM(CASE WHEN ps.substitute=0 THEN 1 ELSE 0 END) AS starts,
    SUM(ps.minutes) AS minutes,
    AVG(ps.rating) AS rating,
    MAX(ps.captain) AS captain,
    SUM(CASE WHEN ps.substitute=1 THEN 1 ELSE 0 END) AS substitutes_in,
    SUM(CASE WHEN ps.substitute=0 AND ps.minutes<90 THEN 1 ELSE 0 END) AS substitutes_out,
    (SELECT COUNT(*) FROM match_player_stats bench JOIN matches bm ON bm.id=bench.match_id
      WHERE bench.player_id=ps.player_id AND bm.season=m.season AND bm.competition=m.competition
        AND lower(bench.team_name) LIKE ? AND bench.substitute=1 AND bench.minutes IS NULL) AS substitutes_bench,
    MAX(ps.shirt_number) AS shirt_number,MAX(ps.position) AS position,
    ${sums},AVG(ps.pass_accuracy) AS pass_accuracy
  FROM match_player_stats ps JOIN matches m ON m.id=ps.match_id
  WHERE m.season=? AND m.competition=? AND lower(ps.team_name) LIKE ?
    AND ps.player_id IS NOT NULL AND ps.minutes IS NOT NULL
  GROUP BY ps.player_id,m.season,m.competition
  ORDER BY appearances DESC,player_name`).all(clubPattern, season, competition, clubPattern) as any[];

function isHome(match: Match) { return /sassuolo/i.test(match.home_team); }
function outcome(match: Match) {
  const gf = isHome(match) ? match.home_score : match.away_score;
  const ga = isHome(match) ? match.away_score : match.home_score;
  return { gf, ga, result: gf > ga ? 'W' : gf === ga ? 'D' : 'L' } as const;
}
function longest(result: 'W'|'D'|'L') {
  let best = 0, current = 0;
  for (const match of matches) { current = outcome(match).result === result ? current + 1 : 0; best = Math.max(best, current); }
  return best;
}
function biggest(result: 'W'|'L', home: boolean) {
  return matches.filter(match => isHome(match) === home && outcome(match).result === result)
    .sort((a,b) => Math.abs(outcome(b).gf-outcome(b).ga)-Math.abs(outcome(a).gf-outcome(a).ga))[0];
}
function score(match?: Match) { return match ? `${match.home_score}-${match.away_score}` : null; }

const results = matches.map(outcome);
const formations = db.prepare(`SELECT l.formation,COUNT(*) AS played FROM match_lineups l JOIN matches m ON m.id=l.match_id
  WHERE m.season=? AND m.competition=? AND lower(l.team_name) LIKE ? AND l.formation IS NOT NULL
  GROUP BY l.formation ORDER BY played DESC,l.formation`).all(season, competition, clubPattern);
const teamStats = {
  season, competition, played: matches.length,
  wins: results.filter(row => row.result === 'W').length,
  draws: results.filter(row => row.result === 'D').length,
  losses: results.filter(row => row.result === 'L').length,
  goals_for: results.reduce((total,row) => total + row.gf, 0),
  goals_against: results.reduce((total,row) => total + row.ga, 0),
  clean_sheets: results.filter(row => row.ga === 0).length,
  failed_to_score: results.filter(row => row.gf === 0).length,
  biggest_win_home: score(biggest('W', true)), biggest_win_away: score(biggest('W', false)),
  biggest_loss_home: score(biggest('L', true)), biggest_loss_away: score(biggest('L', false)),
  longest_win_streak: longest('W'), longest_draw_streak: longest('D'), longest_loss_streak: longest('L'),
  lineups_json: JSON.stringify(formations),
};

const calendar = matches.map((match,index) => ({
  external_key: match.external_key,
  date: match.date,
  season,
  competition,
  round: String(index + 1),
  home_team: match.home_team,
  away_team: match.away_team,
  home_score: match.home_score,
  away_score: match.away_score,
  halftime_score: match.halftime_score,
  stadium: match.stadium,
  attendance: match.attendance,
  referee: match.referee,
  possession_home: match.possession_home,
  possession_away: match.possession_away,
  shots_home: match.shots_home,
  shots_away: match.shots_away,
  shots_on_target_home: match.shots_on_target_home,
  shots_on_target_away: match.shots_on_target_away,
  corners_home: match.corners_home,
  corners_away: match.corners_away,
  fouls_home: match.fouls_home,
  fouls_away: match.fouls_away,
  xg_home: match.xg_home,
  xg_away: match.xg_away,
  completeness_level: match.completeness_level,
  source_provider: match.source_provider,
  source_external_id: match.source_external_id,
  source_url: match.source_url,
}));

const calendarPath = path.resolve('data/matches/sassuolo-serie-a-2025-26.json');
fs.writeFileSync(calendarPath, `${JSON.stringify(calendar, null, 2)}\n`);

function csv(value: unknown) {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text;
}
const playerExportColumns = ['player_name','season','competition',...columnsForExport(),'source_provider','source_url'];
function columnsForExport() { return ['appearances','starts','minutes','shirt_number','position','rating','captain','substitutes_in','substitutes_out','substitutes_bench',...sumFields,'pass_accuracy']; }
const playerStatsPath = path.resolve('data/player-seasons/sassuolo-serie-a-2025-26-derived.csv');
const playerSource = `kickoff-derived (${covered.total}/38 detailed matches)`;
const playerCsv = [playerExportColumns.join(','),...playerRows.map(row => playerExportColumns.map(column => csv(
  column === 'source_provider' ? playerSource : column === 'source_url' ? null : row[column]
)).join(','))].join('\n');
fs.writeFileSync(playerStatsPath, `${playerCsv}\n`);

if (!apply) {
  console.log(JSON.stringify({mode:'dry-run',calendar:calendarPath,playerStats:playerStatsPath,matches:matches.length,detailCoverage:`${covered.total}/38`,players:playerRows.length,teamStats},null,2));
  process.exit(0);
}

const backup = createBackupSnapshot('before-complete-2025-26-derived-statistics');
const columns = ['appearances','starts','minutes','shirt_number','position','rating','captain','substitutes_in','substitutes_out','substitutes_bench',...sumFields,'pass_accuracy'];
const savePlayer = db.prepare(`INSERT INTO player_seasons(player_id,season,competition,${columns.join(',')},source_provider,last_verified_at)
  VALUES(?,?,?,${columns.map(()=>'?').join(',')},?,?)
  ON CONFLICT(player_id,season,competition) DO UPDATE SET
    ${columns.map(column=>`${column}=excluded.${column}`).join(',')},source_provider=excluded.source_provider,last_verified_at=excluded.last_verified_at
  WHERE COALESCE(player_seasons.source_provider,'') <> 'manual'`);
const saveTeam = db.prepare(`INSERT INTO team_season_stats(season,competition,played,wins,draws,losses,goals_for,goals_against,goals_for_avg,goals_against_avg,clean_sheets,failed_to_score,biggest_win_home,biggest_win_away,biggest_loss_home,biggest_loss_away,longest_win_streak,longest_draw_streak,longest_loss_streak,lineups_json,source_provider,last_verified_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(season,competition) DO UPDATE SET played=excluded.played,wins=excluded.wins,draws=excluded.draws,losses=excluded.losses,goals_for=excluded.goals_for,goals_against=excluded.goals_against,goals_for_avg=excluded.goals_for_avg,goals_against_avg=excluded.goals_against_avg,clean_sheets=excluded.clean_sheets,failed_to_score=excluded.failed_to_score,biggest_win_home=excluded.biggest_win_home,biggest_win_away=excluded.biggest_win_away,biggest_loss_home=excluded.biggest_loss_home,biggest_loss_away=excluded.biggest_loss_away,longest_win_streak=excluded.longest_win_streak,longest_draw_streak=excluded.longest_draw_streak,longest_loss_streak=excluded.longest_loss_streak,lineups_json=excluded.lineups_json,source_provider=excluded.source_provider,last_verified_at=excluded.last_verified_at`);

const changed = db.transaction(() => {
  let players = 0;
  const verifiedAt = nowIso();
  for (const row of playerRows) players += Number(savePlayer.run(row.player_id,season,competition,...columns.map(column=>row[column]),playerSource,verifiedAt).changes);
  saveTeam.run(season,competition,teamStats.played,teamStats.wins,teamStats.draws,teamStats.losses,teamStats.goals_for,teamStats.goals_against,teamStats.goals_for/teamStats.played,teamStats.goals_against/teamStats.played,teamStats.clean_sheets,teamStats.failed_to_score,teamStats.biggest_win_home,teamStats.biggest_win_away,teamStats.biggest_loss_home,teamStats.biggest_loss_away,teamStats.longest_win_streak,teamStats.longest_draw_streak,teamStats.longest_loss_streak,teamStats.lineups_json,`kickoff-derived (38/38 results; ${covered.total}/38 details)`,verifiedAt);
  const updateRound = db.prepare(`UPDATE matches SET round=? WHERE id=? AND (round IS NULL OR trim(round)='')`);
  let rounds = 0;
  matches.forEach((match,index) => { rounds += Number(updateRound.run(String(index+1),match.id).changes); });
  return {players,rounds,teamStats:1};
})();

recomputeDerivedPlayerStats();
recordChange({entityType:'player_seasons',action:'update',after:{season,competition,...changed,detailCoverage:`${covered.total}/38`,calendarPath,playerStatsPath},note:'Statistiche 2025/26 aggregate dai tabellini Kickoff e calendario reso riproducibile',backupId:backup.id});
console.log(JSON.stringify({mode:'applied',backup,...changed,matches:matches.length,detailCoverage:`${covered.total}/38`,calendar:calendarPath,playerStats:playerStatsPath},null,2));
