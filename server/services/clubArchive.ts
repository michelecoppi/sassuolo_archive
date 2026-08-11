import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';

const readJson=<T>(relative:string)=>JSON.parse(fs.readFileSync(path.resolve(relative),'utf8')) as T;
// Loaded once per server process; the development watcher restarts when this module changes.
const clubHistory=readJson<any>('data/club-history.json');
const technicalStaff=readJson<any>('data/technical-staff.json');

export function getClubHistory(){return clubHistory;}

export function getTechnicalArchive(){
  const terms=technicalStaff.coachTerms.map((term:any)=>{
    const matches=db.prepare(`SELECT m.id,m.home_score,m.away_score,m.home_team,m.away_team
      FROM matches m WHERE substr(m.date,1,10)>=? AND (? IS NULL OR substr(m.date,1,10)<=?)
      AND (lower(m.home_team) LIKE '%sassuolo%' OR lower(m.away_team) LIKE '%sassuolo%')
      AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL`).all(term.startDate,term.endDate,term.endDate) as any[];
    let wins=0,draws=0,losses=0;
    for(const match of matches){const home=/sassuolo/i.test(match.home_team);const ours=home?match.home_score:match.away_score;const theirs=home?match.away_score:match.home_score;if(ours>theirs)wins++;else if(ours===theirs)draws++;else losses++;}
    const formations=(db.prepare(`SELECT formation,COUNT(*) AS matches FROM match_lineups
      WHERE lower(team_name) LIKE '%sassuolo%' AND match_id IN (SELECT id FROM matches WHERE substr(date,1,10)>=? AND (? IS NULL OR substr(date,1,10)<=?))
      AND formation IS NOT NULL GROUP BY formation ORDER BY matches DESC,formation LIMIT 3`).all(term.startDate,term.endDate,term.endDate) as any[]);
    return {...term,stats:{matches:matches.length,wins,draws,losses},formations};
  });
  const grouped=new Map<string,any>();
  for(const term of terms){const profile=grouped.get(term.coach)??{coach:term.coach,terms:[]};profile.terms.push(term);grouped.set(term.coach,profile);}
  return {profiles:[...grouped.values()],staffTerms:technicalStaff.staffTerms};
}
