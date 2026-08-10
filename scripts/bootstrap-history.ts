import { initDb } from '../server/db/database.js';
import { bootstrapHistoricalLeagueData } from '../server/services/historicalBootstrap.js';
initDb();
bootstrapHistoricalLeagueData(console.log).then(r=>{console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=2;}).catch(e=>{console.error(e);process.exitCode=1;});
