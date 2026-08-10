import fs from 'node:fs';
import path from 'node:path';
import { db, normalizeNameForMatch } from '../server/db/database.js';

const file = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(file)) throw new Error('Indicare il percorso di data.csv');

const parseLine = (line:string) => { const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(char===','&&!quoted){out.push(value);value='';}else value+=char;}out.push(value);return out; };
const lines=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
const headers=parseLine(lines[0]);
const rows=lines.slice(1).map(line=>Object.fromEntries(parseLine(line).map((value,index)=>[headers[index],value])));
const exact=db.prepare(`SELECT id,name FROM players WHERE lower(trim(name))=lower(trim(?))`);
const normalized=db.prepare(`SELECT id,name FROM players`).all() as {id:number;name:string}[];
const report=rows.map((row,index)=>{
  const name=row.player_name??row.playerName??row.name??row.Player??'';
  const exactRows=exact.all(name) as {id:number;name:string}[];
  const similar=normalized.filter(player=>normalizeNameForMatch(player.name)===normalizeNameForMatch(name));
  return {row:index+2,name,status:exactRows.length===1?'exact':exactRows.length>1?'ambiguous':'unmatched',matches:exactRows.length?exactRows:similar};
});
console.log(JSON.stringify({file,rows:rows.length,exact:report.filter(x=>x.status==='exact').length,unmatched:report.filter(x=>x.status==='unmatched'),ambiguous:report.filter(x=>x.status==='ambiguous')},null,2));
