/**
 * Convert a saved FBref Standard export into the normal archive format.
 *
 * Usage:
 *   npm run history:fbref -- --input C:\exports\sassuolo-2012-13-standard.csv --season 2012/13 --source-url https://fbref.com/...
 *
 * The input file is deliberately supplied by the curator.  This makes the
 * import replayable and avoids treating a changing web page as a dataset.
 */
import fs from 'node:fs';
import path from 'node:path';

function value(flag:string){const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:undefined;}
const input=value('--input'),season=value('--season'),sourceUrl=value('--source-url');
if(!input||!season||!sourceUrl)throw new Error('Uso: --input <csv> --season <YYYY/YY> --source-url <url>');
if(!fs.existsSync(input))throw new Error(`Export non trovato: ${input}`);
if(!/^https?:\/\//.test(sourceUrl))throw new Error('--source-url deve essere un URL assoluto');

function csv(text:string){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);const parse=(line:string)=>{const out:string[]=[];let current='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(current);current='';}else current+=c;}out.push(current);return out;};const headers=parse(lines[0]).map(x=>x.trim());return lines.slice(1).map(line=>Object.fromEntries(parse(line).map((x,i)=>[headers[i],x.trim()])));}
const integer=(v:string|undefined)=>v==null||v===''?null:Number.parseInt(v.replace(/,/g,''),10);
const rows=csv(fs.readFileSync(input,'utf8')).filter(x=>x.Player&&!/Squad Total|Opponent Total/i.test(x.Player));
if(!rows.length)throw new Error('Nessuna riga Player Standard trovata nell’export');
const provider='FBref';const verifiedAt=new Date().toISOString();
const output=rows.map(row=>({player_name:row.Player,source_external_id:row['Player ID']||row.player_id||null,season,competition:'Serie B',appearances:integer(row.MP),starts:integer(row.Starts),minutes:integer(row.Min),goals:integer(row.Gls),assists:integer(row.Ast),yellow_cards:integer(row.CrdY),red_cards:integer(row.CrdR),source_provider:provider,source_url:sourceUrl,last_verified_at:verifiedAt}));
const destination=path.resolve('data/player-seasons',`fbref-standard-${season.replace('/','-')}.json`);
fs.writeFileSync(destination,JSON.stringify(output,null,2)+'\n','utf8');
const manifest=path.resolve('data/player-seasons','fbref-standard-manifest.json');
let entries:any[]=[];try{entries=JSON.parse(fs.readFileSync(manifest,'utf8'));}catch{}
entries=entries.filter(x=>x.season!==season);entries.push({season,competition:'Serie B',provider,source_url:sourceUrl,export_file:path.basename(input),import_file:path.basename(destination),rows:output.length,verified_at:verifiedAt});
fs.writeFileSync(manifest,JSON.stringify(entries.sort((a,b)=>a.season.localeCompare(b.season)),null,2)+'\n','utf8');
console.log(`Creato ${destination} (${output.length} righe verificabili). Esegui npm run import:all.`);
