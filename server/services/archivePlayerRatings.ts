import { db, normalizeNameForMatch, nowIso, recordChange, recordSourceReference } from '../db/database.js';
import { currentSeason } from './currentSeason.js';
import { resolvePlayer } from './playerResolver.js';

export const ARCHIVE_RATING_VERSION = 'sar-1.0.0';

const INTEGER_FIELDS = [
  'minutes','shirt_number','captain','substitute','offsides','shots_total','shots_on','goals','own_goals',
  'goals_conceded','assists','saves','passes_total','passes_key','tackles_total','blocks','interceptions',
  'duels_total','duels_won','dribbles_attempts','dribbles_success','dribbles_past','fouls_drawn',
  'fouls_committed','yellow_cards','red_cards','penalty_won','penalty_committed','penalty_scored',
  'penalty_missed','penalty_saved',
] as const;

const EDITABLE_FIELDS = [...INTEGER_FIELDS, 'pass_accuracy'] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

export type ArchiveRatingRow = Partial<Record<EditableField, number | string | null>> & {
  player_id?: number | string | null;
  player_name?: string | null;
  position?: string | null;
};

type RatingContext = { result: 'W' | 'D' | 'L'; goalsAgainst: number };
type BreakdownItem = { key: string; label: string; delta: number };

const numberOrNull = (value: unknown) => value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value);
const intOrNull = (value: unknown) => { const valueNumber=numberOrNull(value);return valueNumber==null?null:Math.trunc(valueNumber); };
const clamp = (value: number, min: number, max: number) => Math.max(min,Math.min(max,value));
const rounded = (value: number) => Math.round(value*10)/10;
const isSassuolo = (value: unknown) => /sassuolo/i.test(String(value??''));

function roleOf(position: unknown) {
  const value=String(position??'').trim().toLowerCase();
  if(['g','gk','goalkeeper','goal keeper','keeper','portiere'].includes(value))return 'Goalkeeper';
  if(['d','df','defender','defence','defense','difensore'].includes(value))return 'Defender';
  if(['m','mf','midfielder','midfield','centrocampista'].includes(value))return 'Midfielder';
  if(['f','fw','attacker','forward','striker','attaccante'].includes(value))return 'Attacker';
  return 'Unknown';
}

function addFactor(items: BreakdownItem[], key: string, label: string, delta: number) {
  const value=rounded(delta);
  if(value!==0)items.push({key,label,delta:value});
  return delta;
}

function dataCoverage(row: ArchiveRatingRow) {
  const groups=[
    row.shots_total!=null||row.shots_on!=null||row.offsides!=null,
    row.passes_total!=null||row.passes_key!=null||row.pass_accuracy!=null,
    row.tackles_total!=null||row.blocks!=null||row.interceptions!=null,
    row.duels_total!=null||row.duels_won!=null,
    row.dribbles_attempts!=null||row.dribbles_success!=null,
    row.fouls_drawn!=null||row.fouls_committed!=null,
    row.saves!=null||row.goals_conceded!=null||row.penalty_saved!=null,
  ].filter(Boolean).length;
  const eventFields=['goals','own_goals','assists','yellow_cards','red_cards','penalty_won','penalty_committed','penalty_missed'] as const;
  const events=eventFields.some(field=>row[field]!=null);
  const confidence=clamp(0.35+(row.minutes!=null?0.15:0)+(row.position?0.05:0)+(events?0.1:0)+groups*0.055,0.35,0.95);
  return {confidence:Math.round(confidence*100)/100,level:groups>=5?'DETAILED':groups>=2?'STANDARD':'BASIC'} as const;
}

export function calculateArchiveRating(row: ArchiveRatingRow, context: RatingContext) {
  const minutes=intOrNull(row.minutes)??0;
  const decisive=(intOrNull(row.goals)??0)+(intOrNull(row.assists)??0)+(intOrNull(row.penalty_saved)??0)+(intOrNull(row.red_cards)??0)>0;
  const coverage=dataCoverage(row);
  if(minutes<=0||minutes<10&&!decisive)return {rating:null,version:ARCHIVE_RATING_VERSION,...coverage,breakdown:[] as BreakdownItem[],reason:minutes<=0?'not-played':'insufficient-minutes'};

  const role=roleOf(row.position),breakdown:BreakdownItem[]=[];
  let score=6;
  score+=addFactor(breakdown,'team-result',context.result==='W'?'Vittoria della squadra':context.result==='L'?'Sconfitta della squadra':'Pareggio',context.result==='W'?0.15:context.result==='L'?-0.15:0);

  const goals=intOrNull(row.goals)??0,assists=intOrNull(row.assists)??0,ownGoals=intOrNull(row.own_goals)??0;
  const goalWeight={Goalkeeper:1.4,Defender:1.15,Midfielder:0.95,Attacker:0.8,Unknown:0.9}[role];
  score+=addFactor(breakdown,'goals',`${goals} gol`,goals*goalWeight);
  score+=addFactor(breakdown,'assists',`${assists} assist`,assists*0.55);
  score+=addFactor(breakdown,'own-goals',`${ownGoals} autogol`,ownGoals*-1);

  const shotsOn=intOrNull(row.shots_on),shotsTotal=intOrNull(row.shots_total);
  if(shotsOn!=null)score+=addFactor(breakdown,'shots-on',`${shotsOn} tiri in porta`,clamp(shotsOn*0.06,0,0.3));
  if(shotsTotal!=null&&shotsOn!=null)score+=addFactor(breakdown,'shots-off','Precisione al tiro',clamp((shotsTotal-shotsOn)*-0.025,-0.2,0));

  const keyPasses=intOrNull(row.passes_key);
  if(keyPasses!=null)score+=addFactor(breakdown,'key-passes',`${keyPasses} passaggi chiave`,clamp(keyPasses*0.08,0,0.4));
  const passAccuracy=numberOrNull(row.pass_accuracy),passes=intOrNull(row.passes_total);
  if(passAccuracy!=null&&(passes??0)>=10){
    const expected={Goalkeeper:70,Defender:78,Midfielder:80,Attacker:72,Unknown:76}[role];
    score+=addFactor(breakdown,'passing',`Precisione passaggi ${passAccuracy}%`,clamp((passAccuracy-expected)*0.012,-0.35,0.35));
  }

  const tackles=intOrNull(row.tackles_total)??0,blocks=intOrNull(row.blocks)??0,interceptions=intOrNull(row.interceptions)??0;
  if(row.tackles_total!=null||row.blocks!=null||row.interceptions!=null)score+=addFactor(breakdown,'defending','Azioni difensive',clamp(tackles*0.06+blocks*0.08+interceptions*0.08,0,0.55));
  const duels=intOrNull(row.duels_total),duelsWon=intOrNull(row.duels_won);
  if(duels!=null&&duels>=3&&duelsWon!=null)score+=addFactor(breakdown,'duels',`Duelli vinti ${duelsWon}/${duels}`,clamp((duelsWon/duels*100-50)*0.012,-0.35,0.35));
  const dribbles=intOrNull(row.dribbles_attempts),dribblesWon=intOrNull(row.dribbles_success);
  if(dribbles!=null&&dribblesWon!=null)score+=addFactor(breakdown,'dribbles',`Dribbling riusciti ${dribblesWon}/${dribbles}`,clamp(dribblesWon*0.08-(dribbles-dribblesWon)*0.03,-0.2,0.35));

  score+=addFactor(breakdown,'fouls-drawn','Falli subiti',(intOrNull(row.fouls_drawn)??0)*0.04);
  score+=addFactor(breakdown,'fouls-committed','Falli commessi',(intOrNull(row.fouls_committed)??0)*-0.06);
  score+=addFactor(breakdown,'offsides','Fuorigioco',(intOrNull(row.offsides)??0)*-0.03);
  score+=addFactor(breakdown,'yellow-cards','Cartellini gialli',(intOrNull(row.yellow_cards)??0)*-0.15);
  score+=addFactor(breakdown,'red-cards','Cartellini rossi',(intOrNull(row.red_cards)??0)*-1);
  score+=addFactor(breakdown,'penalty-won','Rigori procurati',(intOrNull(row.penalty_won)??0)*0.35);
  score+=addFactor(breakdown,'penalty-committed','Rigori causati',(intOrNull(row.penalty_committed)??0)*-0.65);
  score+=addFactor(breakdown,'penalty-missed','Rigori sbagliati',(intOrNull(row.penalty_missed)??0)*-0.75);
  score+=addFactor(breakdown,'penalty-saved','Rigori parati',(intOrNull(row.penalty_saved)??0)*1.1);

  if(role==='Goalkeeper'){
    score+=addFactor(breakdown,'saves','Parate',(intOrNull(row.saves)??0)*0.12);
    score+=addFactor(breakdown,'goals-conceded','Gol subiti',(intOrNull(row.goals_conceded)??context.goalsAgainst)*-0.25);
  }
  if(minutes>=60&&context.goalsAgainst===0){
    const cleanSheet={Goalkeeper:0.45,Defender:0.3,Midfielder:0.15,Attacker:0,Unknown:0}[role];
    score+=addFactor(breakdown,'clean-sheet','Porta inviolata',cleanSheet);
  }
  if(minutes<20)score+=addFactor(breakdown,'short-appearance','Campione ridotto',-0.1);

  return {rating:rounded(clamp(score,3,10)),version:ARCHIVE_RATING_VERSION,...coverage,breakdown,reason:null};
}

function matchContext(match: any): RatingContext {
  const home=isSassuolo(match.home_team),goalsFor=home?match.home_score:match.away_score,goalsAgainst=home?match.away_score:match.home_score;
  return {result:goalsFor>goalsAgainst?'W':goalsFor===goalsAgainst?'D':'L',goalsAgainst:Number(goalsAgainst)};
}

function currentMatch(matchId: number) {
  return db.prepare(`SELECT * FROM matches WHERE id=? AND season=? AND (lower(home_team) LIKE '%sassuolo%' OR lower(away_team) LIKE '%sassuolo%')`).get(matchId,currentSeason()) as any;
}

function eventDefaults(matchId: number) {
  const values=new Map<string,Partial<Record<EditableField,number>>>();
  const ensure=(name:unknown)=>{const key=normalizeNameForMatch(name);if(!key)return null;const current=values.get(key)??{};values.set(key,current);return current;};
  const events=db.prepare(`SELECT * FROM match_events WHERE match_id=?`).all(matchId) as any[];
  for(const event of events){
    const type=`${event.type??''} ${event.detail??''}`.toLowerCase();
    const player=ensure(event.player_name);
    if(player&&isSassuolo(event.team_name)){
      if(type.includes('goal'))player.goals=(player.goals??0)+1;
      if(type.includes('yellow'))player.yellow_cards=(player.yellow_cards??0)+1;
      if(type.includes('red'))player.red_cards=(player.red_cards??0)+1;
      if(event.is_own_goal){player.goals=Math.max(0,(player.goals??0)-1);player.own_goals=(player.own_goals??0)+1;}
    }
    const assist=ensure(event.assist_name);
    if(assist&&isSassuolo(event.team_name)&&type.includes('goal')&&!event.is_own_goal)assist.assists=(assist.assists??0)+1;
  }
  return values;
}

function publicRow(row: any) {
  let breakdown: BreakdownItem[]=[];
  try{breakdown=JSON.parse(row.archive_rating_breakdown_json??'[]');}catch{}
  return {...row,archive_rating_breakdown:breakdown};
}

export function getCurrentMatchPlayerRatings(matchId: number) {
  const match=currentMatch(matchId);
  if(!match)throw new Error('Partita della stagione corrente non trovata');
  const existing=db.prepare(`SELECT mps.*,p.name AS canonical_player_name,p.position AS canonical_position,p.shirt_number AS canonical_shirt_number
    FROM match_player_stats mps LEFT JOIN players p ON p.id=mps.player_id WHERE mps.match_id=? AND (lower(COALESCE(mps.team_name,'')) LIKE '%sassuolo%' OR mps.player_id IN (SELECT id FROM players WHERE current_squad=1)) ORDER BY mps.minutes DESC,mps.player_name`).all(matchId) as any[];
  const byPlayer=new Map<number,any>();
  for(const row of existing)if(row.player_id&&!byPlayer.has(Number(row.player_id)))byPlayer.set(Number(row.player_id),row);
  const defaults=eventDefaults(matchId);
  const squad=db.prepare(`SELECT id,name,position,shirt_number FROM players WHERE current_squad=1 ORDER BY CASE position WHEN 'Goalkeeper' THEN 1 WHEN 'Defender' THEN 2 WHEN 'Midfielder' THEN 3 WHEN 'Attacker' THEN 4 ELSE 5 END,shirt_number,name`).all() as any[];
  const rows=squad.map(player=>{
    const stored=byPlayer.get(player.id)??{};
    const derived=defaults.get(normalizeNameForMatch(player.name))??{};
    const row:any={player_id:player.id,player_name:player.name,position:stored.position??player.position,shirt_number:stored.shirt_number??player.shirt_number,selected:Number(stored.minutes??0)>0};
    for(const field of EDITABLE_FIELDS)row[field]=stored[field]??derived[field]??null;
    return publicRow({...row,...stored,player_id:player.id,player_name:player.name,position:stored.position??player.position,shirt_number:stored.shirt_number??player.shirt_number,selected:Number(stored.minutes??0)>0});
  });
  for(const stored of existing.filter(row=>!row.player_id))rows.push(publicRow({...stored,selected:Number(stored.minutes??0)>0}));
  return {match,version:ARCHIVE_RATING_VERSION,methodology:'/docs/data/PLAYER_RATINGS.md',sourceSuggestions:['Referto ufficiale Lega Serie A','CSV o tabella di una fonte statistica verificabile','Inserimento manuale da formazione ed eventi'],rows};
}

function validateRow(row: ArchiveRatingRow, index: number) {
  const errors:string[]=[];
  for(const field of INTEGER_FIELDS){
    const value=numberOrNull(row[field]);
    if(value!=null&&(!Number.isInteger(value)||value<0))errors.push(`Riga ${index+1}: ${field} deve essere un intero non negativo.`);
  }
  const minutes=intOrNull(row.minutes);
  if(minutes==null||minutes<1||minutes>130)errors.push(`Riga ${index+1}: i minuti devono essere compresi tra 1 e 130.`);
  const passAccuracy=numberOrNull(row.pass_accuracy);
  if(passAccuracy!=null&&(passAccuracy<0||passAccuracy>100))errors.push(`Riga ${index+1}: pass_accuracy deve essere tra 0 e 100.`);
  for(const [won,total,label] of [[row.duels_won,row.duels_total,'duelli'],[row.dribbles_success,row.dribbles_attempts,'dribbling'],[row.shots_on,row.shots_total,'tiri']] as const){
    if(numberOrNull(won)!=null&&numberOrNull(total)!=null&&Number(won)>Number(total))errors.push(`Riga ${index+1}: il valore riuscito non può superare il totale (${label}).`);
  }
  return errors;
}

export function saveCurrentMatchPlayerRatings(matchId: number, payload: {rows?:ArchiveRatingRow[];sourceUrl?:string;verifiedBy?:string}) {
  const match=currentMatch(matchId);
  if(!match)throw new Error('Partita della stagione corrente non trovata');
  if(match.home_score==null||match.away_score==null)throw new Error('Completa prima il risultato finale della partita.');
  const sourceUrl=String(payload.sourceUrl??'').trim();
  let parsedSource:URL;try{parsedSource=new URL(sourceUrl);}catch{throw new Error('Inserisci un URL fonte valido.');}
  if(!['http:','https:'].includes(parsedSource.protocol))throw new Error('La fonte deve usare http o https.');
  const rows=Array.isArray(payload.rows)?payload.rows:[];
  if(!rows.length)throw new Error('Seleziona almeno un giocatore sceso in campo.');
  if(rows.length>30)throw new Error('Una partita non può contenere più di 30 righe del Sassuolo.');
  const errors=rows.flatMap(validateRow);
  if(errors.length)throw new Error(errors.join(' '));
  const defaults=eventDefaults(matchId),context=matchContext(match),seen=new Set<number>();
  const saved:any[]=[];
  db.transaction(()=>{
    for(const [index,input] of rows.entries()){
      const requestedId=intOrNull(input.player_id);
      let player=requestedId?db.prepare(`SELECT id,name,position,shirt_number FROM players WHERE id=?`).get(requestedId) as any:null;
      if(!player){
        const resolved=resolvePlayer({name:String(input.player_name??''),sourceProvider:'manual-match-stats',sourceUrl,context:`current-season-match:${matchId}`,allowCreate:false});
        if(resolved.status==='conflict')throw new Error(`Riga ${index+1}: identità di ${input.player_name??'giocatore'} da verificare nel Data Manager.`);
        player=db.prepare(`SELECT id,name,position,shirt_number FROM players WHERE id=?`).get(resolved.playerId) as any;
      }
      if(!player)throw new Error(`Riga ${index+1}: giocatore non trovato.`);
      if(seen.has(player.id))throw new Error(`Il giocatore ${player.name} compare più di una volta.`);seen.add(player.id);
      const existing=db.prepare(`SELECT * FROM match_player_stats WHERE match_id=? AND player_id=? ORDER BY CASE WHEN source_provider='manual-match-stats' THEN 0 ELSE 1 END,id LIMIT 1`).get(matchId,player.id) as any;
      const derived=defaults.get(normalizeNameForMatch(player.name))??{};
      const merged:any={...existing,player_id:player.id,player_name:player.name,position:input.position??existing?.position??player.position,shirt_number:input.shirt_number??existing?.shirt_number??player.shirt_number};
      for(const field of EDITABLE_FIELDS){
        const supplied=Object.prototype.hasOwnProperty.call(input,field)?input[field]:undefined;
        merged[field]=supplied!==undefined?(field==='pass_accuracy'?numberOrNull(supplied):intOrNull(supplied)):(existing?.[field]??derived[field]??null);
      }
      const calculated=calculateArchiveRating(merged,context);
      const ratingValues={archive_rating:calculated.rating,archive_rating_version:calculated.version,archive_rating_confidence:calculated.confidence,archive_rating_level:calculated.level,archive_rating_breakdown_json:JSON.stringify(calculated.breakdown)};
      if(existing){
        const assignments=[...EDITABLE_FIELDS,'position','player_name','source_provider','provider_match_id','provider_player_id','source_url','last_verified_at','archive_rating','archive_rating_version','archive_rating_confidence','archive_rating_level','archive_rating_breakdown_json'].map(field=>`${field}=@${field}`).join(',');
        db.prepare(`UPDATE match_player_stats SET ${assignments} WHERE id=@id`).run({...merged,...ratingValues,id:existing.id,source_provider:'manual-match-stats',provider_match_id:`archive:${matchId}`,provider_player_id:`archive-player:${player.id}`,source_url:sourceUrl,last_verified_at:nowIso()});
      }else{
        const columns=['match_id','source_provider','provider_match_id','team_name','player_id','provider_player_id','player_name','position','shirt_number',...EDITABLE_FIELDS.filter(field=>!['shirt_number'].includes(field)),...Object.keys(ratingValues),'source_url','last_verified_at'];
        const values={...merged,...ratingValues,match_id:matchId,source_provider:'manual-match-stats',provider_match_id:`archive:${matchId}`,team_name:isSassuolo(match.home_team)?match.home_team:match.away_team,provider_player_id:`archive-player:${player.id}`,source_url:sourceUrl,last_verified_at:nowIso()};
        db.prepare(`INSERT INTO match_player_stats(${columns.join(',')}) VALUES(${columns.map(column=>`@${column}`).join(',')})`).run(values);
      }
      const after=db.prepare(`SELECT * FROM match_player_stats WHERE match_id=? AND player_id=? ORDER BY CASE WHEN source_provider='manual-match-stats' THEN 0 ELSE 1 END,id LIMIT 1`).get(matchId,player.id) as any;
      recordChange({entityType:'match_player_stats',entityId:after.id,action:existing?'update':'create',before:existing??undefined,after,sourceUrl,note:`Sassuolo Archive Rating ${ARCHIVE_RATING_VERSION}`});
      recordSourceReference({entityType:'match_player_stats',entityId:after.id,field:'archive_rating',sourceUrl,note:`Voto calcolato localmente con ${ARCHIVE_RATING_VERSION}`,author:String(payload.verifiedBy??'Curatore').slice(0,120),sourceProvider:'manual-match-stats',verifiedAt:after.last_verified_at});
      saved.push(publicRow(after));
    }
  })();
  return {ok:true,matchId,version:ARCHIVE_RATING_VERSION,saved};
}
