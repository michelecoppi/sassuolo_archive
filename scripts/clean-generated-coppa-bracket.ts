import { db, initDb } from '../server/db/database.js';

initDb();
const target=`source_provider='openfootball/italy' AND external_key LIKE 'openfootball-coppa|%'`;
const count=(db.prepare(`SELECT COUNT(*) AS total FROM matches WHERE ${target}`).get() as {total:number}).total;
db.prepare(`DELETE FROM matches WHERE ${target}`).run();
console.log(`Removed ${count} display-only Coppa Italia bracket fixture(s) from the match archive.`);
const duplicates=db.prepare(`DELETE FROM matches WHERE external_key IN ('openfootball-cup|2024-25|2024-08-09|Sassuolo Calcio|AS Cittadella','openfootball-cup|2024-25|2024-09-24|US Lecce|Sassuolo Calcio')`).run().changes;
console.log(`Removed ${duplicates} legacy duplicate Coppa Italia fixture(s).`);
