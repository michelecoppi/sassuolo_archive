import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const inputDir=path.resolve(process.argv[2]??'.tmp-statsbomb-full');
const outputDir=path.resolve(process.argv[3]??'data/reconciliation/candidates/match-details-statsbomb-serie-a-2015-16');
const sourceRoot='https://raw.githubusercontent.com/hudl/open-data/master/data';
const sourceUrl='https://github.com/hudl/open-data';
const verifiedAt='2026-08-13';
const sha=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const csvCell=(value:unknown)=>{const text=value==null?'':String(value);return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));

const allMatches=read(path.join(inputDir,'matches-12-27.json')) as any[];
const matches=allMatches.filter(match=>match.home_team?.home_team_name==='Sassuolo'||match.away_team?.away_team_name==='Sassuolo').sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date)));
if(matches.length!==38)throw new Error(`Attese 38 gare Sassuolo, trovate ${matches.length}`);

const rawIndex:Record<string,{url:string;sha256:string;bytes:number}>={};
const indexed=(relative:string,url:string)=>{const file=path.join(inputDir,relative);rawIndex[relative.replace(/\\/g,'/')]={url,sha256:sha(file),bytes:fs.statSync(file).size};return read(file);};
rawIndex['matches-12-27.json']={url:`${sourceRoot}/matches/12/27.json`,sha256:sha(path.join(inputDir,'matches-12-27.json')),bytes:fs.statSync(path.join(inputDir,'matches-12-27.json')).size};

const richMatches=matches.map(match=>{
  const id=Number(match.match_id),events=indexed(`events/${id}.json`,`${sourceRoot}/events/${id}.json`) as any[],lineups=indexed(`lineups/${id}.json`,`${sourceRoot}/lineups/${id}.json`) as any[];
  const starting=new Map(events.filter(event=>event.type?.name==='Starting XI').map(event=>[event.team?.id,event]));
  const normalizedLineups=lineups.map(team=>{
    const initial=starting.get(team.team_id)?.tactics?.lineup??[],starterIds=new Set(initial.map((row:any)=>row.player?.id));
    const positions=new Map(initial.map((row:any)=>[row.player?.id,row.position?.name??null])),numbers=new Map(initial.map((row:any)=>[row.player?.id,row.jersey_number??null]));
    const players=team.lineup.map((row:any)=>({player:{id:`statsbomb:${row.player_id}`,providerId:row.player_id,name:row.player_name,number:numbers.get(row.player_id)??row.jersey_number??null,pos:positions.get(row.player_id)??null}}));
    return {teamId:team.team_id,teamName:team.team_name,formation:String(starting.get(team.team_id)?.tactics?.formation??''),coachName:null,startXI:players.filter((row:any)=>starterIds.has(row.player.providerId)),substitutes:players.filter((row:any)=>!starterIds.has(row.player.providerId))};
  });
  if(normalizedLineups.length!==2||normalizedLineups.some(lineup=>lineup.startXI.length!==11))throw new Error(`${id}: formazione iniziale incompleta`);
  let homeScore=0,awayScore=0;const byId=new Map(events.map(event=>[event.id,event]));
  const keyEvents=events.filter(event=>event.type?.name==='Substitution'||event.type?.name==='Shot'&&event.shot?.outcome?.name==='Goal'||event.type?.name==='Own Goal Against'||event.type?.name==='Foul Committed'&&event.foul_committed?.card).map(event=>{
    const goal=event.type.name==='Shot'||event.type.name==='Own Goal Against',ownGoal=event.type.name==='Own Goal Against';
    const scoringTeamId=ownGoal?(event.team?.id===match.home_team.home_team_id?match.away_team.away_team_id:match.home_team.home_team_id):event.team?.id;
    const scoringTeamName=scoringTeamId===match.home_team.home_team_id?match.home_team.home_team_name:match.away_team.away_team_name;
    if(goal){if(scoringTeamId===match.home_team.home_team_id)homeScore++;else awayScore++;}
    const keyPass=goal&&!ownGoal&&event.shot?.key_pass_id?byId.get(event.shot.key_pass_id):null,card=event.foul_committed?.card?.name??null;
    return {providerEventId:event.id,sequenceNumber:event.index,minute:event.minute,extraMinute:null,teamId:event.team?.id??null,teamName:event.team?.name??null,scoringTeamName:goal?scoringTeamName:null,playerId:event.player?.id??null,playerName:event.player?.name??null,assistPlayerId:goal&&!ownGoal?keyPass?.player?.id??null:event.substitution?.replacement?.id??null,assistName:goal&&!ownGoal?keyPass?.player?.name??null:event.substitution?.replacement?.name??null,type:goal?'Goal':event.type.name==='Substitution'?'Substitution':'Card',detail:ownGoal?'Own Goal':goal?`${event.shot?.type?.name??'Shot'} · ${event.shot?.body_part?.name??'N/D'}`:event.type.name==='Substitution'?event.substitution?.outcome?.name??'Substitution':card,isOwnGoal:ownGoal?1:0,scoringPlay:goal?1:0,homeScore:goal?homeScore:null,awayScore:goal?awayScore:null};
  });
  if(homeScore!==Number(match.home_score)||awayScore!==Number(match.away_score))throw new Error(`${id}: gol ${homeScore}-${awayScore} diversi dal risultato`);
  const shots=events.filter(event=>event.type?.name==='Shot').map(event=>({providerEventId:event.id,minute:event.minute,second:event.second,teamId:event.team?.id??null,teamName:event.team?.name??null,playerId:event.player?.id??null,playerName:event.player?.name??null,outcome:event.shot?.outcome?.name??null,xg:event.shot?.statsbomb_xg??null,bodyPart:event.shot?.body_part?.name??null,shotType:event.shot?.type?.name??null,location:event.location??null,endLocation:event.shot?.end_location??null}));
  return {providerMatchId:String(id),date:match.match_date,kickOff:match.kick_off,matchWeek:match.match_week,homeTeam:{id:match.home_team.home_team_id,name:match.home_team.home_team_name},awayTeam:{id:match.away_team.away_team_id,name:match.away_team.away_team_name},homeScore:match.home_score,awayScore:match.away_score,stadium:match.stadium?.name??null,referee:match.referee?.name??null,lineups:normalizedLineups,events:keyEvents,shots};
});

fs.mkdirSync(path.join(outputDir,'source-files'),{recursive:true});
const rich={schemaVersion:1,season:'2015/16',competition:'Serie A',sourceProvider:'StatsBomb Open Data',sourceUrl,lastVerifiedAt:verifiedAt,matches:richMatches};
fs.writeFileSync(path.join(outputDir,'rich-data.json'),JSON.stringify(rich,null,2)+'\n','utf8');
fs.writeFileSync(path.join(outputDir,'source-index.json'),JSON.stringify(rawIndex,null,2)+'\n','utf8');
const headers=['match_date','home_team','away_team','home_score','away_score','stadium','referee','provider_match_id','lineups','key_events','shots','source_provider','source_url','last_verified_at'];
const rows=richMatches.map(match=>[match.date,match.homeTeam.name,match.awayTeam.name,match.homeScore,match.awayScore,match.stadium,match.referee,match.providerMatchId,match.lineups.length,match.events.length,match.shots.length,rich.sourceProvider,rich.sourceUrl,rich.lastVerifiedAt]);
fs.writeFileSync(path.join(outputDir,'data.csv'),[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n')+'\n','utf8');
fs.writeFileSync(path.join(outputDir,'aliases.csv'),'source_name,canonical_name,entity_type\nSassuolo,U.S. Sassuolo Calcio,team\nAC Milan,Milan,team\n','utf8');
fs.writeFileSync(path.join(outputDir,'discrepancies.csv'),'field,source_value,canonical_value,status,resolution\nhome_team,Sassuolo,U.S. Sassuolo Calcio,resolved,Alias canonico locale\nteam_name,AC Milan,Milan,resolved,Alias canonico locale\n','utf8');
fs.writeFileSync(path.join(outputDir,'SOURCES.md'),`# Fonti — StatsBomb Serie A 2015/16\n\nPerimetro: tutte le 38 partite di campionato del Sassuolo nella Serie A 2015/16.\n\nFonte e credito: **StatsBomb Open Data**, <https://github.com/hudl/open-data>. StatsBomb richiede di dichiarare la fonte e utilizzare il proprio marchio quando si pubblicano analisi o risultati derivati.\n\nI file originali sono elencati in \`source-index.json\` con URL diretto, SHA-256 e dimensione. Il flusso pubblico della scheda partita usa metadata, formazioni, gol, cartellini, sostituzioni e tiri/xG; gli altri eventi raw restano disponibili per elaborazioni successive.\n`,'utf8');
fs.writeFileSync(path.join(outputDir,'source-files','README.md'),`# Snapshot StatsBomb\n\nIl file opzionale \`statsbomb-raw.zip\` contiene i JSON originali delle 38 partite. \`source-index.json\` registra URL e SHA-256 di ogni sorgente. Credito: StatsBomb Open Data — https://github.com/hudl/open-data\n`,'utf8');
const dataPath=path.join(outputDir,'data.csv'),richPath=path.join(outputDir,'rich-data.json'),indexPath=path.join(outputDir,'source-index.json'),rawArchive=path.join(outputDir,'source-files','statsbomb-raw.zip');
const totals=richMatches.reduce((sum,match)=>({keyEvents:sum.keyEvents+match.events.length,shots:sum.shots+match.shots.length,players:sum.players+match.lineups.reduce((n,lineup)=>n+lineup.startXI.length+lineup.substitutes.length,0)}),{keyEvents:0,shots:0,players:0});
const manifest:any={area:'match_details_statsbomb_season',season:'2015/16',competition:'Serie A',source_provider:'StatsBomb Open Data',source_url:sourceUrl,verified_at:verifiedAt,file:'data.csv',sha256:sha(dataPath),rich_file:'rich-data.json',rich_sha256:sha(richPath),source_index:'source-index.json',source_index_sha256:sha(indexPath),records_total:38,records_discarded:0,fields_covered:['stadium','referee','lineups','goals','cards','substitutions','shots','xg'],counts:{matches:38,...totals,raw_files:Object.keys(rawIndex).length},validation:{status:'reconciled',checks:[{name:'single_scope',status:'passed'},{name:'fixture_count',status:'passed',note:'38/38 gare del Sassuolo.'},{name:'starting_xi',status:'passed',note:'Due XI da 11 per ogni gara.'},{name:'goal_reconciliation',status:'passed',note:'Gol evento coerenti con tutti i risultati.'},{name:'source_attribution',status:'passed',note:'Credito StatsBomb e URL presenti nel pacchetto.'}],unresolved_conflicts:[]},notes:['La POC già importata è inclusa e viene ignorata idempotentemente.','Gli eventi diversi da gol, cartellini e sostituzioni restano negli snapshot raw.']};
if(fs.existsSync(rawArchive))manifest.raw_archive={file:'source-files/statsbomb-raw.zip',sha256:sha(rawArchive),bytes:fs.statSync(rawArchive).size};
fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({outputDir,records:richMatches.length,...totals,rawFiles:Object.keys(rawIndex).length,rawArchive:manifest.raw_archive??null},null,2));
