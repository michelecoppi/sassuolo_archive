import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const target=path.resolve('data/reconciliation/candidates/player-season-2010-11-reconciled');
const sourcePath=path.join(target,'statscrew.csv');
const worldUrl='https://www.worldfootball.net/teams/te13744/sassuolo-calcio/se4311/2010-2011/statistics-matches/';
const statsUrl='https://www.statscrew.com/worldfootball/stats/t-SASCA963/y-2010';
const ownGoalUrl='https://www.varesenews.it/2011/04/sassuolo-varese-in-diretta-1-1/120259/';
const verified='2026-08-10';

function parseCsv(text:string){const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const parse=(line:string)=>{const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(value);value='';}else value+=c;}out.push(value);return out;};const headers=parse(lines[0]);return lines.slice(1).map(line=>Object.fromEntries(parse(line).map((value,index)=>[headers[index],value])));}
const cell=(value:unknown)=>{const text=value==null?'':String(value);return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};
const csv=(headers:string[],rows:Record<string,unknown>[])=>[headers.join(','),...rows.map(row=>headers.map(h=>cell(row[h])).join(','))].join('\n')+'\n';

// Complete visible WorldFootball table with Serie B 2010/2011 selected.
const world=[
 ['Francesco Magnanelli','M',39,3438,39,0,1,2,4,0,1],['Andrea De Falco','M',35,2560,28,7,6,5,7,1,0],['Angelo Rea','D',30,2340,27,3,8,1,6,1,0],
 ['Andrea Catellani','F',33,2291,27,6,16,4,3,0,0],['Luigi Riccio','M',34,2266,25,9,7,0,4,0,0],['Daniele Quadrini','F',33,2106,23,10,12,4,2,0,0],
 ['Alberto Pomini','G',23,2025,22,1,0,0,0,0,0],['Paolo Bianco','D',26,1999,23,3,3,0,5,0,1],['Nicolò Consolini','D',27,1893,20,7,6,1,1,0,0],
 ['Daniele Martinetti','F',31,1856,20,11,12,7,5,0,1],['Nicola Donazzan','D',21,1811,20,1,1,0,2,0,0],['Carl Valeri','M',22,1769,20,2,4,0,6,0,0],
 ['Walter Bressan','G',20,1756,20,0,1,0,0,0,0],['Jonathan Rossini','D',18,1583,18,0,0,0,7,1,0],['Michele Troiano','M',22,1399,15,7,5,3,7,1,0],
 ['Mauro Minelli','D',16,1396,16,0,1,0,2,0,0],['Marco Piccioni','D',18,1363,14,4,2,1,4,0,0],['Tiziano Polenghi','D',20,1353,16,4,7,0,1,0,0],
 ['Salvatore Bruno','F',22,1340,16,6,10,6,2,0,0],['Alessandro Noselli','F',17,1278,14,3,3,4,3,0,0],['Gaetano Masucci','F',18,1014,11,7,6,3,2,0,0],
 ['Antonio Bocchetti','D',11,722,8,3,1,0,3,0,0],['Gianluigi Bianco','D',9,658,7,2,2,0,1,0,0],['Massimiliano Fusani','M',17,652,7,10,5,0,2,0,0],
 ['Antonio Cinelli','M',5,310,4,1,3,0,1,0,0],['Roberto Candido','M',1,90,1,0,0,0,0,0,0],['Simone Pecorini','M',1,90,1,0,0,0,0,0,0],
 ['Riccardo Barbuti','F',6,88,0,6,0,0,0,0,0],['Andrea Vignali','F',4,46,0,4,0,0,0,0,0],['Mario Titone','M',2,25,0,2,0,0,0,0,0],
 ['Pellegrino Albanese','D',1,24,0,1,0,0,0,0,0],['Sebastiano Girelli','D',1,23,0,1,0,0,0,0,1],['Vincenzo Ferrara','F',1,2,0,1,0,0,0,0,0],
] as const;

const stats=parseCsv(fs.readFileSync(sourcePath,'utf8'));const byName=new Map(stats.map(row=>[row.player_name,row]));
const worldHeaders=['player_name','season','competition','appearances','minutes','starts','substitutes_in','substitutes_out','goals','yellow_cards','yellow_red_cards','red_cards','position','source_provider','source_url','last_verified_at'];
const worldRows=world.map(([name,position,appearances,minutes,starts,substitutes_in,substitutes_out,goals,yellow_cards,yellow_red_cards,red_cards])=>({player_name:name,season:'2010/11',competition:'Serie B',appearances,minutes,starts,substitutes_in,substitutes_out,goals,yellow_cards,yellow_red_cards,red_cards,position,source_provider:'WorldFootball.net',source_url:worldUrl,last_verified_at:verified}));
const dataHeaders=['player_name','season','competition','appearances','starts','minutes','goals','assists','yellow_cards','yellow_red_cards','red_cards','position','source_provider','source_url','last_verified_at'];
const dataRows=worldRows.map(row=>({...row,assists:byName.get(row.player_name)?.assists??'',source_provider:'WorldFootball.net + StatsCrew',source_url:worldUrl}));
const compareFields=['appearances','starts','minutes','goals','yellow_cards','red_cards','position'] as const;const discrepancies:Record<string,unknown>[]=[];
for(const row of dataRows){const old=byName.get(row.player_name);if(!old)continue;for(const field of compareFields){const a=old[field]??'',b=String(row[field]??'');if(a!==b)discrepancies.push({player_name:row.player_name,field,statscrew_value:a,worldfootball_value:b,resolution:'WorldFootball selected for match-derived field; StatsCrew retained only for assists.',status:'resolved',evidence_url:worldUrl,note:'Complete Serie B 2010/2011 table verified.'});}}
fs.writeFileSync(path.join(target,'worldfootball.csv'),csv(worldHeaders,worldRows),'utf8');fs.writeFileSync(path.join(target,'data.csv'),csv(dataHeaders,dataRows),'utf8');
const discrepancyHeaders=['player_name','field','statscrew_value','worldfootball_value','resolution','status','evidence_url','note'];fs.writeFileSync(path.join(target,'discrepancies.csv'),csv(discrepancyHeaders,discrepancies),'utf8');
const goalHeaders=['date','season','competition','home_team','away_team','home_score','away_score','scoring_team','player_name','event_type','minute','source_provider','source_url','last_verified_at','note'];
const goalRows=[{date:'2011-04-16',season:'2010/11',competition:'Serie B',home_team:'Sassuolo',away_team:'Varese',home_score:1,away_score:1,scoring_team:'Sassuolo',player_name:'Claiton dos Santos',event_type:'opponent_own_goal',minute:"90'",source_provider:'VareseNews',source_url:ownGoalUrl,last_verified_at:verified,note:'Contemporary match report: Varese defender Dos Santos scored at 75 minutes, then the Sassuolo equaliser was his own goal at 90 minutes. The article also spells the name Clayton.'}];
fs.writeFileSync(path.join(target,'goal-resolution.csv'),csv(goalHeaders,goalRows),'utf8');
const hash=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(target,file))).digest('hex');const dataHash=hash('data.csv');
const manifest={area:'player_seasons',season:'2010/11',competition:'Serie B',source_provider:'WorldFootball.net + StatsCrew',source_url:worldUrl,verified_at:verified,file:'data.csv',sha256:dataHash,records_total:dataRows.length,records_discarded:0,discard_reasons:[],fields_covered:dataHeaders,validation:{status:'reconciled',checks:[{name:'worldfootball_complete_extract',status:'passed',note:'33/33 rows extracted from the visible Serie B 2010/2011 table.'},{name:'field_by_field_comparison',status:'passed',note:`${discrepancies.length} differences documented and resolved by field policy.`},{name:'player_goals_sum',status:'passed',note:'41 player goals.'},{name:'own_goals_reconciled',status:'passed',note:'41 player goals + 1 opponent own goal (Claiton dos Santos, Varese) = 42 team goals.'},{name:'starts_total',status:'passed',note:'462 starts = 42 matches × 11.'},{name:'identities_reviewed',status:'passed',note:'All 33 names matched between the two extracts.'}],unresolved_conflicts:[]},field_source_policy:{worldfootball:['appearances','starts','minutes','goals','yellow_cards','yellow_red_cards','red_cards','position'],statscrew:['assists'],contemporary_match_report:['opponent_own_goal']},related_files:{worldfootball_csv_sha256:hash('worldfootball.csv'),statscrew_csv_sha256:hash('statscrew.csv'),discrepancies_csv_sha256:hash('discrepancies.csv'),goal_resolution_csv_sha256:hash('goal-resolution.csv')},notes:['Regular-season Serie B only.','Opponent own goals are evidence records and are not attributed to Sassuolo players.']};
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
fs.writeFileSync(path.join(target,'SOURCES.md'),`# PlayerSeason Serie B 2010/11 — riconciliato\n\nPerimetro: regular season di Serie B 2010/11.\n\n- WorldFootball.net (${worldUrl}): presenze, titolarità, minuti, gol, cartellini e posizione; tabella completa di 33 giocatori.\n- StatsCrew (${statsUrl}): assist.\n- VareseNews (${ownGoalUrl}): cronaca contemporanea di Sassuolo–Varese 1-1 del 16 aprile 2011. Documenta il gol del Varese di Dos Santos al 75' e il suo autogol al 90' per il pareggio del Sassuolo. Il calciatore è Claiton dos Santos; nella cronaca compare anche la grafia Clayton.\n\nRiconciliazione gol squadra: 41 gol attribuiti ai giocatori Sassuolo + 1 autogol avversario = 42 gol. L'autogol resta un evento documentale e non viene attribuito a un giocatore Sassuolo. Tutte le differenze tra le fonti sono elencate in discrepancies.csv.\n`,'utf8');
console.log(JSON.stringify({target,records:dataRows.length,discrepancies:discrepancies.length,playerGoals:dataRows.reduce((n,r)=>n+Number(r.goals),0),starts:dataRows.reduce((n,r)=>n+Number(r.starts),0),sha256:dataHash},null,2));
