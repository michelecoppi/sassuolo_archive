import fs from 'node:fs';
import path from 'node:path';

type Match = {
  external_key:string; date:string; season:string; competition:'Coppa Italia'; round:string;
  home_team:string; away_team:string; home_score:number; away_score:number;
  completeness_level:'STANDARD'; source_provider:'openfootball/italy'; source_url:string;
};

const sourceRoot=path.resolve('.openfootball-source');
const destination=path.resolve('data/cup-brackets/coppa-italia-2020-2025.json');
const folders=['2020-21','2021-22','2022-23','2023-24','2024-25'];
const months:{[key:string]:number}={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const rounds:{[key:string]:string}={
  'preliminary round':'Turno preliminare','round 1':'Primo turno','round 2':'Secondo turno',
  'round 3':'Terzo turno','round 4':'Quarto turno','round of 16':'Ottavi di finale',
  quarterfinals:'Quarti di finale',semifinals:'Semifinali',final:'Finale'
};

const dateFor=(season:string,month:string,day:string,explicitYear?:string)=>{
  const start=Number(season.slice(0,4)); const monthNumber=months[month];
  const year=explicitYear?Number(explicitYear):(monthNumber>=7?start:start+1);
  return `${year}-${String(monthNumber).padStart(2,'0')}-${String(day).padStart(2,'0')}T12:00:00+01:00`;
};

const clean=(value:string)=>value.replace(/\s+\[(?:awarded|forfeit)\]\s*$/i,'').trim();

function parseMatch(line:string){
  const withV=line.match(/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(.*)$/i);
  const columns=line.match(/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s{2,}(\d+)-(\d+)(.*?\s{2,}.+)$/);
  const parsed=withV?{home:withV[1],away:withV[2],homeScore:withV[3],awayScore:withV[4],tail:withV[5]}:columns?{home:columns[1],homeScore:columns[2],awayScore:columns[3],away:columns[4],tail:columns[5]}:null;
  if(!parsed)return null;
  // The source puts the shootout score first (e.g. "5-4 pen. 0-0 a.e.t.").
  // For season statistics we retain the result on the pitch, not the shootout.
  if(/pen\./i.test(parsed.tail)){
    const regular=parsed.tail.match(/(\d+)-(\d+)/);
    if(regular){parsed.homeScore=regular[1];parsed.awayScore=regular[2];}
  }
  return {home:clean(parsed.home),away:clean(parsed.away),homeScore:Number(parsed.homeScore),awayScore:Number(parsed.awayScore)};
}

const matches:Match[]=[];
for(const folder of folders){
  const file=path.join(sourceRoot,folder,'cup.txt');
  if(!fs.existsSync(file))throw new Error(`Fonte mancante: ${file}`);
  const season=folder.replace('-', '/'); let round='Turno non definito'; let date='';
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const heading=line.match(/(?:â–ª|▪)\s*(.+)$/);
    if(heading){round=rounds[heading[1].trim().toLowerCase()]??heading[1].trim();continue;}
    const dateLine=line.match(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/);
    if(dateLine){date=dateFor(season,dateLine[1],dateLine[2],dateLine[3]);continue;}
    if(!date)continue;
    const fixture=parseMatch(line); if(!fixture)continue;
    // Sassuolo fixtures already have a dedicated source in this project. Keeping
    // them out of the full-bracket file prevents the same match being imported twice.
    if(/sassuolo/i.test(fixture.home)||/sassuolo/i.test(fixture.away))continue;
    matches.push({external_key:`openfootball-coppa|${folder}|${date.slice(0,10)}|${fixture.home}|${fixture.away}`,date,season,competition:'Coppa Italia',round,home_team:fixture.home,away_team:fixture.away,home_score:fixture.homeScore,away_score:fixture.awayScore,completeness_level:'STANDARD',source_provider:'openfootball/italy',source_url:`https://github.com/openfootball/italy/blob/master/${folder}/cup.txt`});
  }
}
fs.writeFileSync(destination,`${JSON.stringify(matches,null,2)}\n`);
console.log(`Generated ${matches.length} Coppa Italia matches in ${path.relative(process.cwd(),destination)}`);
