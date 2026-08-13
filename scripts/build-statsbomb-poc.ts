import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MATCH_ID = 3879771;
const SOURCE_ROOT = 'https://raw.githubusercontent.com/hudl/open-data/master/data';
const outputDir = path.resolve(process.argv[3] ?? 'data/reconciliation/candidates/match-details-statsbomb-serie-a-2015-16-poc');
const inputDir = path.resolve(process.argv[2] ?? path.join(outputDir,'source-files'));
const verifiedAt = '2026-08-13';

const readJson = (file:string) => JSON.parse(fs.readFileSync(path.join(inputDir,file),'utf8'));
const sha256 = (file:string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const csvCell = (value:unknown) => { const text=value==null?'':String(value); return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text; };

const matches=readJson('matches-12-27.json') as any[];
const events=readJson(`events-${MATCH_ID}.json`) as any[];
const lineups=readJson(`lineups-${MATCH_ID}.json`) as any[];
const match=matches.find(item=>item.match_id===MATCH_ID);
if(!match)throw new Error(`Match StatsBomb ${MATCH_ID} non trovato`);
if(match.match_date!=='2016-03-06'||match.home_team?.home_team_name!=='Sassuolo'||match.away_team?.away_team_name!=='AC Milan')throw new Error('La fixture StatsBomb non coincide con la POC attesa');

const startingEvents=new Map(events.filter(event=>event.type?.name==='Starting XI').map(event=>[event.team?.id,event]));
const normalizedLineups=lineups.map(team=>{
  const starting=startingEvents.get(team.team_id)?.tactics?.lineup??[];
  const starterIds=new Set(starting.map((row:any)=>row.player?.id));
  const positionById=new Map(starting.map((row:any)=>[row.player?.id,row.position?.name??null]));
  const numberById=new Map(starting.map((row:any)=>[row.player?.id,row.jersey_number??null]));
  const players=team.lineup.map((row:any)=>({player:{id:`statsbomb:${row.player_id}`,providerId:row.player_id,name:row.player_name,number:numberById.get(row.player_id)??row.jersey_number??null,pos:positionById.get(row.player_id)??null}}));
  return {teamId:team.team_id,teamName:team.team_name,formation:String(startingEvents.get(team.team_id)?.tactics?.formation??''),coachName:(match.home_team?.home_team_id===team.team_id?match.home_team_managers:match.away_team_managers)?.[0]?.name??null,startXI:players.filter((row:any)=>starterIds.has(row.player.providerId)),substitutes:players.filter((row:any)=>!starterIds.has(row.player.providerId))};
});

let homeScore=0,awayScore=0;
const passesById=new Map(events.filter(event=>event.id).map(event=>[event.id,event]));
const keyEvents=events.filter(event=>event.type?.name==='Substitution'||event.type?.name==='Shot'&&event.shot?.outcome?.name==='Goal'||event.type?.name==='Foul Committed'&&event.foul_committed?.card).map(event=>{
  const isGoal=event.type.name==='Shot';
  if(isGoal){if(event.team?.id===match.home_team.home_team_id)homeScore++;else awayScore++;}
  const keyPass=isGoal&&event.shot?.key_pass_id?passesById.get(event.shot.key_pass_id):null;
  const card=event.foul_committed?.card?.name??null;
  return {
    providerEventId:event.id,sequenceNumber:event.index,minute:event.minute,extraMinute:null,
    teamId:event.team?.id??null,teamName:event.team?.name??null,playerId:event.player?.id??null,playerName:event.player?.name??null,
    assistPlayerId:isGoal?keyPass?.player?.id??null:event.substitution?.replacement?.id??null,
    assistName:isGoal?keyPass?.player?.name??null:event.substitution?.replacement?.name??null,
    type:isGoal?'Goal':event.type.name==='Substitution'?'Substitution':'Card',
    detail:isGoal?`${event.shot?.type?.name??'Shot'} · ${event.shot?.body_part?.name??'N/D'}`:event.type.name==='Substitution'?event.substitution?.outcome?.name??'Substitution':card,
    scoringPlay:isGoal?1:0,homeScore:isGoal?homeScore:null,awayScore:isGoal?awayScore:null,
  };
});
if(homeScore!==match.home_score||awayScore!==match.away_score)throw new Error(`Gol evento ${homeScore}-${awayScore} non coerenti con il risultato ${match.home_score}-${match.away_score}`);
if(normalizedLineups.length!==2||normalizedLineups.some(team=>team.startXI.length!==11))throw new Error('Formazioni iniziali incomplete');

fs.mkdirSync(path.join(outputDir,'source-files'),{recursive:true});
for(const file of [`matches-12-27.json`,`events-${MATCH_ID}.json`,`lineups-${MATCH_ID}.json`]){
  const source=path.join(inputDir,file),target=path.join(outputDir,'source-files',file);
  if(path.resolve(source)!==path.resolve(target))fs.copyFileSync(source,target);
}
const sourceUrl=`https://github.com/hudl/open-data/tree/master/data`;
const rich={schemaVersion:1,season:'2015/16',competition:'Serie A',sourceProvider:'StatsBomb Open Data',sourceUrl,lastVerifiedAt:verifiedAt,match:{providerMatchId:String(MATCH_ID),date:match.match_date,kickOff:match.kick_off,matchWeek:match.match_week,homeTeam:{id:match.home_team.home_team_id,name:match.home_team.home_team_name},awayTeam:{id:match.away_team.away_team_id,name:match.away_team.away_team_name},homeScore:match.home_score,awayScore:match.away_score,stadium:match.stadium?.name??null,referee:match.referee?.name??null},lineups:normalizedLineups,events:keyEvents};
fs.writeFileSync(path.join(outputDir,'rich-data.json'),JSON.stringify(rich,null,2)+'\n','utf8');
const headers=['match_date','home_team','away_team','stadium','referee','source_provider','source_url','last_verified_at','provider_match_id','lineups','key_events'];
const values=[match.match_date,match.home_team.home_team_name,match.away_team.away_team_name,match.stadium?.name??'',match.referee?.name??'','StatsBomb Open Data',sourceUrl,verifiedAt,MATCH_ID,normalizedLineups.length,keyEvents.length];
fs.writeFileSync(path.join(outputDir,'data.csv'),headers.map(csvCell).join(',')+'\n'+values.map(csvCell).join(',')+'\n','utf8');
fs.writeFileSync(path.join(outputDir,'aliases.csv'),'source_name,canonical_name,entity_type\nSassuolo,U.S. Sassuolo Calcio,team\nAC Milan,Milan,team\n','utf8');
fs.writeFileSync(path.join(outputDir,'discrepancies.csv'),'field,source_value,canonical_value,status,resolution\nhome_team,Sassuolo,U.S. Sassuolo Calcio,resolved,Alias squadra già gestito dal normalizzatore\naway_team,AC Milan,Milan,resolved,Alias squadra già gestito dal normalizzatore\n','utf8');
fs.writeFileSync(path.join(outputDir,'SOURCES.md'),`# Fonti — POC StatsBomb Serie A 2015/16\n\nPacchetto limitato a **Sassuolo–Milan del 6 marzo 2016** (StatsBomb match ID \`${MATCH_ID}\`).\n\n- Repository e condizioni d'uso: <https://github.com/hudl/open-data>\n- Metadata stagione/partita: <${SOURCE_ROOT}/matches/12/27.json>\n- Eventi: <${SOURCE_ROOT}/events/${MATCH_ID}.json>\n- Formazioni: <${SOURCE_ROOT}/lineups/${MATCH_ID}.json>\n\nIl file normalizzato conserva stadio, arbitro, due formazioni e soltanto gli eventi editorialmente utili alla scheda partita (gol, cartellini e sostituzioni). L'intero stream evento resta archiviato in \`source-files/\` e non viene riversato integralmente nell'interfaccia. Nessun dato assente viene trasformato in zero.\n`,'utf8');
fs.writeFileSync(path.join(outputDir,'source-files','README.md'),`# Snapshot sorgente\n\nI tre JSON sono copie byte-per-byte dei file StatsBomb Open Data scaricati il ${verifiedAt}. Il manifest ne registra gli SHA-256.\n`,'utf8');
const dataPath=path.join(outputDir,'data.csv'),richPath=path.join(outputDir,'rich-data.json');
const rawFiles=Object.fromEntries([`matches-12-27.json`,`events-${MATCH_ID}.json`,`lineups-${MATCH_ID}.json`].map(file=>[file,sha256(path.join(outputDir,'source-files',file))]));
const manifest={area:'match_details_statsbomb',season:'2015/16',competition:'Serie A',source_provider:'StatsBomb Open Data',source_url:sourceUrl,verified_at:verifiedAt,file:'data.csv',sha256:sha256(dataPath),rich_file:'rich-data.json',rich_sha256:sha256(richPath),records_total:1,records_discarded:0,discard_reasons:[],fields_covered:['stadium','referee','lineups','goals','cards','substitutions'],counts:{raw_events:events.length,key_events:keyEvents.length,lineups:normalizedLineups.length,players:lineups.reduce((sum,team)=>sum+team.lineup.length,0)},raw_files:rawFiles,validation:{status:'reconciled',checks:[{name:'fixture_identity',status:'passed',note:'Match ID, data, squadre e risultato verificati.'},{name:'starting_xi',status:'passed',note:'11 titolari per ciascuna squadra.'},{name:'goal_reconciliation',status:'passed',note:`${homeScore}-${awayScore} dagli eventi Goal coincide con il risultato finale.`},{name:'editorial_event_filter',status:'passed',note:'Solo gol, cartellini e sostituzioni saranno pubblicati; lo stream completo resta raw.'},{name:'nullable_unknowns',status:'passed',note:'I campi non presenti restano NULL.'}],unresolved_conflicts:[]},notes:['POC di una singola partita prima dell’estensione alle 38 gare del Sassuolo in Serie A 2015/16.','Richiede approvazione manuale nel Data Manager prima dell’import.']};
fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({outputDir,matchId:MATCH_ID,rawEvents:events.length,keyEvents:keyEvents.length,lineups:normalizedLineups.map(team=>({team:team.teamName,starters:team.startXI.length,substitutes:team.substitutes.length})),sha256:manifest.sha256,richSha256:manifest.rich_sha256},null,2));
