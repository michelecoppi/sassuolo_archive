import fs from 'node:fs';
import path from 'node:path';
import { createBackupSnapshot, db, nowIso, recordChange, recordImportRun, recordSourceReference } from '../server/db/database.js';
import { recomputeDerivedPlayerStats } from '../server/services/importer.js';

type EventInput = {
  date:string; minute:number; extraMinute?:number; team:string; player:string; playerId:number|null;
  detail:'Normal Goal'|'Penalty'; homeScore:number; awayScore:number; sourceUrl:string;
};
type Input = {
  season:string; competition:string;
  playerSeason:{playerId:number;playerName:string;goals:number;sourceProvider:string;sourceUrl:string};
  events:EventInput[];
};

const inputPath=path.resolve('data/reconciliation/candidates/match-events-coppa-italia-2014-15/data.json');
const candidatePath='data/reconciliation/candidates/match-events-coppa-italia-2014-15';
const input=JSON.parse(fs.readFileSync(inputPath,'utf8')) as Input;
const markCandidateImported=()=>db.prepare(`UPDATE research_candidates SET status='imported',validation_status='reconciled',imported_at=COALESCE(imported_at,?),last_seen_at=? WHERE candidate_path=?`).run(nowIso(),nowIso(),candidatePath);
const player=db.prepare('SELECT id,name FROM players WHERE id=?').get(input.playerSeason.playerId) as {id:number;name:string}|undefined;
if(!player||player.name!==input.playerSeason.playerName)throw new Error('Identità canonica di Nicola Sansone non trovata');

const resolved=input.events.map(event=>{
  const match=db.prepare(`SELECT id,home_team,away_team,home_score,away_score FROM matches WHERE season=? AND competition=? AND substr(date,1,10)=?`).get(input.season,input.competition,event.date) as any;
  if(!match)throw new Error(`Fixture non trovata: ${event.date}`);
  if(event.team!==match.home_team&&event.team!==match.away_team)throw new Error(`Squadra non coerente per ${event.date}: ${event.team}`);
  if(event.homeScore>match.home_score||event.awayScore>match.away_score)throw new Error(`Punteggio evento non coerente: ${event.date}`);
  if(event.playerId){const linked=db.prepare('SELECT name FROM players WHERE id=?').get(event.playerId) as {name:string}|undefined;if(!linked||linked.name!==event.player)throw new Error(`Identità giocatore non coerente: ${event.player}`);}
  return {event,match};
});

const existingEvents=resolved.filter(({event,match})=>db.prepare(`SELECT 1 FROM match_events WHERE match_id=? AND minute=? AND COALESCE(extra_minute,0)=? AND lower(COALESCE(player_name,''))=lower(?) AND type='Goal' LIMIT 1`).get(match.id,event.minute,event.extraMinute??0,event.player)).length;
const existingSeason=db.prepare(`SELECT id FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(input.playerSeason.playerId,input.season,input.competition) as {id:number}|undefined;
if(existingEvents===input.events.length&&existingSeason){recomputeDerivedPlayerStats();markCandidateImported();console.log(JSON.stringify({ok:true,idempotent:true,eventsCreated:0,playerSeasonCreated:0}));process.exit(0);}

const backup=createBackupSnapshot('before-coppa-italia-2014-15-event-links');
const startedAt=nowIso();let eventsCreated=0;let playerSeasonCreated=0;
const insertEvent=db.prepare(`INSERT INTO match_events(match_id,api_fixture_id,minute,extra_minute,team_name,player_id,player_name,type,detail,source_provider,provider_match_id,provider_event_id,scoring_play,home_score,away_score,source_url,verification_note,verified_by,last_verified_at,is_own_goal)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`);

db.transaction(()=>{
  for(const {event,match} of resolved){
    const exists=db.prepare(`SELECT id FROM match_events WHERE match_id=? AND minute=? AND COALESCE(extra_minute,0)=? AND lower(COALESCE(player_name,''))=lower(?) AND type='Goal' LIMIT 1`).get(match.id,event.minute,event.extraMinute??0,event.player) as {id:number}|undefined;
    if(exists)continue;
    const providerEventId=`historical:${match.id}:${event.minute}:${event.extraMinute??0}:${event.player.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
    const result=insertEvent.run(match.id,-match.id,event.minute,event.extraMinute??null,event.team,event.playerId,event.player,'Goal',event.detail,'historical-reconciliation',`historical:${match.id}`,providerEventId,1,event.homeScore,event.awayScore,event.sourceUrl,'Marcatore e minuto verificati nel pacchetto Coppa Italia 2014/15.','Codex DATA-01',nowIso());
    const id=Number(result.lastInsertRowid);const after=db.prepare('SELECT * FROM match_events WHERE id=?').get(id);
    recordSourceReference({entityType:'match_event',entityId:id,field:'player_id',sourceUrl:event.sourceUrl,sourceProvider:'historical-reconciliation',originalValue:event.playerId,transformation:'canonical-player-link',note:event.playerId?`Collegato al giocatore canonico ${event.playerId}`:'Giocatore avversario non presente nel database'});
    recordChange({entityType:'match_event',entityId:id,action:'create',after,sourceUrl:event.sourceUrl,note:'Evento-gol storico strutturato',author:'Codex DATA-01',backupId:backup.id});eventsCreated++;
  }
  if(!existingSeason){
    const result=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,goals,source_provider,source_url,last_verified_at) VALUES(?,?,?,?,?,?,?)`).run(input.playerSeason.playerId,input.season,input.competition,input.playerSeason.goals,input.playerSeason.sourceProvider,input.playerSeason.sourceUrl,nowIso());
    const id=Number(result.lastInsertRowid);const after=db.prepare('SELECT * FROM player_seasons WHERE id=?').get(id);
    recordSourceReference({entityType:'player_seasons',entityId:id,field:'goals',sourceUrl:input.playerSeason.sourceUrl,sourceProvider:input.playerSeason.sourceProvider,originalValue:input.playerSeason.goals,transformation:'sum-verified-match-goals',note:'Tre gol: doppietta contro Cittadella e rigore contro Milan.'});
    recordChange({entityType:'player_seasons',entityId:id,action:'create',after,sourceUrl:input.playerSeason.sourceUrl,note:'Statistiche Coppa Italia 2014/15: solo gol verificati; altri campi NULL',author:'Codex DATA-01',backupId:backup.id});playerSeasonCreated=1;
  }
})();
recomputeDerivedPlayerStats();
const runId=recordImportRun({kind:'manual_change',sourceProvider:'historical-reconciliation',area:'match_events+player_seasons',season:input.season,competition:input.competition,status:'succeeded',startedAt,finishedAt:nowIso(),recordsSeen:input.events.length+1,recordsCreated:eventsCreated+playerSeasonCreated,recordsSkipped:existingEvents,backupId:backup.id,notes:'Collegamento marcatori Coppa Italia 2014/15 alle identità canoniche disponibili'});
markCandidateImported();
console.log(JSON.stringify({ok:true,idempotent:false,backupId:backup.id,importRunId:runId,eventsCreated,playerSeasonCreated}));
