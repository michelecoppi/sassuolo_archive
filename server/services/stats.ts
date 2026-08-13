import { db, getSetting, normalizeTeamName } from '../db/database.js';
import { HALL_OF_FAME_COMPETITIONS, HALL_OF_FAME_DEFINITIONS, HALL_OF_FAME_LIMIT, RECORD_DEFINITIONS, STATISTICS_POLICY_VERSION } from './statDefinitions.js';

const SASSUOLO = 'U.S. Sassuolo Calcio';

type MatchRow = {
  id: number; date: string; season: string | null; competition: string | null;
  home_team: string; away_team: string; home_score: number | null; away_score: number | null;
};

function completedMatches(filters: Record<string,string|undefined> = {}): MatchRow[] {
  const where=['home_score IS NOT NULL','away_score IS NOT NULL']; const params:any[]=[];
  if(filters.competition){where.push('competition=?');params.push(filters.competition);}
  if(filters.from){where.push('substr(season,1,4)>=?');params.push(filters.from.slice(0,4));}
  if(filters.to){where.push('substr(season,1,4)<=?');params.push(filters.to.slice(0,4));}
  return db.prepare(`SELECT id,date,season,competition,home_team,away_team,home_score,away_score FROM matches WHERE ${where.join(' AND ')} ORDER BY date ASC`).all(...params) as MatchRow[];
}

function perspective(m: MatchRow) {
  const isHome = normalizeTeamName(m.home_team) === SASSUOLO;
  const gf = isHome ? m.home_score! : m.away_score!;
  const ga = isHome ? m.away_score! : m.home_score!;
  return { isHome, gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D' as 'W'|'D'|'L' };
}

export function dashboardStats(filters: Record<string,string|undefined> = {}) {
  const matches = completedMatches(filters).filter(m => [normalizeTeamName(m.home_team), normalizeTeamName(m.away_team)].includes(SASSUOLO));
  let wins=0, draws=0, losses=0, gf=0, ga=0, points=0;
  for (const m of matches) {
    const p = perspective(m); gf += p.gf; ga += p.ga;
    if (p.result === 'W') { wins++; points += 3; }
    else if (p.result === 'D') { draws++; points += 1; }
    else losses++;
  }
  const seasonWhere:string[]=[];const seasonParams:any[]=[];
  if(filters.competition){seasonWhere.push('competition=?');seasonParams.push(filters.competition);} if(filters.from){seasonWhere.push('substr(season,1,4)>=?');seasonParams.push(filters.from.slice(0,4));}if(filters.to){seasonWhere.push('substr(season,1,4)<=?');seasonParams.push(filters.to.slice(0,4));}
  const seasonRows = db.prepare(`SELECT * FROM seasons ${seasonWhere.length?'WHERE '+seasonWhere.join(' AND '):''} ORDER BY season, competition`).all(...seasonParams) as any[];
  const seasonCount = (competition?: string) => new Set(seasonRows.filter(row => !competition || row.competition === competition).map(row => row.season).filter(Boolean)).size;
  // The dashboard has one x-axis point per season.  When no competition is
  // selected, collapse the competition rows into a single all-competitions
  // season; otherwise Coppa Italia and league rows share the same category
  // and the Recharts lines become misleading/appear empty.
  const seasons = filters.competition ? seasonRows : [...new Map<string, any[]>(seasonRows.reduce((map, row) => {
    const rows = map.get(row.season) ?? [];
    rows.push(row);
    map.set(row.season, rows);
    return map;
  }, new Map<string, any[]>())).entries()].map(([season, rows]) => {
    const league = rows.find(row => row.competition === 'Serie A' || row.competition === 'Serie B') ?? rows[0];
    const sum = (field: string) => {
      const values = rows.map(row => row[field]).filter(value => value != null);
      return values.length ? values.reduce((total, value) => total + Number(value), 0) : null;
    };
    return {
      ...league,
      season,
      competition: 'Tutte le competizioni',
      matches: sum('matches'),
      wins: sum('wins'),
      draws: sum('draws'),
      losses: sum('losses'),
      goals_for: sum('goals_for'),
      goals_against: sum('goals_against'),
      points: sum('points'),
      final_position: league?.final_position ?? null,
    };
  });
  const best = seasons.filter(s => s.final_position != null).sort((a,b)=>a.final_position-b.final_position)[0];
  const highPoints = seasons.filter(s => s.points != null).sort((a,b)=>b.points-a.points)[0];
  const byMargin = [...matches].sort((a,b)=> {
    const pa = perspective(a), pb = perspective(b); return (pb.gf-pb.ga) - (pa.gf-pa.ga);
  });
  const biggestWin = byMargin.find(m => perspective(m).result === 'W') ?? null;
  const biggestDefeat = [...matches].sort((a,b)=> {
    const pa = perspective(a), pb = perspective(b); return (pa.gf-pa.ga) - (pb.gf-pb.ga);
  }).find(m => perspective(m).result === 'L') ?? null;
  const latest = [...matches].slice(-10).reverse();
  const lastSync = db.prepare(`SELECT max(last_successful_sync) AS value FROM sync_state`).get() as {value:string|null};
  return {
    totals: { matches: matches.length, wins, draws, losses, goalsFor: gf, goalsAgainst: ga, goalDifference: gf-ga, points },
    seasonCounts: { total: seasonCount(), serieA: seasonCount('Serie A'), serieB: seasonCount('Serie B'), coppaItalia: seasonCount('Coppa Italia'), europaLeague: seasonCount('Europa League') },
    bestLeagueFinish: best ?? null,
    highestPointsSeason: highPoints ?? null,
    biggestWin, biggestDefeat, recentMatches: latest, seasons, lastUpdate: lastSync.value
  };
}

export function headToHead(opponentRaw: string) {
  const opponent = normalizeTeamName(opponentRaw);
  const matches = completedMatches().filter(m => {
    const h=normalizeTeamName(m.home_team), a=normalizeTeamName(m.away_team);
    return (h===SASSUOLO && a===opponent) || (a===SASSUOLO && h===opponent);
  });
  let wins=0, draws=0, losses=0, gf=0, ga=0, home={w:0,d:0,l:0}, away={w:0,d:0,l:0};
  const scores = new Map<string,number>();
  for (const m of matches) {
    const p=perspective(m); gf+=p.gf; ga+=p.ga;
    if(p.result==='W') wins++; else if(p.result==='D') draws++; else losses++;
    const bucket=p.isHome?home:away; bucket[p.result.toLowerCase() as 'w'|'d'|'l']++;
    const key=`${p.gf}-${p.ga}`; scores.set(key,(scores.get(key)??0)+1);
  }
  const common=[...scores.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;
  let currentStreak = 'N/D';
  if (matches.length) {
    const lastResult=perspective(matches[matches.length-1]).result;
    let count=0;
    for (let i=matches.length-1;i>=0 && perspective(matches[i]).result===lastResult;i--) count++;
    currentStreak=`${lastResult} x${count}`;
  }
  const biggestWin=[...matches].filter(m=>perspective(m).result==='W').sort((a,b)=> (perspective(b).gf-perspective(b).ga)-(perspective(a).gf-perspective(a).ga))[0] ?? null;
  const biggestDefeat=[...matches].filter(m=>perspective(m).result==='L').sort((a,b)=> (perspective(a).gf-perspective(a).ga)-(perspective(b).gf-perspective(b).ga))[0] ?? null;
  return { opponent, played:matches.length,wins,draws,losses,goalsFor:gf,goalsAgainst:ga,winPercentage:matches.length?Number((wins/matches.length*100).toFixed(1)):0,biggestWin,biggestDefeat,mostCommonScore:common,firstMeeting:matches[0]??null,latestMeeting:matches.at(-1)??null,currentStreak,home,away,matches:[...matches].reverse() };
}

export function records(filters: Record<string,string|undefined> = {}) {
  const matches=completedMatches(filters).filter(m => [normalizeTeamName(m.home_team),normalizeTeamName(m.away_team)].includes(SASSUOLO));
  const meta={policyVersion:STATISTICS_POLICY_VERSION,lastRecalculation:getSetting('data_last_audit_at')||getSetting('last_import_at'),filters:{competition:filters.competition||null,from:filters.from||null,to:filters.to||null},coverage:{matches:matches.length,seasons:new Set(matches.map(m=>m.season).filter(Boolean)).size,competitions:[...new Set(matches.map(m=>m.competition).filter(Boolean))],fromDate:matches[0]?.date??null,toDate:matches.at(-1)?.date??null},definitions:RECORD_DEFINITIONS};
  const emptyEvidence={biggestWin:[],biggestHomeWin:[],biggestAwayWin:[],biggestDefeat:[],longestWinningStreak:[],longestUnbeatenStreak:[],longestLosingStreak:[],mostGoalsInMatch:[]};
  if(!matches.length) return { biggestWin:null,biggestHomeWin:null,biggestAwayWin:null,biggestDefeat:null,longestWinningStreak:null,longestUnbeatenStreak:null,longestLosingStreak:null,mostGoalsInMatch:null,seasonRecords:[],evidence:emptyEvidence,meta };
  const wins=matches.filter(m=>perspective(m).result==='W');
  const losses=matches.filter(m=>perspective(m).result==='L');
  const margin=(m:MatchRow)=>perspective(m).gf-perspective(m).ga;
  const oldest=(a:MatchRow,b:MatchRow)=>a.date.localeCompare(b.date)||a.id-b.id;
  const biggestWin=[...wins].sort((a,b)=>margin(b)-margin(a)||oldest(a,b))[0]??null;
  const biggestHomeWin=[...wins].filter(m=>perspective(m).isHome).sort((a,b)=>margin(b)-margin(a)||oldest(a,b))[0]??null;
  const biggestAwayWin=[...wins].filter(m=>!perspective(m).isHome).sort((a,b)=>margin(b)-margin(a)||oldest(a,b))[0]??null;
  const biggestDefeat=[...losses].sort((a,b)=>margin(a)-margin(b)||oldest(a,b))[0]??null;
  const mostGoalsInMatch=[...matches].sort((a,b)=>(perspective(b).gf+perspective(b).ga)-(perspective(a).gf+perspective(a).ga)||oldest(a,b))[0]??null;
  const streak=(predicate:(r:'W'|'D'|'L')=>boolean)=>{let best:MatchRow[]=[],cur:MatchRow[]=[];for(const m of matches){if(predicate(perspective(m).result)){cur.push(m);if(cur.length>best.length)best=[...cur];}else cur=[];}return {value:best.length,matches:best};};
  const winningStreak=streak(r=>r==='W');
  const unbeatenStreak=streak(r=>r!=='L');
  const losingStreak=streak(r=>r==='L');
  const seasons=db.prepare(`SELECT * FROM seasons ORDER BY season`).all();
  const evidence={biggestWin:[biggestWin],biggestHomeWin:[biggestHomeWin],biggestAwayWin:[biggestAwayWin],biggestDefeat:[biggestDefeat],longestWinningStreak:winningStreak.matches,longestUnbeatenStreak:unbeatenStreak.matches,longestLosingStreak:losingStreak.matches,mostGoalsInMatch:[mostGoalsInMatch]};
  return { biggestWin,biggestHomeWin,biggestAwayWin,biggestDefeat,longestWinningStreak:winningStreak.value,longestUnbeatenStreak:unbeatenStreak.value,longestLosingStreak:losingStreak.value,mostGoalsInMatch,seasonRecords:seasons,evidence,meta };
}

export type HallOfFameFilters = {
  competition?: string;
  season?: string;
  position?: string;
  minAppearances?: number;
  minGoals?: number;
  minAssists?: number;
  minMinutes?: number;
  minCleanSheets?: number;
};

export function hallOfFame(filters: HallOfFameFilters = {}) {
  const fields=['appearances','goals','own_goals','assists','minutes','clean_sheets'] as const;
  const result:Record<string,unknown>={};
  const psWhere=['1=1']; const psParams:any[]=[];
  if(filters.competition) { psWhere.push('ps.competition=?'); psParams.push(filters.competition); }
  if(filters.season) { psWhere.push('ps.season=?'); psParams.push(filters.season); }
  if(filters.position) { psWhere.push('COALESCE(ps.position,p.position)=?'); psParams.push(filters.position); }
  const filteredSeasonRows=(field:string, minimum?:number)=>{
    const where=[...psWhere,`ps.${field} IS NOT NULL`]; const params=[...psParams];
    if(minimum != null) { where.push(`ps.${field}>=?`); params.push(minimum); }
    return {where,params};
  };
  for(const field of fields) {
    const minimumKey:Record<typeof field, keyof HallOfFameFilters>={appearances:'minAppearances',goals:'minGoals',own_goals:'minGoals',assists:'minAssists',minutes:'minMinutes',clean_sheets:'minCleanSheets'};
    const min=filters[minimumKey[field]] as number|undefined;
    const {where,params}=filteredSeasonRows(field,min);
    // Without a specific season/competition the Hall of Fame is a career
    // ranking. Returning one row per season here made the same player appear
    // multiple times in the combined view (and split tied values into fake
    // #1/#2 positions).
    if(!filters.season || !filters.competition) {
      const aggregateWhere=[...psWhere,`ps.${field} IS NOT NULL`];
      const aggregateParams=[...psParams];
      const aggregateHaving=`SUM(ps.${field}) IS NOT NULL${min != null ? ` AND SUM(ps.${field})>=?` : ''}`;
      if(min != null) aggregateParams.push(min);
      result[field]=db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,SUM(ps.${field}) AS ${field} FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${aggregateWhere.join(' AND ')} GROUP BY p.id HAVING ${aggregateHaving} ORDER BY ${field} DESC,p.name LIMIT ?`).all(...aggregateParams,HALL_OF_FAME_LIMIT);
    } else {
      result[field]=db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,ps.${field} AS ${field},ps.season,ps.competition FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${where.join(' AND ')} ORDER BY ps.${field} DESC,p.name LIMIT ?`).all(...params,HALL_OF_FAME_LIMIT);
    }
  }
  const aggregateWhere=[...psWhere]; const aggregateParams=[...psParams];
  const aggregate=(field:string, alias=field)=>db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,SUM(ps.${field}) AS ${alias} FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${aggregateWhere.join(' AND ')} AND ps.${field} IS NOT NULL GROUP BY p.id HAVING SUM(ps.${field}) IS NOT NULL ORDER BY ${alias} DESC,p.name LIMIT ?`).all(...aggregateParams,HALL_OF_FAME_LIMIT);
  result.mostSeasons=db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,COUNT(DISTINCT ps.season) AS seasons_count FROM players p JOIN player_seasons ps ON ps.player_id=p.id WHERE ${psWhere.join(' AND ')} GROUP BY p.id ORDER BY seasons_count DESC,p.name LIMIT ?`).all(...psParams,HALL_OF_FAME_LIMIT);
  result.serieAAppearances=aggregate('appearances','serie_a_appearances');
  result.serieAGoals=aggregate('goals','serie_a_goals');
  result.singleSeasonGoals=db.prepare(`SELECT p.id AS player_id,p.name,p.photo_url,p.position,ps.season,ps.competition,ps.goals,ps.appearances,ps.minutes FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${psWhere.join(' AND ')} AND ps.goals IS NOT NULL ORDER BY ps.goals DESC,COALESCE(ps.minutes,999999) ASC,p.name,ps.season,ps.competition LIMIT ?`).all(...psParams,HALL_OF_FAME_LIMIT);
  result.singleSeasonAssists=db.prepare(`SELECT p.id AS player_id,p.name,p.photo_url,p.position,ps.season,ps.competition,ps.assists,ps.appearances,ps.minutes FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${psWhere.join(' AND ')} AND ps.assists IS NOT NULL ORDER BY ps.assists DESC,COALESCE(ps.minutes,999999) ASC,p.name,ps.season,ps.competition LIMIT ?`).all(...psParams,HALL_OF_FAME_LIMIT);
  const competitionRanking=(competition:string)=>{
    const where=`ps.competition=? AND (ps.appearances IS NOT NULL OR ps.goals IS NOT NULL OR ps.assists IS NOT NULL OR ps.minutes IS NOT NULL OR ps.clean_sheets IS NOT NULL)`;
    const ranked=(field:string)=>db.prepare(`SELECT p.id,p.name,p.photo_url,p.position,SUM(ps.${field}) AS ${field} FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${where} AND ps.${field} IS NOT NULL GROUP BY p.id HAVING SUM(ps.${field}) IS NOT NULL ORDER BY ${field} DESC,p.name LIMIT ?`).all(competition,HALL_OF_FAME_LIMIT);
    return {appearances:ranked('appearances'),goals:ranked('goals'),own_goals:ranked('own_goals'),assists:ranked('assists'),minutes:ranked('minutes'),clean_sheets:ranked('clean_sheets')};
  };
  result.byCompetition=Object.fromEntries(HALL_OF_FAME_COMPETITIONS.map(competition=>[competition,competitionRanking(competition)]));
  const negative=(field:'own_goals'|'yellow_cards'|'red_cards'|'fouls_committed')=>db.prepare(`SELECT p.id,p.name,p.photo_url,COALESCE(ps.position,p.position) AS position,SUM(ps.${field}) AS ${field} FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${aggregateWhere.join(' AND ')} AND ps.${field} IS NOT NULL GROUP BY p.id HAVING SUM(ps.${field})>0 ORDER BY ${field} DESC,p.name LIMIT ?`).all(...aggregateParams,HALL_OF_FAME_LIMIT);
  result.negative={own_goals:negative('own_goals'),yellow_cards:negative('yellow_cards'),red_cards:negative('red_cards'),fouls_committed:negative('fouls_committed')};
  const seasonWhere:string[]=[];const seasonParams:any[]=[];
  if(filters.competition){seasonWhere.push('competition=?');seasonParams.push(filters.competition);}if(filters.season){seasonWhere.push('season=?');seasonParams.push(filters.season);}
  result.teamOwnGoals=db.prepare(`SELECT season,competition,own_goals_for,own_goals_against FROM seasons WHERE ${seasonWhere.length?seasonWhere.join(' AND ')+' AND ':''}(own_goals_for IS NOT NULL OR own_goals_against IS NOT NULL) ORDER BY season DESC`).all(...seasonParams);
  const coverage=db.prepare(`SELECT COUNT(*) AS playerSeasonRows,COUNT(DISTINCT ps.player_id) AS players,COUNT(DISTINCT ps.season) AS seasons,COUNT(DISTINCT ps.competition) AS competitions,MAX(ps.last_verified_at) AS lastVerifiedAt FROM player_seasons ps JOIN players p ON p.id=ps.player_id WHERE ${psWhere.join(' AND ')}`).get(...psParams) as any;
  result.meta={policyVersion:STATISTICS_POLICY_VERSION,lastRecalculation:getSetting('data_last_audit_at')||getSetting('last_import_at')||coverage.lastVerifiedAt||null,filters:{competition:filters.competition||null,season:filters.season||null,position:filters.position||null,minimums:{appearances:filters.minAppearances??null,goals:filters.minGoals??null,assists:filters.minAssists??null,minutes:filters.minMinutes??null,clean_sheets:filters.minCleanSheets??null}},coverage,aggregation:(!filters.season||!filters.competition)?'Somma per giocatore nel perimetro selezionato.':'Riga della stagione e competizione selezionate.',rankingLimit:HALL_OF_FAME_LIMIT,competitions:[...HALL_OF_FAME_COMPETITIONS],definitions:HALL_OF_FAME_DEFINITIONS};
  return result;
}
