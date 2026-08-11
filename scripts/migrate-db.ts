import { getSchemaVersion, initDb } from '../server/db/database.js';

initDb();
console.log(JSON.stringify({ok:true,schemaVersion:getSchemaVersion()},null,2));
