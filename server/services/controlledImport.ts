import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db, initDb, normalizeTeamName, recordSourceReference } from '../db/database.js';
import { importAll } from './importer.js';
import { resolvePlayer } from './playerResolver.js';

initDb();

export const importEntities = ['seasons', 'matches', 'players', 'player-seasons'] as const;
export type ImportEntity = typeof importEntities[number];
export type ImportIssue = { row: number; field: string | null; code: string; message: string; critical: boolean };
export type ImportPreview = {
  entity: ImportEntity; filename: string; checksum: string; format: 'csv' | 'json'; rows: number;
  created: number; updated: number; skipped: number; conflicts: number; errors: number;
  canApply: boolean; issues: ImportIssue[];
};

const required: Record<ImportEntity, string[][]> = {
  seasons: [['season'], ['competition']],
  matches: [['date'], ['home_team', 'homeTeam'], ['away_team', 'awayTeam'], ['season'], ['competition']],
  players: [['name']],
  'player-seasons': [['player_name', 'playerName', 'name', 'Player'], ['season'], ['competition']],
};
const integerFields = new Set(['matches', 'wins', 'draws', 'losses', 'goals_for', 'goals_against', 'points', 'final_position', 'home_score', 'away_score', 'attendance', 'shots_home', 'shots_away', 'shots_on_target_home', 'shots_on_target_away', 'corners_home', 'corners_away', 'fouls_home', 'fouls_away', 'shirt_number', 'appearances', 'starts', 'minutes', 'goals', 'assists', 'yellow_cards', 'yellow_red_cards', 'red_cards', 'clean_sheets']);

function csvRows(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
  const parse = (line: string) => { const cells:string[]=[]; let value='', quoted=false; for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}cells.push(value);return cells; };
  if (!lines.length) return [];
  const headers = parse(lines[0]).map(value => value.trim());
  if (!headers.length || headers.some((header, index) => !header || headers.indexOf(header) !== index)) throw new Error('Intestazioni CSV vuote o duplicate');
  return lines.slice(1).map((line, rowIndex) => {
    const values = parse(line);
    if (values.length !== headers.length) throw new Error(`Riga ${rowIndex + 2}: attese ${headers.length} colonne, trovate ${values.length}`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });
}

export function parseImportFile(filename: string, content: string): { format:'csv'|'json'; rows:Record<string, unknown>[] } {
  if (!content.trim()) throw new Error('File vuoto');
  if (filename.toLowerCase().endsWith('.csv')) return { format:'csv', rows:csvRows(content) };
  if (filename.toLowerCase().endsWith('.json')) {
    const parsed:unknown = JSON.parse(content);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Il JSON deve contenere un oggetto o un array di oggetti');
    return { format:'json', rows:rows as Record<string, unknown>[] };
  }
  throw new Error('Sono supportati solo file .csv e .json');
}

const valueOf = (row:Record<string,unknown>, aliases:string[]) => aliases.map(name => row[name]).find(value => value !== undefined && value !== null && String(value).trim() !== '');
const textOf = (row:Record<string,unknown>, aliases:string[]) => String(valueOf(row, aliases) ?? '').trim();
const validSeason = (value:string) => /^\d{4}\/\d{2}$/.test(value);
const validDate = (value:string) => /^\d{4}-\d{2}-\d{2}(?:[T ][^\s]+)?$/.test(value) && !Number.isNaN(Date.parse(value));

function existingRecord(entity:ImportEntity, row:Record<string,unknown>) {
  if(entity==='seasons') return db.prepare(`SELECT id,source_provider FROM seasons WHERE season=? AND competition=?`).get(textOf(row,['season']),textOf(row,['competition'])) as any;
  if(entity==='matches') return db.prepare(`SELECT id,source_provider FROM matches WHERE substr(date,1,10)=substr(?,1,10) AND lower(home_team)=lower(?) AND lower(away_team)=lower(?)`).get(textOf(row,['date']),normalizeTeamName(textOf(row,['home_team','homeTeam'])),normalizeTeamName(textOf(row,['away_team','awayTeam']))) as any;
  if(entity==='players') return db.prepare(`SELECT id,source_provider FROM players WHERE lower(trim(name))=lower(trim(?))`).get(textOf(row,['name'])) as any;
  const player = resolvePlayer({ name: textOf(row,['player_name','playerName','name','Player']), sourceProvider: textOf(row,['source_provider','sourceProvider']) || null, sourcePlayerId: valueOf(row,['source_external_id','sourceExternalId','player_id','playerId']) as string | number | null, sourceUrl: textOf(row,['source_url','sourceUrl']) || null, context: 'controlled-import-preview', allowCreate: false });
  if (player.status === 'conflict') return null;
  return db.prepare(`SELECT id,source_provider FROM player_seasons WHERE player_id=? AND season=? AND competition=?`).get(player.playerId,textOf(row,['season']),textOf(row,['competition'])) as any;
}

export function previewControlledImport(entity:ImportEntity, filename:string, content:string): ImportPreview {
  const {format,rows}=parseImportFile(filename,content);
  const checksum=crypto.createHash('sha256').update(content,'utf8').digest('hex');
  const issues:ImportIssue[]=[]; let created=0,updated=0,skipped=0,conflicts=0;
  const seen=new Set<string>();
  rows.forEach((row,index)=>{
    const rowNumber=index+2;
    for(const alternatives of required[entity])if(valueOf(row,alternatives)===undefined)issues.push({row:rowNumber,field:alternatives[0],code:'required',message:`Campo obbligatorio mancante: ${alternatives[0]}`,critical:true});
    const season=textOf(row,['season']); if(season&&!validSeason(season))issues.push({row:rowNumber,field:'season',code:'invalid_season',message:'Usare il formato YYYY/YY',critical:true});
    const date=textOf(row,['date']); if(date&&!validDate(date))issues.push({row:rowNumber,field:'date',code:'invalid_date',message:'Data non valida; usare ISO YYYY-MM-DD',critical:true});
    for(const [field,value] of Object.entries(row))if(integerFields.has(field)&&value!==''&&value!=null&&(!Number.isInteger(Number(String(value).replace(/,/g,'')))||Number(String(value).replace(/,/g,''))<0))issues.push({row:rowNumber,field,code:'invalid_number',message:`Valore intero non negativo non valido: ${value}`,critical:true});
    const starts=Number(row.starts),appearances=Number(row.appearances);if(row.starts!==''&&row.starts!=null&&row.appearances!==''&&row.appearances!=null&&starts>appearances)issues.push({row:rowNumber,field:'starts',code:'incompatible_stat',message:'Le partenze da titolare superano le presenze',critical:true});
    if(!textOf(row,['source_url','sourceUrl'])&&!textOf(row,['source_provider','sourceProvider']))issues.push({row:rowNumber,field:'source_url',code:'missing_source',message:'Riga senza source_url o source_provider',critical:true});
    const key=entity==='seasons'?`${season}|${textOf(row,['competition'])}`:entity==='matches'?`${date.slice(0,10)}|${normalizeTeamName(textOf(row,['home_team','homeTeam']))}|${normalizeTeamName(textOf(row,['away_team','awayTeam']))}`:entity==='players'?textOf(row,['name']).toLowerCase():`${textOf(row,['player_name','playerName','name','Player']).toLowerCase()}|${season}|${textOf(row,['competition'])}`;
    if(seen.has(key)){issues.push({row:rowNumber,field:null,code:'duplicate_in_file',message:'Identità duplicata nello stesso file',critical:true});skipped++;return;}seen.add(key);
    if(entity==='players') {
      const playerName=textOf(row,['name']);
      const normalized=playerName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      const surname=normalized.split(/\s+/).at(-1) ?? normalized;
      const likelyDuplicate=/^\p{L}\.\s+/u.test(playerName) || (db.prepare('SELECT 1 FROM players WHERE lower(name) LIKE ? LIMIT 1').get(`% ${surname}`));
      if(likelyDuplicate) { const identity=resolvePlayer({name:playerName,sourceProvider:textOf(row,['source_provider','sourceProvider'])||null,sourcePlayerId:valueOf(row,['source_external_id','sourceExternalId','api_football_id','apiFootballId']) as string|number|null,sourceUrl:textOf(row,['source_url','sourceUrl'])||null,context:`controlled-import:players:${rowNumber}`,allowCreate:false}); if(identity.status==='conflict') { issues.push({row:rowNumber,field:'name',code:'player_identity_conflict',message:`Identità giocatore sospetta: revisione richiesta nel Data Manager (conflitto #${identity.conflictId})`,critical:true}); conflicts++; return; } }
    }
    const existing=existingRecord(entity,row);
    if(existing?.source_provider==='manual'){issues.push({row:rowNumber,field:null,code:'manual_conflict',message:'Il record esistente è manuale e non verrà sovrascritto',critical:true});conflicts++;return;}
    if(existing)updated++;else created++;
  });
  const errors=issues.filter(issue=>issue.critical).length;
  return {entity,filename,checksum,format,rows:rows.length,created,updated,skipped,conflicts,errors,canApply:rows.length>0&&errors===0,issues};
}

export function applyControlledImport(entity:ImportEntity, filename:string, content:string) {
  const preview=previewControlledImport(entity,filename,content);
  if(!preview.canApply)throw new Error(`Import bloccato: ${preview.errors} errori critici`);
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-import-'));
  try{
    const targetDir=path.join(tempRoot,entity);fs.mkdirSync(targetDir,{recursive:true});fs.writeFileSync(path.join(targetDir,path.basename(filename)),content,'utf8');
    const result=db.transaction(()=>importAll({base:tempRoot}))();
    return {preview,result};
  }finally{fs.rmSync(tempRoot,{recursive:true,force:true});}
}

export function recordControlledImportProvenance(entity:ImportEntity, filename:string, content:string, importRunId:number, archivedPath:string) {
  const {rows}=parseImportFile(filename,content);
  const entityTypes:Record<ImportEntity,string>={seasons:'seasons',matches:'matches',players:'players','player-seasons':'player_seasons'};
  let references=0;
  db.transaction(()=>{
    for(const row of rows){
      const existing=existingRecord(entity,row) as {id:number}|undefined;
      if(!existing?.id)continue;
      const sourceProvider=textOf(row,['source_provider','sourceProvider'])||'controlled-upload';
      const sourceUrl=textOf(row,['source_url','sourceUrl'])||`archive://${archivedPath.replace(/\\/g,'/')}`;
      const ignored=new Set(['source_provider','sourceProvider','source_url','sourceUrl','last_verified_at','lastVerifiedAt']);
      for(const [field,value] of Object.entries(row)){
        if(ignored.has(field)||value==null||String(value).trim()==='')continue;
        recordSourceReference({entityType:entityTypes[entity],entityId:existing.id,field,sourceUrl,sourceProvider,importRunId,transformation:`controlled-import:${filename}`,originalValue:value,verifiedAt:textOf(row,['last_verified_at','lastVerifiedAt'])||undefined});
        references++;
      }
    }
  })();
  return references;
}
