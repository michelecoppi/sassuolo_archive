import fs from 'node:fs';
import path from 'node:path';
import { createBackupSnapshot, db, initDb, nowIso, recordChange, recordSourceReference } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';
import { resolvePlayer, seedHistoricalPlayerAliases } from '../server/services/playerResolver.js';

type Target = { season: string; competition: string; compId: number };
type Row = { player_name: string; appearances: number; starts: number | null; goals: number | null; source_external_id: string; source_url: string; season: string; competition: string };

// StatBunker publishes separate, competition-scoped appearance tables. These
// nine seasons reconcile to the complete Serie A campaign. Coppa Italia, the
// 2016/17 Europa League (only the group phase is covered), and 2025/26 (the
// page is partial) are intentionally excluded rather than being mislabelled.
const targets: Target[] = [
  { season: '2013/14', competition: 'Serie A', compId: 462 },
  { season: '2014/15', competition: 'Serie A', compId: 486 },
  { season: '2015/16', competition: 'Serie A', compId: 517 },
  { season: '2016/17', competition: 'Serie A', compId: 562 },
  { season: '2017/18', competition: 'Serie A', compId: 593 },
  { season: '2018/19', competition: 'Serie A', compId: 623 },
  { season: '2019/20', competition: 'Serie A', compId: 649 },
  { season: '2020/21', competition: 'Serie A', compId: 676 },
  { season: '2021/22', competition: 'Serie A', compId: 696 },
];

const nameAliases = new Map<string, string>([
  ['Domencio Berardi', 'Domenico Berardi'],
  ['Franciesco Acerbi', 'Francesco Acerbi'],
  ['Gregoire Defrel', 'Grégoire Defrel'],
  ['Lukas Haraslin', 'Lukáš Haraslín'],
]);
const agent = 'Mozilla/5.0 (compatible; SassuoloHistoryDataAudit/1.0; +local-research)';

function sourceUrl(target: Target) { return `https://dr.statbunker.com/competitions/SeasonAppearances?comp_id=${target.compId}&club_id=1788`; }
function clean(value: string) { return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim(); }
function numeric(value: string) { const valueText = clean(value).replace(/,/g, ''); return /^\d+$/.test(valueText) ? Number(valueText) : null; }
function csv(value: string | number | null) { if (value == null) return ''; const valueText = String(value); return /[",\r\n]/.test(valueText) ? `"${valueText.replace(/"/g, '""')}"` : valueText; }

function parse(html: string, target: Target): Row[] {
  const caption = html.indexOf('<caption><h1>');
  const bodyStart = caption < 0 ? -1 : html.indexOf('<tbody>', caption);
  const bodyEnd = bodyStart < 0 ? -1 : html.indexOf('</tbody>', bodyStart);
  if (bodyEnd < 0) throw new Error(`${target.season} ${target.competition}: tabella StatBunker non trovata`);
  const body = html.slice(bodyStart, bodyEnd);
  const rows: Row[] = [];
  for (const match of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cell[1]);
    const player = cells[0]?.match(/href='\/players\/GetHistoryStats\?player_id=(\d+)'[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
    const appearances = cells[1] == null ? null : numeric(cells[1]);
    if (!player || appearances == null) continue;
    rows.push({
      player_name: nameAliases.get(clean(player[2])) ?? clean(player[2]),
      appearances,
      starts: numeric(cells[2] ?? ''),
      goals: numeric(cells[6] ?? ''),
      source_external_id: player[1],
      source_url: sourceUrl(target),
      season: target.season,
      competition: target.competition,
    });
  }
  if (!rows.length) throw new Error(`${target.season} ${target.competition}: nessuna riga valida nella fonte`);
  return rows;
}
async function download(target: Target) {
  const response = await fetch(sourceUrl(target), { headers: { 'user-agent': agent, 'accept-language': 'en-GB,en;q=0.8' } });
  if (!response.ok) throw new Error(`${target.season} ${target.competition}: StatBunker HTTP ${response.status}`);
  return parse(await response.text(), target);
}

initDb();
seedHistoricalPlayerAliases();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const writeCsv = args.has('--write-csv') || apply;
const allRows: Row[] = [];
for (let index = 0; index < targets.length; index++) {
  allRows.push(...await download(targets[index]));
  if (index + 1 < targets.length) await new Promise(resolve => setTimeout(resolve, 350));
}

const expected = new Map((db.prepare(`SELECT season,competition,goals_for FROM seasons WHERE (season,competition) IN (${targets.map(() => '(?,?)').join(',')})`).all(...targets.flatMap(target => [target.season, target.competition])) as any[]).map(row => [`${row.season}|${row.competition}`, row.goals_for]));
const coverage = targets.map(target => {
  const rows = allRows.filter(row => row.season === target.season && row.competition === target.competition);
  return { season: target.season, competition: target.competition, rows: rows.length, sourceGoals: rows.reduce((sum, row) => sum + (row.goals ?? 0), 0), expectedGoals: expected.get(`${target.season}|${target.competition}`) ?? null };
});
const invalid = coverage.filter(item => !item.rows || item.expectedGoals != null && item.sourceGoals > item.expectedGoals);
if (invalid.length) throw new Error(`Validazione fallita: ${JSON.stringify(invalid)}`);

if (writeCsv) {
  const output = path.resolve('data/player-seasons/statbunker-high-priority-2013-2026.csv');
  const header = 'player_name,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,source_provider,source_external_id,source_url';
  const lines = allRows.map(row => [row.player_name, row.season, row.competition, row.appearances, row.starts, null, row.goals, null, null, null, 'StatBunker', row.source_external_id, row.source_url].map(csv).join(','));
  fs.writeFileSync(output, `${header}\n${lines.join('\n')}\n`, 'utf8');
}

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', rows: allRows.length, coverage, csvWritten: writeCsv }, null, 2));
  process.exit(0);
}

const backup = createBackupSnapshot('before-statbunker-player-seasons-import');
const saveSource = db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at) VALUES(?,?,?,?,?) ON CONFLICT(source_provider,source_player_id) DO UPDATE SET player_id=excluded.player_id,source_url=excluded.source_url,last_verified_at=excluded.last_verified_at`);
const saveSeason = db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,source_provider,source_url,last_verified_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=excluded.appearances,starts=excluded.starts,goals=excluded.goals,source_provider=excluded.source_provider,source_url=excluded.source_url,last_verified_at=excluded.last_verified_at
  WHERE COALESCE(player_seasons.source_provider,'') <> 'manual'`);
const saved = db.transaction(() => {
  let createdPlayers = 0, insertedOrUpdated = 0;
  for (const row of allRows) {
    const player = resolvePlayer({ name: row.player_name, sourceProvider: 'StatBunker', sourcePlayerId: row.source_external_id, sourceUrl: row.source_url, context: `statbunker:${row.season}:${row.competition}`, allowCreate: false });
    if (player.status === 'conflict') continue;
    if (player.status === 'created') createdPlayers++;
    saveSource.run(player.playerId, 'StatBunker', row.source_external_id, row.source_url, nowIso());
    const result = saveSeason.run(player.playerId, row.season, row.competition, row.appearances, row.starts, null, row.goals, null, null, null, 'StatBunker', row.source_url, nowIso());
    insertedOrUpdated += Number(result.changes);
    const entity = db.prepare(`SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(player.playerId, row.season, row.competition) as { id: number };
    recordSourceReference({ entityType: 'player_seasons', entityId: entity.id, sourceUrl: row.source_url, note: 'StatBunker SeasonAppearances: appearances, starts and goals. Metrics not published by the source remain N/D.' });
  }
  return { createdPlayers, insertedOrUpdated };
})();
recomputeDerivedPlayerStats();
recordChange({ entityType: 'player_seasons', action: 'create', after: { ...saved, rows: allRows.length, coverage }, sourceUrl: 'https://dr.statbunker.com/competitions/SeasonAppearances', note: 'Import StatBunker delle coperture PlayerSeason validate', backupId: backup.id });
console.log(JSON.stringify({ mode: 'applied', backup, ...saved, rows: allRows.length, coverage }, null, 2));
