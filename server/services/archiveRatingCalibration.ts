import { db, nowIso } from '../db/database.js';
import { currentSeason } from './currentSeason.js';

const rounded=(value:number,digits=2)=>Number(value.toFixed(digits));
const roleFor=(value:unknown)=>{
  const position=String(value??'').toLowerCase();
  if(/goal|portier/.test(position))return 'Portieri';
  if(/def|back|terzin/.test(position))return 'Difensori';
  if(/mid|centrocamp/.test(position))return 'Centrocampisti';
  if(/attack|forward|wing|attacc/.test(position))return 'Attaccanti';
  return 'Ruolo N/D';
};
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length?rounded(sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2,1):null;};

export function getArchiveRatingCalibration(){
  const season=currentSeason();
  const rows=db.prepare(`SELECT s.id,s.match_id,s.player_id,COALESCE(p.name,s.player_name) AS player_name,
      COALESCE(s.position,p.position) AS position,s.archive_rating AS rating,s.archive_rating_confidence AS confidence,
      s.archive_rating_version AS version,s.source_url,m.date,m.competition,m.home_team,m.away_team
    FROM match_player_stats s JOIN matches m ON m.id=s.match_id LEFT JOIN players p ON p.id=s.player_id
    WHERE m.season=? AND s.source_provider='manual-match-stats' AND s.archive_rating IS NOT NULL
    ORDER BY m.date,s.id`).all(season) as any[];
  const values=rows.map(row=>Number(row.rating)).filter(Number.isFinite),matches=[...new Set(rows.map(row=>Number(row.match_id)))],players=[...new Set(rows.map(row=>row.player_id??`name:${row.player_name}`))];
  const group=(items:any[])=>({count:items.length,average:items.length?rounded(items.reduce((sum,row)=>sum+Number(row.rating),0)/items.length,1):null,median:median(items.map(row=>Number(row.rating)))});
  const roles=[...new Set(rows.map(row=>roleFor(row.position)))].map(role=>({role,...group(rows.filter(row=>roleFor(row.position)===role))}));
  const distribution=[
    {label:'3–4,9',count:values.filter(value=>value<5).length},
    {label:'5–5,9',count:values.filter(value=>value>=5&&value<6).length},
    {label:'6–6,9',count:values.filter(value=>value>=6&&value<7).length},
    {label:'7–7,9',count:values.filter(value=>value>=7&&value<8).length},
    {label:'8–10',count:values.filter(value=>value>=8).length},
  ];
  const trends=[...new Set(rows.map(row=>Number(row.match_id)))].map(matchId=>{const items=rows.filter(row=>Number(row.match_id)===matchId),first=items[0];return {matchId,date:first.date,label:`${first.home_team} – ${first.away_team}`,...group(items)};}).slice(-10);
  const versions=[...new Set(rows.map(row=>String(row.version??'non-versionato')))].map(version=>({version,count:rows.filter(row=>String(row.version??'non-versionato')===version).length}));
  const lowConfidence=rows.filter(row=>row.confidence!=null&&Number(row.confidence)<0.55).length;
  const missingSource=rows.filter(row=>!String(row.source_url??'').trim()).length;
  const duplicateCurated=Number((db.prepare(`SELECT COUNT(*) AS count FROM (SELECT match_id,player_id FROM match_player_stats s JOIN matches m ON m.id=s.match_id WHERE m.season=? AND s.source_provider='manual-match-stats' GROUP BY match_id,player_id HAVING COUNT(*)>1)`).get(season) as any)?.count??0);
  const rawSnapshots=Number((db.prepare(`SELECT COUNT(*) AS count FROM match_player_stats s JOIN matches m ON m.id=s.match_id WHERE m.season=? AND s.source_provider<>'manual-match-stats'`).get(season) as any)?.count??0);
  const calibrationTargetMatches=10;
  return {season,generatedAt:nowIso(),ratings:rows.length,ratedMatches:matches.length,ratedPlayers:players.length,average:values.length?rounded(values.reduce((sum,value)=>sum+value,0)/values.length,1):null,median:median(values),calibrationTargetMatches,ready:matches.length>=calibrationTargetMatches,remainingMatches:Math.max(0,calibrationTargetMatches-matches.length),distribution,roles,trends,versions,
    outliers:rows.filter(row=>Number(row.rating)<=4.5||Number(row.rating)>=8.5).map(row=>({matchId:row.match_id,playerId:row.player_id,playerName:row.player_name,rating:Number(row.rating),confidence:row.confidence,date:row.date})).slice(-12),
    dataHealth:{rawSnapshots,curatedRows:rows.length,missingSource,lowConfidence,duplicateCurated,healthy:missingSource===0&&duplicateCurated===0}};
}
