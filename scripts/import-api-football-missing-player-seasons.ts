import { createBackupSnapshot, initDb, recordChange } from '../server/db/database.js';
import { syncApiFootballPlayersForSeason } from '../server/services/apiFootballSync.js';

const targets = [
  ['2016/17', 'Europa League'],
  ['2020/21', 'Coppa Italia'],
  ['2021/22', 'Coppa Italia'],
  ['2022/23', 'Coppa Italia'],
  ['2024/25', 'Coppa Italia'],
  ['2025/26', 'Coppa Italia'],
  ['2025/26', 'Serie A'],
] as const;

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ mode: 'dry-run', targets, note: 'Passa --apply per consultare API-Football e importare esclusivamente le competizioni che il provider dichiara.' }, null, 2));
  process.exit(0);
}

initDb();
const backup = createBackupSnapshot('before-api-football-missing-player-seasons-import');
const results: Array<{ season: string; competition: string; result: unknown }> = [];
for (const [season, competition] of targets) {
  const result = await syncApiFootballPlayersForSeason(season, competition);
  results.push({ season, competition, result });
  // The provider is rate-limited per minute; avoid a burst that turns a
  // coverage check into a partial import.
  await new Promise(resolve => setTimeout(resolve, 1_200));
}
recordChange({
  entityType: 'player_seasons',
  action: 'create',
  after: { targets, results },
  note: 'Tentativo controllato API-Football sulle coperture PlayerSeason mancanti',
  backupId: backup.id,
});
console.log(JSON.stringify({ mode: 'applied', backup, targets, results }, null, 2));
