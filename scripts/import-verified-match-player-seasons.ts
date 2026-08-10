import fs from 'node:fs';
import path from 'node:path';
import { createBackupSnapshot, db, initDb, nowIso, recordChange, recordSourceReference } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';
import { resolvePlayer, seedHistoricalPlayerAliases } from '../server/services/playerResolver.js';

type Row = { player_name: string; season: string; competition: string; appearances: number; starts: number; goals: number; source_provider: string; source_url: string };
type Expected = { appearances: number; starts: number; goals: number; matches: number };

const sourceFile = path.resolve('data/player-seasons/verified-match-reports-2020-2023.csv');
const expected = new Map<string, Expected>([
  ['2016/17|Europa League', { matches: 10, appearances: 140, starts: 110, goals: 15 }],
  ['2020/21|Coppa Italia', { matches: 1, appearances: 15, starts: 11, goals: 0 }],
  ['2021/22|Coppa Italia', { matches: 2, appearances: 30, starts: 22, goals: 2 }],
  ['2022/23|Coppa Italia', { matches: 1, appearances: 16, starts: 11, goals: 2 }],
]);

const additionalSources = new Map<string, Array<{ url: string; note: string }>>([
  ['2016/17|Europa League', [
    { url: 'https://dr.statbunker.com/competitions/SeasonAppearances?comp_id=572&club_id=1788', note: 'Girone: 6 gare; presenze, titolarità e gol pubblicati da StatBunker.' },
    { url: 'https://www.gazzetta.it/Calcio/Europa-League/28-07-2016/terzo-turno-preliminare-lucerna-sassuolo-1-1-tabellino-schneuwly-berardi-rigore-consigli-160509111052.shtml', note: 'Qualificazione, Lucerna-Sassuolo 1-1: formazione, sostituzioni e marcatore verificati.' },
    { url: 'https://www.skysports.com/football/sassuolo-vs-luzern/teams/362681', note: 'Qualificazione, Sassuolo-Lucerna 3-0: formazione, sostituzioni e marcatori verificati.' },
    { url: 'https://www.eurosport.it/calcio/europa-league/2016-2017/sassuolo-da-fantascienza-3-0-alla-stella-rossa-e-gironi-di-europa-league-a-un-passo_sto5728391/story.shtml', note: 'Play-off, Sassuolo-Stella Rossa 3-0: formazione, sostituzioni e marcatori verificati.' },
    { url: 'https://www.transfermarkt.com/red-star-belgrade_us-sassuolo/index/spielbericht/2752503', note: 'Play-off, Stella Rossa-Sassuolo 1-1: formazione, sostituzioni e marcatore verificati.' },
  ]],
  ['2021/22|Coppa Italia', [
    { url: 'https://www.canalesassuolo.it/diretta-sassuolo-cagliari-coppa-italia-cronaca-e-tabellino-dellottavo-di-finale/', note: 'Ottavo Sassuolo-Cagliari 1-0: formazione, sostituzioni e marcatore verificati.' },
  ]],
]);

function parseCsv(text: string): Row[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  return lines.map((line, index) => {
    const values = line.split(',');
    if (values.length !== keys.length) throw new Error(`CSV non valido alla riga ${index + 2}`);
    const row = Object.fromEntries(keys.map((key, valueIndex) => [key, values[valueIndex]])) as Record<string, string>;
    return { ...row, appearances: Number(row.appearances), starts: Number(row.starts), goals: Number(row.goals) } as Row;
  });
}

initDb();
seedHistoricalPlayerAliases();
const rows = parseCsv(fs.readFileSync(sourceFile, 'utf8'));
const validations = [...expected].map(([key, expectedValues]) => {
  const [season, competition] = key.split('|');
  const sourceRows = rows.filter(row => row.season === season && row.competition === competition);
  const actual = { rows: sourceRows.length, appearances: sourceRows.reduce((sum, row) => sum + row.appearances, 0), starts: sourceRows.reduce((sum, row) => sum + row.starts, 0), goals: sourceRows.reduce((sum, row) => sum + row.goals, 0) };
  const matchCount = (db.prepare('SELECT COUNT(*) AS total FROM matches WHERE season=? AND competition=?').get(season, competition) as { total: number }).total;
  if (matchCount !== expectedValues.matches || actual.appearances !== expectedValues.appearances || actual.starts !== expectedValues.starts || actual.goals !== expectedValues.goals) throw new Error(`${key}: validazione fallita ${JSON.stringify({ expected: expectedValues, actual, matchCount })}`);
  return { season, competition, matchCount, ...actual };
});

if (!process.argv.includes('--apply')) {
  const unresolvedPlayers = [...new Set(rows.filter(row => resolvePlayer({ name: row.player_name, sourceProvider: row.source_provider, sourceUrl: row.source_url, context: `verified:${row.season}:${row.competition}`, allowCreate: false }).status === 'conflict').map(row => row.player_name))];
  console.log(JSON.stringify({ mode: 'dry-run', sourceFile, validations, unresolvedPlayers }, null, 2));
  process.exit(0);
}

const backup = createBackupSnapshot('before-verified-match-reports-player-seasons-import');
const saveSeason = db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,source_provider,source_url,last_verified_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(player_id,season,competition) DO UPDATE SET appearances=excluded.appearances,starts=excluded.starts,goals=excluded.goals,source_provider=excluded.source_provider,source_url=excluded.source_url,last_verified_at=excluded.last_verified_at
  WHERE COALESCE(player_seasons.source_provider,'') <> 'manual'`);
const saved = db.transaction(() => {
  let createdPlayers = 0;
  let insertedOrUpdated = 0;
  for (const row of rows) {
    const player = resolvePlayer({ name: row.player_name, sourceProvider: row.source_provider, sourceUrl: row.source_url, context: `verified:${row.season}:${row.competition}`, allowCreate: false });
    if (player.status === 'conflict') continue;
    if (player.status === 'created') createdPlayers++;
    insertedOrUpdated += Number(saveSeason.run(player.playerId, row.season, row.competition, row.appearances, row.starts, null, row.goals, null, null, null, row.source_provider, row.source_url, nowIso()).changes);
    const entity = db.prepare('SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?').get(player.playerId, row.season, row.competition) as { id: number };
    const key = `${row.season}|${row.competition}`;
    recordSourceReference({ entityType: 'player_seasons', entityId: entity.id, sourceUrl: row.source_url, note: 'Presenze, titolarità e gol aggregati da tabellini di tutte le partite della competizione. Minuti, assist e cartellini restano N/D.' });
    for (const source of additionalSources.get(key) ?? []) recordSourceReference({ entityType: 'player_seasons', entityId: entity.id, sourceUrl: source.url, note: source.note });
  }
  return { createdPlayers, insertedOrUpdated };
})();
recomputeDerivedPlayerStats();
recordChange({ entityType: 'player_seasons', action: 'create', after: { ...saved, validations, rows: rows.length }, sourceUrl: 'https://dr.statbunker.com/competitions/SeasonAppearances', note: 'Import PlayerSeason da tabellini verificati, incluse le qualificazioni Europa League 2016/17', backupId: backup.id });
console.log(JSON.stringify({ mode: 'applied', backup, ...saved, validations, rows: rows.length }, null, 2));
