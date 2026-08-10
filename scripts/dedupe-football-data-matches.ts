import fs from 'node:fs';
import path from 'node:path';
import { initDb, db } from '../server/db/database.js';

initDb();
const apply = process.argv.includes('--apply');
const aliases = [
  ['AC Milan', 'Milan'], ['AS Roma', 'Roma'], ['Hellas Verona', 'Verona'],
] as const;

function findDuplicates() {
  return db.prepare(`
  SELECT f.id, f.date, f.home_team, f.away_team, f.season, f.source_provider,
         other.id AS kept_id, other.source_provider AS kept_provider
  FROM matches f
  JOIN matches other ON substr(other.date, 1, 10)=substr(f.date, 1, 10)
    AND lower(other.home_team)=lower(f.home_team)
    AND lower(other.away_team)=lower(f.away_team)
    AND other.id<>f.id
  WHERE f.source_provider='football-data.co.uk'
    AND COALESCE(other.source_provider,'') NOT IN ('football-data.co.uk', 'manual')
  ORDER BY f.date, f.id
`).all() as { id: number; date: string; home_team: string; away_team: string; season: string; source_provider: string; kept_id: number; kept_provider: string }[];
}

const normalizations = aliases.flatMap(([from, to]) => {
  const home = Number((db.prepare(`SELECT COUNT(1) count FROM matches WHERE lower(home_team)=lower(?)`).get(from) as { count: number }).count);
  const away = Number((db.prepare(`SELECT COUNT(1) count FROM matches WHERE lower(away_team)=lower(?)`).get(from) as { count: number }).count);
  return home + away ? [{ from, to, home, away }] : [];
});
let duplicates = findDuplicates();

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', normalizations, duplicates }, null, 2));
  process.exit(duplicates.length ? 2 : 0);
}

if (duplicates.length || normalizations.length) {
  const backups = path.resolve('server/db/backups');
  fs.mkdirSync(backups, { recursive: true });
  const backup = path.join(backups, `sassuolo-before-football-data-dedupe-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  const updateHome = db.prepare('UPDATE matches SET home_team=? WHERE lower(home_team)=lower(?)');
  const updateAway = db.prepare('UPDATE matches SET away_team=? WHERE lower(away_team)=lower(?)');
  const remove = db.prepare('DELETE FROM matches WHERE id=?');
  db.transaction(() => {
    aliases.forEach(([from, to]) => { updateHome.run(to, from); updateAway.run(to, from); });
    duplicates = findDuplicates();
    duplicates.forEach(match => remove.run(match.id));
  })();
  console.log(JSON.stringify({ mode: 'applied', normalized: normalizations, removed: duplicates.length, backup }, null, 2));
} else {
  console.log(JSON.stringify({ mode: 'applied', normalized: [], removed: 0 }, null, 2));
}
