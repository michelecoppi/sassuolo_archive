import fs from 'node:fs';
import path from 'node:path';
import { db, initDb } from '../server/db/database.js';

initDb();

const dbPath = path.resolve('server/db/sassuolo.db');
const backupDir = path.resolve('server/db/backups');
fs.mkdirSync(backupDir, { recursive: true });

// Flush the WAL before copying the database file so the backup is consistent.
try { db.pragma('wal_checkpoint(FULL)'); } catch {}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `sassuolo-before-match-clean-${stamp}.db`);
fs.copyFileSync(dbPath, backupPath);

const scalar = (sql: string, ...args: any[]) =>
  Number((db.prepare(sql).get(...args) as { c: number } | undefined)?.c ?? 0);

const before = {
  apiFootballMatches: scalar(`SELECT count(*) AS c FROM matches WHERE source_provider='api-football' OR external_key LIKE 'api-football:%'`),
  legacyDetails: scalar(`SELECT count(*) AS c FROM match_details WHERE COALESCE(source_provider,'api-football') = 'api-football'`),
  legacyEvents: scalar(`SELECT count(*) AS c FROM match_events WHERE COALESCE(source_provider,'api-football') = 'api-football'`),
  legacyLineups: scalar(`SELECT count(*) AS c FROM match_lineups WHERE COALESCE(source_provider,'api-football') = 'api-football'`),
  legacyTeamStats: scalar(`SELECT count(*) AS c FROM match_team_stats WHERE COALESCE(source_provider,'api-football') = 'api-football'`),
  legacyPlayerStats: scalar(`SELECT count(*) AS c FROM match_player_stats WHERE COALESCE(source_provider,'api-football') = 'api-football'`),
  legacyInjuries: scalar(`SELECT count(*) AS c FROM match_injuries WHERE COALESCE(source_provider,'api-football') = 'api-football'`)
};

const clean = db.transaction(() => {
  // Remove only API-Football/legacy API-Football match-detail rows. Kickoff,
  // manual and other-provider details are intentionally preserved.
  db.prepare(`DELETE FROM match_injuries WHERE COALESCE(source_provider,'api-football') = 'api-football'`).run();
  db.prepare(`DELETE FROM match_player_stats WHERE COALESCE(source_provider,'api-football') = 'api-football'`).run();
  db.prepare(`DELETE FROM match_team_stats WHERE COALESCE(source_provider,'api-football') = 'api-football'`).run();
  db.prepare(`DELETE FROM match_lineups WHERE COALESCE(source_provider,'api-football') = 'api-football'`).run();
  db.prepare(`DELETE FROM match_events WHERE COALESCE(source_provider,'api-football') = 'api-football'`).run();
  db.prepare(`DELETE FROM match_details WHERE COALESCE(source_provider,'api-football') = 'api-football'`).run();

  // Remove only match records whose provider is API-Football. Foreign keys
  // cascade any remaining child rows belonging to those matches.
  const deletedMatches = db.prepare(`
    DELETE FROM matches
    WHERE source_provider='api-football'
       OR external_key LIKE 'api-football:%'
  `).run().changes;

  // Clear only the obsolete API-Football fixture/detail sync counters.
  db.prepare(`DELETE FROM sync_state WHERE provider='api-football' AND resource IN ('fixtures','fixture-details')`).run();
  return Number(deletedMatches);
});

const deletedMatches = clean();
try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}

console.log('\n✅ Pulizia match API-Football completata');
console.log(`Backup: ${backupPath}`);
console.log(`Match API-Football rimossi: ${deletedMatches}`);
console.log(`Dettagli legacy rimossi: ${before.legacyDetails}`);
console.log(`Eventi legacy rimossi: ${before.legacyEvents}`);
console.log(`Formazioni legacy rimosse: ${before.legacyLineups}`);
console.log(`Statistiche squadra legacy rimosse: ${before.legacyTeamStats}`);
console.log(`Statistiche giocatore legacy rimosse: ${before.legacyPlayerStats}`);
console.log(`Infortuni legacy rimossi: ${before.legacyInjuries}`);
console.log('\nGiocatori, stagioni, PlayerSeason, classifiche e trasferimenti NON sono stati modificati.');
