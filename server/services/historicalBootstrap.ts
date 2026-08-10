import fs from 'node:fs';
import path from 'node:path';
import { importAll } from './importer.js';

const SASSUOLO_ALIASES = new Set(['sassuolo', 'us sassuolo', 'u.s. sassuolo calcio', 'sassuolo calcio']);

type SeasonSource = { season:string; code:string; competition:'Serie A'|'Serie B'; league:'I1'|'I2' };

export const HISTORICAL_SEASONS: SeasonSource[] = [
  // The first five seasons in Serie B are covered by the same open
  // Football-Data archive used for the Serie A era. Keeping them here makes
  // the historical bootstrap a single, idempotent operation.
  {season:'2008/09',code:'0809',competition:'Serie B',league:'I2'},
  {season:'2009/10',code:'0910',competition:'Serie B',league:'I2'},
  {season:'2010/11',code:'1011',competition:'Serie B',league:'I2'},
  {season:'2011/12',code:'1112',competition:'Serie B',league:'I2'},
  {season:'2012/13',code:'1213',competition:'Serie B',league:'I2'},
  {season:'2013/14',code:'1314',competition:'Serie A',league:'I1'},
  {season:'2014/15',code:'1415',competition:'Serie A',league:'I1'},
  {season:'2015/16',code:'1516',competition:'Serie A',league:'I1'},
  {season:'2016/17',code:'1617',competition:'Serie A',league:'I1'},
  {season:'2017/18',code:'1718',competition:'Serie A',league:'I1'},
  {season:'2018/19',code:'1819',competition:'Serie A',league:'I1'},
  {season:'2019/20',code:'1920',competition:'Serie A',league:'I1'},
  {season:'2020/21',code:'2021',competition:'Serie A',league:'I1'},
  {season:'2021/22',code:'2122',competition:'Serie A',league:'I1'},
  {season:'2022/23',code:'2223',competition:'Serie A',league:'I1'},
  {season:'2023/24',code:'2324',competition:'Serie A',league:'I1'},
  {season:'2024/25',code:'2425',competition:'Serie B',league:'I2'},
  {season:'2025/26',code:'2526',competition:'Serie A',league:'I1'},
];

function parseCsv(text:string){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if(!lines.length) return [] as Record<string,string>[];
  const parse=(line:string)=>{const out:string[]=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;};
  const headers=parse(lines[0]).map(x=>x.trim());
  return lines.slice(1).map(line=>Object.fromEntries(parse(line).map((v,i)=>[headers[i],v?.trim?.() ?? v])));
}

function n(v:unknown){const x=Number(v);return v==null||v===''||Number.isNaN(x)?null:x;}
function integer(v:unknown){const x=n(v);return x==null?null:Math.trunc(x);}
function team(v:string|undefined){return (v??'').trim();}
function isSassuolo(name:string){return SASSUOLO_ALIASES.has(name.toLowerCase());}
function pad(v:number){return String(v).padStart(2,'0');}
function dateIso(raw:string, season:string){
  const value=raw.trim();
  const m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(m){let y=Number(m[3]); if(y<100){const start=Number(season.slice(0,4)); const century=Math.floor(start/100)*100; y=century+y; if(y<start-1)y+=100;} return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;}
  const d=new Date(value); return Number.isNaN(d.getTime())?value:d.toISOString().slice(0,10);
}

function score(row:Record<string,string>){
  const hg=integer(row.FTHG ?? row['Home Goals']);
  const ag=integer(row.FTAG ?? row['Away Goals']);
  return {hg,ag};
}

function tableFor(rows:Record<string,string>[]){
  const table=new Map<string,{team:string;p:number;w:number;d:number;l:number;gf:number;ga:number;pts:number}>();
  const get=(name:string)=>{let x=table.get(name);if(!x){x={team:name,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};table.set(name,x);}return x;};
  for(const r of rows){const h=team(r.HomeTeam),a=team(r.AwayTeam);const {hg,ag}=score(r);if(!h||!a||hg==null||ag==null)continue;const H=get(h),A=get(a);H.p++;A.p++;H.gf+=hg;H.ga+=ag;A.gf+=ag;A.ga+=hg;if(hg>ag){H.w++;A.l++;H.pts+=3;}else if(hg<ag){A.w++;H.l++;A.pts+=3;}else{H.d++;A.d++;H.pts++;A.pts++;}}

  const h2h=(teams:string[])=>{const set=new Set(teams);const mini=new Map<string,{pts:number;gd:number;gf:number}>();for(const t of teams)mini.set(t,{pts:0,gd:0,gf:0});for(const r of rows){const h=team(r.HomeTeam),a=team(r.AwayTeam);if(!set.has(h)||!set.has(a))continue;const {hg,ag}=score(r);if(hg==null||ag==null)continue;const H=mini.get(h)!,A=mini.get(a)!;H.gd+=hg-ag;A.gd+=ag-hg;H.gf+=hg;A.gf+=ag;if(hg>ag)H.pts+=3;else if(hg<ag)A.pts+=3;else{H.pts++;A.pts++;}}return mini;};
  const arr=[...table.values()];
  arr.sort((a,b)=>b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.team.localeCompare(b.team));
  // Refine equal-points groups with the common Italian head-to-head mini-table rules.
  for(let i=0;i<arr.length;){let j=i+1;while(j<arr.length&&arr[j].pts===arr[i].pts)j++;if(j-i>1){const group=arr.slice(i,j),mini=h2h(group.map(x=>x.team));group.sort((a,b)=>{const A=mini.get(a.team)!,B=mini.get(b.team)!;return B.pts-A.pts || B.gd-A.gd || B.gf-A.gf || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.team.localeCompare(b.team);});arr.splice(i,j-i,...group);}i=j;}
  return arr;
}

function record(rows:Record<string,string>[], home:boolean){let w=0,d=0,l=0;for(const r of rows){const h=isSassuolo(team(r.HomeTeam));if(h!==home)continue;const {hg,ag}=score(r);if(hg==null||ag==null)continue;const forGoals=home?hg:ag,against=home?ag:hg;if(forGoals>against)w++;else if(forGoals<against)l++;else d++;}return `${w}-${d}-${l}`;}

function toMatch(row:Record<string,string>, s:SeasonSource){
  const home=team(row.HomeTeam), away=team(row.AwayTeam), {hg,ag}=score(row);
  const date=dateIso(row.Date,s.season);
  const hthg=integer(row.HTHG), htag=integer(row.HTAG);
  const cards={homeYellow:integer(row.HY),awayYellow:integer(row.AY),homeRed:integer(row.HR),awayRed:integer(row.AR)};
  return {
    external_key:`football-data|${s.season}|${date}|${home}|${away}`,
    date,season:s.season,competition:s.competition,round:null,home_team:home,away_team:away,
    home_score:hg,away_score:ag,halftime_score:hthg==null||htag==null?null:`${hthg}-${htag}`,
    cards:Object.values(cards).some(v=>v!=null)?cards:null,stadium:null,attendance:null,referee:row.Referee||null,
    shots_home:integer(row.HS),shots_away:integer(row.AS),shots_on_target_home:integer(row.HST),shots_on_target_away:integer(row.AST),
    corners_home:integer(row.HC),corners_away:integer(row.AC),fouls_home:integer(row.HF),fouls_away:integer(row.AF),
    xg_home:n(row.HomeXG ?? row.HxG),xg_away:n(row.AwayXG ?? row.AxG),
    source_provider:'football-data.co.uk',source_url:`https://www.football-data.co.uk/mmz4281/${s.code}/${s.league}.csv`
  };
}

async function fetchText(url:string){
  const res=await fetch(url,{headers:{'User-Agent':'sassuolo-history-local-app/0.2'}});
  if(!res.ok)throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

export async function bootstrapHistoricalLeagueData(onProgress?:(message:string)=>void){
  const base=path.resolve('data');
  const matchCache=path.join(base,'matches','sassuolo-league-history.json');
  const seasonCache=path.join(base,'seasons','sassuolo-league-history.json');
  const readCache=(file:string)=>{try{const x=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(x)?x:[];}catch{return [];}};
  const previousMatches=readCache(matchCache); const previousSeasons=readCache(seasonCache);
  const allMatches:any[]=[]; const allSeasons:any[]=[]; const errors:{season:string;error:string}[]=[];
  for(const s of HISTORICAL_SEASONS){
    const url=`https://www.football-data.co.uk/mmz4281/${s.code}/${s.league}.csv`;
    onProgress?.(`Download ${s.season} ${s.competition}`);
    try{
      const raw=await fetchText(url); const rows=parseCsv(raw).filter(r=>r.HomeTeam&&r.AwayTeam);
      const clubRows=rows.filter(r=>isSassuolo(team(r.HomeTeam))||isSassuolo(team(r.AwayTeam)));
      if(!clubRows.length) throw new Error('Sassuolo non trovato nel CSV');
      allMatches.push(...clubRows.map(r=>toMatch(r,s)));
      const table=tableFor(rows); const pos=table.findIndex(x=>isSassuolo(x.team)); const row=table[pos];
      if(!row)throw new Error('Impossibile calcolare la classifica Sassuolo');
      allSeasons.push({season:s.season,competition:s.competition,final_position:pos+1,matches:row.p,wins:row.w,draws:row.d,losses:row.l,goals_for:row.gf,goals_against:row.ga,points:row.pts,home_record:record(clubRows,true),away_record:record(clubRows,false),source_provider:'football-data.co.uk',source_url:url});
    }catch(e){errors.push({season:s.season,error:String(e)}); allMatches.push(...previousMatches.filter((m:any)=>m.season===s.season)); allSeasons.push(...previousSeasons.filter((x:any)=>x.season===s.season&&x.competition===s.competition));}
    await new Promise(r=>setTimeout(r,180));
  }
  fs.mkdirSync(path.join(base,'matches'),{recursive:true}); fs.mkdirSync(path.join(base,'seasons'),{recursive:true});
  fs.writeFileSync(matchCache,JSON.stringify(allMatches,null,2));
  fs.writeFileSync(seasonCache,JSON.stringify(allSeasons,null,2));
  const imported=importAll();
  return {downloaded:{seasons:allSeasons.length,matches:allMatches.length},imported,errors};
}
