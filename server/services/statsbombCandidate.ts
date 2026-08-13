import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, normalizeNameForMatch, normalizeTeamName, nowIso, recordSourceReference } from '../db/database.js';

type Candidate={candidate_path:string;season:string;competition:string;source_provider?:string|null;source_url?:string|null};
type Manifest={sha256:string;rich_file:string;rich_sha256:string;raw_files?:Record<string,string>;validation?:{status?:string;unresolved_conflicts?:unknown[]}};
type RichData={season:string;competition:string;sourceProvider:string;sourceUrl:string;lastVerifiedAt:string;match:any;lineups:any[];events:any[]};
type Issue={row:number;field:string|null;code:string;message:string;critical:boolean};

const hashFile=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const equalHash=(expected:unknown,actual:string)=>/^[a-f0-9]{64}$/i.test(String(expected??''))&&String(expected).toLowerCase()===actual.toLowerCase();
const read=(dir:string)=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')) as Manifest;
  const richPath=path.join(dir,manifest.rich_file||'rich-data.json');
  const rich=JSON.parse(fs.readFileSync(richPath,'utf8')) as RichData;
  return {manifest,rich,richPath};
};
const fixtureFor=(rich:RichData)=>db.prepare(`SELECT * FROM matches WHERE season=? AND competition=? AND substr(date,1,10)=? AND lower(home_team)=lower(?) AND lower(away_team)=lower(?)`).get(rich.season,rich.competition,rich.match.date,normalizeTeamName(rich.match.homeTeam.name),normalizeTeamName(rich.match.awayTeam.name)) as any;

export function previewStatsBombCandidate(dir:string,candidate:Candidate){
  const issues:Issue[]=[];let manifest:Manifest,rich:RichData,richPath:string;
  try{({manifest,rich,richPath}=read(dir));}catch(error){return {entity:'match-details-statsbomb',filename:'rich-data.json',checksum:'',format:'json' as const,rows:0,validRows:0,discardedRows:1,created:0,updated:0,skipped:0,conflicts:0,errors:1,canApply:false,columnMappings:[],rowPreview:[],issues:[{row:0,field:null,code:'invalid_package',message:String(error),critical:true}]};}
  const dataHash=hashFile(path.join(dir,'data.csv')),richHash=hashFile(richPath);
  if(!equalHash(manifest.sha256,dataHash))issues.push({row:0,field:'data.csv',code:'checksum_mismatch',message:'Checksum data.csv non valido',critical:true});
  if(!equalHash(manifest.rich_sha256,richHash))issues.push({row:0,field:manifest.rich_file,code:'checksum_mismatch',message:'Checksum rich-data non valido',critical:true});
  for(const [file,expected] of Object.entries(manifest.raw_files??{})){const rawPath=path.join(dir,'source-files',file);if(!fs.existsSync(rawPath)||!equalHash(expected,hashFile(rawPath)))issues.push({row:0,field:file,code:'raw_checksum_mismatch',message:`Snapshot sorgente non valido: ${file}`,critical:true});}
  if(rich.season!==candidate.season||rich.competition!==candidate.competition)issues.push({row:0,field:null,code:'scope_mismatch',message:'Stagione/competizione non coincidono con il registro candidato',critical:true});
  const fixture=fixtureFor(rich);
  if(!fixture)issues.push({row:2,field:null,code:'fixture_not_found',message:'Fixture canonica non trovata',critical:true});
  else{
    if(Number(fixture.home_score)!==Number(rich.match.homeScore)||Number(fixture.away_score)!==Number(rich.match.awayScore))issues.push({row:2,field:null,code:'score_conflict',message:`Risultato canonico ${fixture.home_score}-${fixture.away_score}, StatsBomb ${rich.match.homeScore}-${rich.match.awayScore}`,critical:true});
    if(fixture.source_provider==='manual')issues.push({row:2,field:null,code:'manual_conflict',message:'Fixture protetta da modifica manuale',critical:true});
  }
  if(rich.lineups.length!==2||rich.lineups.some(lineup=>lineup.startXI?.length!==11))issues.push({row:2,field:'lineups',code:'invalid_lineups',message:'Servono due formazioni con 11 titolari',critical:true});
  const goals=rich.events.filter(event=>event.type==='Goal');
  if(goals.length!==Number(rich.match.homeScore)+Number(rich.match.awayScore))issues.push({row:2,field:'events',code:'goal_mismatch',message:'Numero di eventi Goal non coerente con il risultato',critical:true});
  if((manifest.validation?.unresolved_conflicts??[]).length)issues.push({row:0,field:null,code:'unresolved_conflicts',message:'Il manifest contiene conflitti irrisolti',critical:true});
  const existing=fixture?{
    details:Number((db.prepare('SELECT COUNT(*) count FROM match_details WHERE match_id=?').get(fixture.id) as any).count),
    lineups:Number((db.prepare(`SELECT COUNT(*) count FROM match_lineups WHERE match_id=? AND source_provider='StatsBomb Open Data'`).get(fixture.id) as any).count),
    events:Number((db.prepare(`SELECT COUNT(*) count FROM match_events WHERE match_id=? AND source_provider='StatsBomb Open Data'`).get(fixture.id) as any).count),
  }:{details:0,lineups:0,events:0};
  const created=(existing.details?0:1)+Math.max(0,rich.lineups.length-existing.lineups)+Math.max(0,rich.events.length-existing.events);
  const skipped=existing.details+existing.lineups+existing.events;
  const errors=issues.filter(issue=>issue.critical).length;
  // Il contratto comune del Data Manager confronta `preview.checksum` con
  // `manifest.sha256`, che identifica data.csv. rich-data.json e gli snapshot
  // raw sono comunque verificati separatamente sopra prima di abilitare apply.
  return {entity:'match-details-statsbomb',filename:'data.csv',checksum:dataHash,format:'csv' as const,rows:1,validRows:errors?0:1,discardedRows:errors?1:0,created,updated:fixture?1:0,skipped,conflicts:issues.filter(issue=>issue.code.includes('conflict')).length,errors,canApply:errors===0,columnMappings:[],rowPreview:[{row:2,status:errors?'conflict':'valid',action:created?'create':'skip',issues:errors}],issues,counts:{lineups:rich.lineups.length,events:rich.events.length,existing},richChecksum:richHash};
}

function localPlayerId(name:string){
  const normalized=normalizeNameForMatch(name);
  const matches=(db.prepare('SELECT id,name FROM players').all() as {id:number;name:string}[]).filter(player=>normalizeNameForMatch(player.name)===normalized);
  return matches.length===1?matches[0].id:null;
}

export function importStatsBombCandidate(dir:string,candidate:Candidate){
  const preview=previewStatsBombCandidate(dir,candidate);
  if(!preview.canApply)throw new Error(`Import StatsBomb bloccato: ${preview.errors} errori`);
  const {rich}=read(dir),fixture=fixtureFor(rich);if(!fixture)throw new Error('Fixture non trovata');
  // Le installazioni migrate dalle prime versioni conservano api_fixture_id
  // come NOT NULL. Usiamo il match ID StatsBomb in spazio negativo per non
  // collidere con gli ID positivi dei provider API storici.
  const localApiFixtureId=-Math.abs(Number(rich.match.providerMatchId));
  if(!Number.isSafeInteger(localApiFixtureId)||localApiFixtureId===0)throw new Error('providerMatchId StatsBomb non valido');
  let detailsCreated=0,lineupsCreated=0,eventsCreated=0,references=0;
  db.transaction(()=>{
    db.prepare(`UPDATE matches SET stadium=COALESCE(stadium,?),referee=COALESCE(referee,?),last_verified_at=? WHERE id=?`).run(rich.match.stadium??null,rich.match.referee??null,rich.lastVerifiedAt,fixture.id);
    for(const [field,value] of [['stadium',rich.match.stadium],['referee',rich.match.referee]] as const)if(value){recordSourceReference({entityType:'matches',entityId:fixture.id,field,sourceUrl:rich.sourceUrl,sourceProvider:rich.sourceProvider,originalValue:value,transformation:'statsbomb-poc:match-metadata',verifiedAt:rich.lastVerifiedAt});references++;}
    const detailExists=db.prepare('SELECT id FROM match_details WHERE match_id=?').get(fixture.id);
    if(!detailExists){db.prepare(`INSERT INTO match_details(match_id,api_fixture_id,source_provider,provider_match_id,status_long,status_short,venue_name,league_name,league_country,league_round,home_team_provider_id,home_team_name,away_team_provider_id,away_team_name,goals_home,goals_away,fulltime_home,fulltime_away,events_synced,lineups_synced,venue_synced,coaches_synced,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(fixture.id,localApiFixtureId,rich.sourceProvider,rich.match.providerMatchId,'Match Finished','FT',rich.match.stadium,'Serie A','Italy',`Giornata ${rich.match.matchWeek}`,String(rich.match.homeTeam.id),rich.match.homeTeam.name,String(rich.match.awayTeam.id),rich.match.awayTeam.name,rich.match.homeScore,rich.match.awayScore,rich.match.homeScore,rich.match.awayScore,1,1,rich.match.stadium?1:0,rich.lineups.some(row=>row.coachName)?1:0,rich.lastVerifiedAt);detailsCreated=1;}
    const insertLineup=db.prepare(`INSERT OR IGNORE INTO match_lineups(match_id,api_fixture_id,source_provider,provider_match_id,provider_team_id,team_api_id,team_name,formation,coach_name,start_xi_json,substitutes_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    for(const lineup of rich.lineups){
      const enrich=(rows:any[])=>rows.map(row=>({...row,player:{...row.player,localPlayerId:localPlayerId(row.player.name)}}));
      const result=insertLineup.run(fixture.id,localApiFixtureId,rich.sourceProvider,rich.match.providerMatchId,String(lineup.teamId),-Math.abs(Number(lineup.teamId)),lineup.teamName,lineup.formation||null,lineup.coachName??null,JSON.stringify(enrich(lineup.startXI)),JSON.stringify(enrich(lineup.substitutes)));lineupsCreated+=result.changes;
    }
    const eventExists=db.prepare(`SELECT 1 FROM match_events WHERE match_id=? AND source_provider=? AND provider_event_id=?`);
    const insertEvent=db.prepare(`INSERT INTO match_events(match_id,api_fixture_id,source_provider,provider_match_id,provider_event_id,sequence_number,minute,extra_minute,team_provider_id,team_name,player_provider_id,player_id,player_name,assist_player_provider_id,assist_player_id,assist_name,type,detail,scoring_play,home_score,away_score,source_url,verification_note,verified_by,last_verified_at) VALUES(${Array.from({length:25},()=>'?').join(',')})`);
    for(const event of rich.events){if(eventExists.get(fixture.id,rich.sourceProvider,event.providerEventId))continue;const playerId=event.playerName?localPlayerId(event.playerName):null,assistId=event.assistName?localPlayerId(event.assistName):null;const result=insertEvent.run(fixture.id,localApiFixtureId,rich.sourceProvider,rich.match.providerMatchId,event.providerEventId,event.sequenceNumber,event.minute,event.extraMinute,event.teamId==null?null:String(event.teamId),event.teamName,event.playerId==null?null:String(event.playerId),playerId,event.playerName,event.assistPlayerId==null?null:String(event.assistPlayerId),assistId,event.assistName,event.type,event.detail,event.scoringPlay,event.homeScore,event.awayScore,rich.sourceUrl,'Evento selezionato dallo stream StatsBomb Open Data.','DATA-01 StatsBomb POC',rich.lastVerifiedAt);eventsCreated+=result.changes;}
  })();
  return {fixtureId:fixture.id,created:detailsCreated+lineupsCreated+eventsCreated,updated:1,skipped:preview.skipped,detailsCreated,lineupsCreated,eventsCreated,provenanceReferences:references,importedAt:nowIso()};
}
