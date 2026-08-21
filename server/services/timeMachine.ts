import type Database from 'better-sqlite3';
import { db } from '../db/database.js';
import { getClubHistory } from './clubArchive.js';
import { getCoverageMatrix, type CoverageRow } from './coverage.js';

type ClubHistory = ReturnType<typeof getClubHistory>;
type SeasonRow = {
  season:string; competition:string; final_position:number|null; matches:number|null;
  wins:number|null; draws:number|null; losses:number|null; goals_for:number|null;
  goals_against:number|null; points:number|null; manager:string|null; stadium:string|null;
  source_provider:string|null; source_url:string|null; last_verified_at:string|null;
};
type MatchRow = {
  id:number; date:string; season:string; competition:string; round:string|null;
  home_team:string; away_team:string; home_score:number; away_score:number;
  source_provider:string|null; source_url:string|null; last_verified_at:string|null;
};
type PlayerSeasonRow = {
  player_id:number; player_name:string; position:string|null; season:string;
  appearances:number|null; minutes:number|null; goals:number|null; assists:number|null;
  last_verified_at:string|null;
};

const isSassuolo=(name:string)=>/sassuolo/i.test(name);
const nullableSum=(values:Array<number|null>)=>{
  const known=values.filter((value):value is number=>value!=null);
  return known.length?known.reduce((total,value)=>total+value,0):null;
};
const newest=(values:Array<string|null|undefined>)=>values.filter((value):value is string=>Boolean(value)).sort().at(-1)??null;

function fallbackLeague(competitions:string[]){
  return competitions.find(item=>/^Serie (?:A|B|C)/i.test(item))??competitions[0]??null;
}

export function buildTimeMachine(
  database:Database,
  coverageRows:CoverageRow[],
  clubHistory:ClubHistory,
  generatedAt=new Date().toISOString(),
){
  const seasonRows=database.prepare(`SELECT season,competition,final_position,matches,wins,draws,losses,goals_for,goals_against,points,manager,stadium,source_provider,source_url,last_verified_at FROM seasons ORDER BY season,competition`).all() as SeasonRow[];
  const matches=database.prepare(`SELECT id,date,season,competition,round,home_team,away_team,home_score,away_score,source_provider,source_url,last_verified_at FROM matches WHERE season IS NOT NULL AND competition IS NOT NULL AND home_score IS NOT NULL AND away_score IS NOT NULL AND typeof(home_score)='integer' AND typeof(away_score)='integer' AND home_score>=0 AND away_score>=0 AND (lower(home_team) LIKE '%sassuolo%' OR lower(away_team) LIKE '%sassuolo%') ORDER BY season,date,id`).all() as MatchRow[];
  const playerRows=database.prepare(`SELECT ps.player_id,p.name AS player_name,COALESCE(ps.position,p.position) AS position,ps.season,ps.appearances,ps.minutes,ps.goals,ps.assists,ps.last_verified_at FROM player_seasons ps JOIN players p ON p.id=ps.player_id ORDER BY ps.season,p.name,ps.competition`).all() as PlayerSeasonRow[];
  const allSeasons=[...new Set([...coverageRows.map(row=>row.season),...seasonRows.map(row=>row.season)])].sort();

  const seasons=allSeasons.map(season=>{
    const coverage=coverageRows.filter(row=>row.season===season);
    const stored=seasonRows.filter(row=>row.season===season);
    const seasonMatches=matches.filter(row=>row.season===season);
    const competitions=[...new Set([...coverage.map(row=>row.competition),...stored.map(row=>row.competition),...seasonMatches.map(row=>row.competition)])];
    const primaryCompetition=coverage.find(row=>row.competition_kind==='league')?.competition??fallbackLeague(competitions);
    const primary=stored.find(row=>row.competition===primaryCompetition)??null;
    const primaryCoverage=coverage.find(row=>row.competition===primaryCompetition)??null;
    const leagueMatches=seasonMatches.filter(row=>row.competition===primaryCompetition);
    let derivedWins=0,derivedDraws=0,derivedLosses=0,derivedGoalsFor=0,derivedGoalsAgainst=0;
    const journeyPoints=leagueMatches.map(match=>{
      const home=isSassuolo(match.home_team),goalsFor=home?match.home_score:match.away_score,goalsAgainst=home?match.away_score:match.home_score;
      const result=goalsFor>goalsAgainst?'W':goalsFor===goalsAgainst?'D':'L';
      if(result==='W')derivedWins++;else if(result==='D')derivedDraws++;else derivedLosses++;
      derivedGoalsFor+=goalsFor;derivedGoalsAgainst+=goalsAgainst;
      return {matchId:match.id,date:match.date,round:match.round,result,cumulativePoints:derivedWins*3+derivedDraws,opponent:home?match.away_team:match.home_team,home,goalsFor,goalsAgainst};
    });
    const derivedMatches=leagueMatches.length;
    const value=(storedValue:number|null|undefined,derivedValue:number)=>storedValue??(derivedMatches?derivedValue:null);

    const playerMap=new Map<number,PlayerSeasonRow[]>();
    for(const row of playerRows.filter(item=>item.season===season))playerMap.set(row.player_id,[...(playerMap.get(row.player_id)??[]),row]);
    const keyPlayers=[...playerMap.values()].map(rows=>({
      id:rows[0].player_id,name:rows[0].player_name,position:rows.find(row=>row.position)?.position??null,
      appearances:nullableSum(rows.map(row=>row.appearances)),minutes:nullableSum(rows.map(row=>row.minutes)),
      goals:nullableSum(rows.map(row=>row.goals)),assists:nullableSum(rows.map(row=>row.assists)),
      lastVerifiedAt:newest(rows.map(row=>row.last_verified_at)),
    })).filter(player=>player.appearances!=null||player.minutes!=null||player.goals!=null||player.assists!=null)
      .sort((a,b)=>(b.goals??-1)-(a.goals??-1)||(b.assists??-1)-(a.assists??-1)||(b.appearances??-1)-(a.appearances??-1)||a.name.localeCompare(b.name,'it'))
      .slice(0,3);

    const wins=seasonMatches.map(match=>{
      const home=isSassuolo(match.home_team),goalsFor=home?match.home_score:match.away_score,goalsAgainst=home?match.away_score:match.home_score;
      return {...match,goalsFor,goalsAgainst,margin:goalsFor-goalsAgainst};
    }).filter(match=>match.margin>0).sort((a,b)=>b.margin-a.margin||b.goalsFor-a.goalsFor||a.date.localeCompare(b.date)||a.id-b.id);
    const best=wins[0]??null;
    const sourceMatch=[...seasonMatches].filter(row=>row.source_provider||row.source_url||row.last_verified_at).sort((a,b)=>String(b.last_verified_at??'').localeCompare(String(a.last_verified_at??''))||b.id-a.id)[0]??null;
    const milestones=(clubHistory.milestones??[]).filter((item:{season:string})=>item.season===season);
    const honours=(clubHistory.honours??[]).filter((item:{season:string})=>item.season===season);
    const coverageStatus=primaryCoverage?.status??(derivedMatches?'partial':'unknown');

    return {
      season,
      headline:milestones[0]?.title??honours[0]?.competition??primaryCompetition??'Stagione in archivio',
      primaryCompetition,
      competitions,
      finalPosition:primary?.final_position??null,
      manager:primary?.manager??null,
      stadium:primary?.stadium??null,
      record:{
        matches:value(primary?.matches,derivedMatches),wins:value(primary?.wins,derivedWins),draws:value(primary?.draws,derivedDraws),
        losses:value(primary?.losses,derivedLosses),goalsFor:value(primary?.goals_for,derivedGoalsFor),
        goalsAgainst:value(primary?.goals_against,derivedGoalsAgainst),points:value(primary?.points,derivedWins*3+derivedDraws),
      },
      keyPlayers,
      bestWin:best?{id:best.id,date:best.date,competition:best.competition,homeTeam:best.home_team,awayTeam:best.away_team,homeScore:best.home_score,awayScore:best.away_score,margin:best.margin,sourceProvider:best.source_provider,sourceUrl:best.source_url}:null,
      journey:{finalPoints:journeyPoints.at(-1)?.cumulativePoints??null,points:journeyPoints},
      milestones,
      honours,
      coverage:{status:coverageStatus,expectedMatches:primaryCoverage?.expected_matches??null,foundMatches:primaryCoverage?.found_matches??derivedMatches,completedMatches:primaryCoverage?.completed_matches??derivedMatches,gapReason:coverageStatus==='complete'?null:primaryCoverage?.gap_reason??null},
      source:{provider:primary?.source_provider??sourceMatch?.source_provider??null,url:primary?.source_url??sourceMatch?.source_url??null,lastVerifiedAt:newest([primary?.last_verified_at,...seasonMatches.map(row=>row.last_verified_at),...keyPlayers.map(row=>row.lastVerifiedAt)])},
    };
  });

  return {
    generatedAt,
    range:{from:seasons[0]?.season??null,to:seasons.at(-1)?.season??null,total:seasons.length},
    methodology:'Riepilogo costruito esclusivamente da stagioni, partite, statistiche giocatore, matrice di copertura e cronologia già presenti nell’archivio. I valori assenti restano null e vengono mostrati come N/D.',
    seasons,
  };
}

export function getTimeMachine(){
  const coverage=getCoverageMatrix();
  return buildTimeMachine(db,coverage.rows,getClubHistory(),coverage.generatedAt);
}
