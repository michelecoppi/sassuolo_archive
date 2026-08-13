import { existsSync, readFileSync, rmSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import process from 'node:process';

type EndpointBudget = { referenceP95Ms: number; maxBytes: number };
type Baseline = {
  datasetVersion: string;
  dataset: Record<string, number>;
  regressionTolerance: number;
  maxHeapDeltaMb: number;
  endpoints: Record<string, EndpointBudget>;
};

const dbPath = path.resolve('.tmp/perf-final-archive.db');
if (existsSync(dbPath)) rmSync(dbPath);
for (const suffix of ['-wal', '-shm']) if (existsSync(`${dbPath}${suffix}`)) rmSync(`${dbPath}${suffix}`);
process.env.SASSUOLO_DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

const baseline = JSON.parse(readFileSync(path.resolve('perf-baseline.json'), 'utf8')) as Baseline;
const [{ createApp }, { db }] = await Promise.all([import('../server/app.js'), import('../server/db/database.js')]);
createApp({ nodeEnv: 'test', adminToken: null, cacheTtlMs: 0 });

const seasons = Array.from({ length: 20 }, (_, index) => {
  const year = 2006 + index;
  return `${year}/${String(year + 1).slice(-2)}`;
});
const now = '2026-08-13T00:00:00.000Z';
const insertSeason = db.prepare(`INSERT INTO seasons(season,competition,matches,wins,draws,losses,goals_for,goals_against,points,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertPlayer = db.prepare(`INSERT INTO players(name,nationality,position,current_squad,source_provider,source_external_id,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?)`);
const insertPlayerSeason = db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,source_provider,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertMatch = db.prepare(`INSERT INTO matches(external_key,date,season,competition,round,home_team,away_team,home_score,away_score,completeness_level,source_provider,source_external_id,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertEvent = db.prepare(`INSERT INTO match_events(match_id,source_provider,provider_match_id,provider_event_id,minute,sequence_number,team_api_id,team_name,player_id,player_name,type,detail,scoring_play) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertLineup = db.prepare(`INSERT INTO match_lineups(match_id,source_provider,provider_match_id,team_api_id,team_name,formation,coach_name,start_xi_json,substitutes_json) VALUES(?,?,?,?,?,?,?,?,?)`);
const insertStat = db.prepare(`INSERT INTO match_player_stats(match_id,source_provider,provider_match_id,team_api_id,team_name,player_id,provider_player_id,api_football_player_id,player_name,minutes,shirt_number,position,rating,goals,assists,passes_total,tackles_total,statistics_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertReference = db.prepare(`INSERT INTO source_references(entity_type,entity_id,field,source_url,note,author,source_provider,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)`);

db.transaction(() => {
  for (const season of seasons) insertSeason.run(season, 'Serie A', 60, 22, 16, 22, 72, 70, 82, 'synthetic-perf', 'https://example.invalid/season', now);
  for (let index = 1; index <= 800; index++) insertPlayer.run(`Giocatore Benchmark ${String(index).padStart(4, '0')}`, index % 5 ? 'Italia' : 'Francia', ['D', 'C', 'A', 'P'][index % 4], index > 768 ? 1 : 0, 'synthetic-perf', `p-${index}`, `https://example.invalid/player/${index}`, now);
  for (let seasonIndex = 0; seasonIndex < seasons.length; seasonIndex++) {
    for (let slot = 0; slot < 32; slot++) {
      const playerId = ((seasonIndex * 37 + slot) % 800) + 1;
      insertPlayerSeason.run(playerId, seasons[seasonIndex], 'Serie A', 20 + slot % 18, 10 + slot % 20, 900 + slot * 43, slot % 12, slot % 8, slot % 7, slot % 37 === 0 ? 1 : 0, 'synthetic-perf', now);
    }
  }
  let matchNumber = 0;
  for (let seasonIndex = 0; seasonIndex < seasons.length; seasonIndex++) {
    for (let round = 1; round <= 60; round++) {
      matchNumber++;
      const month = String(((round - 1) % 10) + 1).padStart(2, '0');
      const day = String(((round * 3) % 27) + 1).padStart(2, '0');
      const home = round % 2 ? 'Sassuolo' : `Avversaria ${round % 20}`;
      const away = round % 2 ? `Avversaria ${round % 20}` : 'Sassuolo';
      const result = insertMatch.run(`perf-${matchNumber}`, `${2006 + seasonIndex}-${month}-${day}`, seasons[seasonIndex], 'Serie A', `Giornata ${round}`, home, away, round % 4, (round + 1) % 3, 'DETAILED', 'synthetic-perf', String(matchNumber), `https://example.invalid/match/${matchNumber}`, now);
      const matchId = Number(result.lastInsertRowid);
      const squadIds = Array.from({ length: 22 }, (_, slot) => ((seasonIndex * 37 + slot) % 800) + 1);
      const lineup = JSON.stringify(squadIds.slice(0, 11).map((id, grid) => ({ player: { id, name: `Giocatore Benchmark ${String(id).padStart(4, '0')}`, grid } })));
      for (const [teamIndex, team] of [home, away].entries()) insertLineup.run(matchId, 'synthetic-perf', String(matchNumber), 100 + teamIndex, team, '4-3-3', `Tecnico ${teamIndex}`, lineup, '[]');
      for (let event = 0; event < 16; event++) {
        const playerId = squadIds[event % squadIds.length];
        insertEvent.run(matchId, 'synthetic-perf', String(matchNumber), `${matchNumber}-${event}`, 5 + event * 5, event, event % 2 ? 101 : 100, event % 2 ? away : home, playerId, `Giocatore Benchmark ${String(playerId).padStart(4, '0')}`, event % 5 === 0 ? 'Goal' : 'Card', event % 5 === 0 ? 'Normal Goal' : 'Yellow Card', event % 5 === 0 ? 1 : 0);
      }
      for (let slot = 0; slot < squadIds.length; slot++) {
        const playerId = squadIds[slot];
        insertStat.run(matchId, 'synthetic-perf', String(matchNumber), slot < 11 ? 100 : 101, slot < 11 ? home : away, playerId, `p-${playerId}`, playerId, `Giocatore Benchmark ${String(playerId).padStart(4, '0')}`, 90, slot + 1, ['D', 'C', 'A', 'P'][slot % 4], 6 + (slot % 20) / 10, slot % 13 === 0 ? 1 : 0, slot % 11 === 0 ? 1 : 0, 20 + slot, 1 + slot % 5, '{}');
      }
      for (let reference = 0; reference < 30; reference++) insertReference.run('match', matchId, reference ? `field_${reference}` : null, `https://example.invalid/match/${matchNumber}#${reference}`, 'Riferimento sintetico', 'Benchmark', 'synthetic-perf', now, now);
    }
  }
  for (let playerId = 1; playerId <= 800; playerId++) insertReference.run('player', playerId, null, `https://example.invalid/player/${playerId}`, 'Profilo sintetico', 'Benchmark', 'synthetic-perf', now, now);
})();
db.pragma('optimize');

const counts = {
  seasons: Number((db.prepare('SELECT COUNT(*) count FROM seasons').get() as { count: number }).count),
  players: Number((db.prepare('SELECT COUNT(*) count FROM players').get() as { count: number }).count),
  playerSeasons: Number((db.prepare('SELECT COUNT(*) count FROM player_seasons').get() as { count: number }).count),
  matches: Number((db.prepare('SELECT COUNT(*) count FROM matches').get() as { count: number }).count),
  events: Number((db.prepare('SELECT COUNT(*) count FROM match_events').get() as { count: number }).count),
  lineups: Number((db.prepare('SELECT COUNT(*) count FROM match_lineups').get() as { count: number }).count),
  playerStats: Number((db.prepare('SELECT COUNT(*) count FROM match_player_stats').get() as { count: number }).count),
  sourceReferences: Number((db.prepare('SELECT COUNT(*) count FROM source_references').get() as { count: number }).count),
};
const failures: string[] = [];
for (const [name, expected] of Object.entries(baseline.dataset)) if (counts[name as keyof typeof counts] !== expected) failures.push(`volume ${name}: ${counts[name as keyof typeof counts]} invece di ${expected}`);

const queryPlans = [
  { name: 'matches-season', sql: `SELECT * FROM matches WHERE season=? ORDER BY date`, params: [seasons[9]], index: 'idx_matches_season' },
  { name: 'player-seasons', sql: `SELECT * FROM player_seasons WHERE player_id=?`, params: [1], index: 'idx_player_seasons_player' },
  { name: 'match-events', sql: `SELECT * FROM match_events WHERE match_id=? ORDER BY minute,extra_minute`, params: [1], index: 'idx_match_events_match' },
  { name: 'match-player-stats', sql: `SELECT * FROM match_player_stats WHERE match_id=?`, params: [1], index: 'idx_match_player_stats_match' },
  { name: 'source-references', sql: `SELECT * FROM source_references WHERE entity_type=? AND entity_id=?`, params: ['match', 1], index: 'idx_source_references_entity' },
].map((query) => {
  const detail = (db.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.params) as { detail: string }[]).map((row) => row.detail).join(' | ');
  if (!detail.includes(query.index)) failures.push(`query plan ${query.name}: indice ${query.index} non usato (${detail})`);
  return { name: query.name, detail };
});

const app = createApp({ nodeEnv: 'test', adminToken: null, cacheTtlMs: 0 });
const server = app.listen(0);
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Server benchmark non disponibile');
const base = `http://127.0.0.1:${address.port}/api`;
const endpoints: Record<string, string> = {
  '/matches?page=1&pageSize=50': '/matches?page=1&pageSize=50',
  '/matches/:id': '/matches/1',
  '/players?page=1&pageSize=50': '/players?page=1&pageSize=50',
  '/players/:id': '/players/1',
  '/seasons/:season': `/seasons/${encodeURIComponent(seasons[9])}?competition=Serie%20A`,
  '/search?q=avversaria': '/search?q=avversaria',
  '/data-manager': '/data-manager',
};
const percentile = (values: number[], ratio: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
const heapBefore = process.memoryUsage().heapUsed;
const measurements: Array<{ endpoint: string; p50Ms: number; p95Ms: number; bytes: number; budgetP95Ms: number }> = [];
for (const [label, endpoint] of Object.entries(endpoints)) {
  const separator = endpoint.includes('?') ? '&' : '?';
  for (let warmup = 0; warmup < 3; warmup++) await fetch(`${base}${endpoint}${separator}warmup=${warmup}`);
  const durations: number[] = [];
  let bytes = 0;
  for (let run = 0; run < 25; run++) {
    const started = performance.now();
    const response = await fetch(`${base}${endpoint}${separator}run=${run}`);
    const body = await response.arrayBuffer();
    if (!response.ok) failures.push(`${label}: HTTP ${response.status}`);
    durations.push(performance.now() - started);
    bytes = body.byteLength;
  }
  const budget = baseline.endpoints[label];
  const p95Ms = Number(percentile(durations, 0.95).toFixed(2));
  const budgetP95Ms = Number((budget.referenceP95Ms * baseline.regressionTolerance).toFixed(2));
  if (p95Ms > budgetP95Ms) failures.push(`${label}: p95 ${p95Ms}ms > budget ${budgetP95Ms}ms`);
  if (bytes > budget.maxBytes) failures.push(`${label}: payload ${bytes}B > budget ${budget.maxBytes}B`);
  measurements.push({ endpoint: label, p50Ms: Number(percentile(durations, 0.5).toFixed(2)), p95Ms, bytes, budgetP95Ms });
}
const heapDeltaMb = Number(((process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024).toFixed(2));
if (heapDeltaMb > baseline.maxHeapDeltaMb) failures.push(`heap delta ${heapDeltaMb}MB > budget ${baseline.maxHeapDeltaMb}MB`);

console.log(JSON.stringify({ datasetVersion: baseline.datasetVersion, counts, measurements, heapDeltaMb, queryPlans }, null, 2));
await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
db.close();
if (failures.length) {
  console.error(`PERF-05 fallito:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else console.log('PERF-05 OK: volume finale, p95/payload/memoria e query plan entro budget.');
