import fs from 'node:fs';
import path from 'node:path';
import { db, initDb } from '../server/db/database.js';

initDb();

const dbPath = path.resolve('server/db/sassuolo.db');
const backupDir = path.resolve('server/db/backups');
fs.mkdirSync(backupDir, { recursive: true });

const count = (sql: string, ...params: any[]) => Number((db.prepare(sql).get(...params) as any)?.c ?? 0);

const dryRun = process.argv.includes('--dry-run');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `sassuolo-before-bigballs-clean-${stamp}.db`);

const before = {
  matches: count(`SELECT count(*) AS c FROM matches WHERE source_provider='bigballs' OR external_key LIKE 'bigballs:%'`),
  linkedOtherMatches: count(`SELECT count(*) AS c FROM matches WHERE bigballs_match_id IS NOT NULL AND COALESCE(source_provider,'')<>'bigballs' AND COALESCE(external_key,'') NOT LIKE 'bigballs:%'`),
  details: count(`SELECT count(*) AS c FROM match_details WHERE source_provider='bigballs'`),
  events: count(`SELECT count(*) AS c FROM match_events WHERE source_provider='bigballs'`),
  lineups: count(`SELECT count(*) AS c FROM match_lineups WHERE source_provider='bigballs'`),
  teamStats: count(`SELECT count(*) AS c FROM match_team_stats WHERE source_provider='bigballs'`),
  playerStats: count(`SELECT count(*) AS c FROM match_player_stats WHERE source_provider='bigballs'`),
  injuries: count(`SELECT count(*) AS c FROM match_injuries WHERE source_provider='bigballs'`)
};

if (dryRun) {
  console.log('DRY RUN: nessuna riga verrà modificata e nessun backup verrà creato.');
  console.table(before);
  process.exit(0);
}

try { db.pragma('wal_checkpoint(FULL)'); } catch {}
if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, backupPath);

const tx = db.transaction(() => {
  // Detail rows attached to a non-Big-Balls match are removed explicitly.
  db.prepare(`DELETE FROM match_injuries WHERE source_provider='bigballs'`).run();
  db.prepare(`DELETE FROM match_player_stats WHERE source_provider='bigballs'`).run();
  db.prepare(`DELETE FROM match_team_stats WHERE source_provider='bigballs'`).run();
  db.prepare(`DELETE FROM match_lineups WHERE source_provider='bigballs'`).run();
  db.prepare(`DELETE FROM match_events WHERE source_provider='bigballs'`).run();
  db.prepare(`DELETE FROM match_details WHERE source_provider='bigballs'`).run();

  // These are the match rows created/owned by Big Balls. Cascades clean any
  // remaining child rows. Manual/API-Football season/player data is untouched.
  db.prepare(`DELETE FROM matches WHERE source_provider='bigballs' OR external_key LIKE 'bigballs:%'`).run();
  // If Big Balls had only enriched a manual/other-provider match, preserve the
  // match itself and remove just the obsolete provider link.
  db.prepare(`UPDATE matches SET bigballs_match_id=NULL WHERE bigballs_match_id IS NOT NULL`).run();
  db.prepare(`DELETE FROM sync_state WHERE provider='bigballs'`).run();
});

tx();

console.log('Backup creato:', path.relative(process.cwd(), backupPath));
console.log('Righe Big Balls rimosse:');
console.table(before);
console.log('Pulizia completata. Ora puoi avviare il server e sincronizzare KickoffAPI.');
