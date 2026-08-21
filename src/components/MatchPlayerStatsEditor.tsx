import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileUp, Save, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import { Loading } from './Ui';

type StatRow=Record<string,any>&{player_id:number;player_name:string;position:string|null;shirt_number:number|null;selected:boolean;archive_rating:number|null;archive_rating_confidence:number|null;archive_rating_level:string|null;archive_rating_breakdown?:{label:string;delta:number}[]};
type Payload={match:Record<string,any>&{id:number;home_team:string;away_team:string;home_score:number|null;away_score:number|null;date:string};version:string;methodology:string;sourceSuggestions:string[];rows:StatRow[]};

const simpleFields=[
  ['minutes','Minuti'],['goals','Gol'],['assists','Assist'],['yellow_cards','Gialli'],['red_cards','Rossi'],
] as const;
const advancedFields=[
  ['shots_total','Tiri'],['shots_on','In porta'],['passes_total','Passaggi'],['passes_key','Passaggi chiave'],['pass_accuracy','Precisione %'],
  ['tackles_total','Tackle'],['blocks','Blocchi'],['interceptions','Intercetti'],['duels_total','Duelli'],['duels_won','Duelli vinti'],
  ['dribbles_attempts','Dribbling'],['dribbles_success','Dribbling riusciti'],['fouls_drawn','Falli subiti'],['fouls_committed','Falli commessi'],
  ['saves','Parate'],['goals_conceded','Gol subiti'],['penalty_won','Rigori procurati'],['penalty_committed','Rigori causati'],['penalty_missed','Rigori sbagliati'],['penalty_saved','Rigori parati'],['own_goals','Autogol'],['offsides','Fuorigioco'],
] as const;
const allFields=[...simpleFields,...advancedFields];

const headerAliases:Record<string,string>={
  player:'player_name',name:'player_name',playername:'player_name',giocatore:'player_name',nome:'player_name',
  min:'minutes',minute:'minutes',minutes:'minutes',minuti:'minutes',position:'position',pos:'position',ruolo:'position',
  goals:'goals',goal:'goals',gol:'goals',assists:'assists',assist:'assists',yellowcards:'yellow_cards',yellow:'yellow_cards',gialli:'yellow_cards',
  redcards:'red_cards',red:'red_cards',rossi:'red_cards',shots:'shots_total',shotstotal:'shots_total',tiri:'shots_total',shotsontarget:'shots_on',shotsongoal:'shots_on',tirinporta:'shots_on',
  passes:'passes_total',passaggi:'passes_total',keypasses:'passes_key',passaggichiave:'passes_key',passaccuracy:'pass_accuracy',precisionepassaggi:'pass_accuracy',
  tackles:'tackles_total',tackle:'tackles_total',blocks:'blocks',blocchi:'blocks',interceptions:'interceptions',intercetti:'interceptions',
  duelstotal:'duels_total',duelli:'duels_total',duelswon:'duels_won',duellivinti:'duels_won',dribbles:'dribbles_attempts',dribbling:'dribbles_attempts',
  dribblesuccess:'dribbles_success',dribblingriusciti:'dribbles_success',foulsdrawn:'fouls_drawn',fallisubiti:'fouls_drawn',foulscommitted:'fouls_committed',fallicommessi:'fouls_committed',
  saves:'saves',parate:'saves',goalsconceded:'goals_conceded',golsubiti:'goals_conceded',penaltywon:'penalty_won',rigoriprocurati:'penalty_won',
  penaltycommitted:'penalty_committed',rigoricausati:'penalty_committed',penaltymissed:'penalty_missed',rigorisbagliati:'penalty_missed',penaltysaved:'penalty_saved',rigoriparati:'penalty_saved',
  owngoals:'own_goals',autogol:'own_goals',offsides:'offsides',fuorigioco:'offsides',starter:'starter',starting:'starter',titolare:'starter',start:'starter',
};

const normalized=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const boolValue=(value:unknown)=>['1','true','yes','si','sì','x','starter','titolare'].includes(String(value??'').trim().toLowerCase());

function parseLine(line:string,delimiter:string){const cells:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){cells.push(value.trim());value='';}else value+=char;}cells.push(value.trim());return cells;}
function parseTable(text:string){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());if(lines.length<2)throw new Error('La tabella deve contenere intestazione e almeno una riga.');
  const candidates=['\t',';',','];const delimiter=candidates.sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
  const headers=parseLine(lines[0],delimiter).map(header=>headerAliases[normalized(header)]??normalized(header));
  if(!headers.includes('player_name'))throw new Error('Manca la colonna player_name / giocatore.');
  return lines.slice(1).map(line=>Object.fromEntries(parseLine(line,delimiter).map((value,index)=>[headers[index],value])));
}

const cell=(value:unknown)=>value==null?'':String(value);
const csvCell=(value:unknown)=>{const text=cell(value);return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};

export default function MatchPlayerStatsEditor({matchId,onClose,onChanged}:{matchId:number;onClose:()=>void;onChanged:()=>void}){
  const [data,setData]=useState<Payload|null>(null),[rows,setRows]=useState<StatRow[]>([]),[sourceUrl,setSourceUrl]=useState(''),[pasted,setPasted]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const load=()=>api<Payload>(`/current-season/matches/${matchId}/player-stats`).then(value=>{setData(value);setRows(value.rows);const source=value.rows.find(row=>row.source_url)?.source_url;if(source)setSourceUrl(source);});
  useEffect(()=>{void load()},[matchId]);
  const selected=useMemo(()=>rows.filter(row=>row.selected),[rows]);
  const patchRow=(playerId:number,patch:Record<string,unknown>)=>setRows(current=>current.map(row=>row.player_id===playerId?{...row,...patch}:row));
  const importText=(text:string)=>{try{
    const incoming=parseTable(text);let matched=0;
    setRows(current=>current.map(row=>{const found=incoming.find(item=>normalized(item.player_name)===normalized(row.player_name));if(!found)return row;matched++;const patch:any={selected:true};for(const [key] of allFields)if(Object.prototype.hasOwnProperty.call(found,key))patch[key]=found[key]===''?null:found[key];if(found.position)patch.position=found.position;if(Object.prototype.hasOwnProperty.call(found,'starter'))patch.substitute=boolValue(found.starter)?0:1;return {...row,...patch};}));
    setMessage(`${matched} giocatori riconosciuti dalla tabella.`);
  }catch(error){setMessage(String(error).replace(/^Error:\s*/,''));}};
  const readFile=async(file:File|undefined)=>{if(!file)return;const text=await file.text();setPasted(text);importText(text);};
  const downloadTemplate=()=>{const headers=['player_name','position','minutes','starter',...allFields.map(([key])=>key).filter(key=>key!=='minutes')];const content=[headers.join(','),...rows.map(row=>headers.map(header=>csvCell(header==='starter'?row.substitute===0?1:0:row[header])).join(','))].join('\n')+'\n';const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`sassuolo-player-stats-match-${matchId}.csv`;link.click();URL.revokeObjectURL(url);};
  const save=async()=>{setBusy(true);setMessage('');try{
    const payloadRows=selected.map(row=>({player_id:row.player_id,player_name:row.player_name,position:row.position,shirt_number:row.shirt_number,...Object.fromEntries(allFields.map(([key])=>[key,row[key]??null])),substitute:row.substitute??0,captain:row.captain??0}));
    await api(`/current-season/matches/${matchId}/player-stats`,{method:'PUT',body:JSON.stringify({rows:payloadRows,sourceUrl})});
    setMessage('Statistiche salvate e Sassuolo Archive Rating ricalcolato.');await load();onChanged();
  }catch(error){setMessage(String(error).replace(/^Error:\s*/,''));}finally{setBusy(false)}};
  if(!data)return <div className="fixed inset-0 z-50 grid place-items-center bg-black/85"><Loading/></div>;
  const match=data.match,completed=match.home_score!=null&&match.away_score!=null;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label="Statistiche e voti giocatori"><div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
    <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[.08] bg-zinc-950/95 px-5 py-4 backdrop-blur md:px-7"><div><div className="text-xs font-black uppercase tracking-[.18em] text-neroverde-300">Sassuolo Archive Rating · {data.version}</div><h2 className="mt-1 text-xl font-black">{match.home_team} <span className="text-zinc-400">–</span> {match.away_team}</h2><p className="mt-1 text-xs text-zinc-400">{String(match.date).slice(0,10)} · {completed?`${match.home_score}–${match.away_score}`:'risultato da completare'}</p></div><button className="btn-secondary !min-h-9 !px-2" onClick={onClose} aria-label="Chiudi"><X className="h-4 w-4"/></button></header>
    <div className="space-y-5 p-4 md:p-7">
      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]"><div className="rounded-2xl border border-neroverde-400/20 bg-neroverde-400/[.06] p-5"><div className="flex items-center gap-2 font-black"><Sparkles className="h-5 w-5 text-neroverde-300"/>Un voto nostro, non copiato</div><p className="mt-2 text-sm leading-6 text-zinc-300">Parte da 6 e applica bonus/malus dichiarati per risultato, ruolo, azioni decisive, disciplina, passaggi, duelli e difesa. Ogni voto conserva versione, affidabilità e spiegazione. Con meno di 10 minuti il voto resta N/D, salvo eventi decisivi.</p><div className="mt-3 flex flex-wrap gap-2"><span className="badge">Scala 3–10</span><span className="badge">Formula versionata</span><span className="badge">Nessun rating esterno</span></div></div>
        <div className="rounded-2xl border border-white/[.08] bg-zinc-900/40 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Importazione rapida</h3><p className="mt-1 text-xs text-zinc-400">Copia una tabella CSV/TSV oppure compila il modello con i dati di una fonte verificabile.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={downloadTemplate}><Download className="h-4 w-4"/>Modello CSV</button><label className="btn-secondary cursor-pointer"><FileUp className="h-4 w-4"/>Carica file<input className="hidden" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={event=>void readFile(event.target.files?.[0])}/></label></div></div><textarea className="input mt-4 min-h-28 font-mono text-xs" value={pasted} onChange={event=>setPasted(event.target.value)} placeholder={'player_name\tminutes\tgoals\tassists\tshots_total\tshots_on\nDomenico Berardi\t90\t1\t1\t4\t2'}/><button type="button" className="btn-secondary mt-3" disabled={!pasted.trim()} onClick={()=>importText(pasted)}>Applica tabella</button></div></section>
      {!completed&&<div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><b>Completa prima il risultato.</b> Puoi preparare i dati, ma il voto usa anche l’esito della partita.</div>}
      <section><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="font-black">Giocatori scesi in campo</h3><p className="mt-1 text-xs text-zinc-400">La rosa è precompilata; gol, assist e cartellini già presenti negli eventi vengono proposti automaticamente.</p></div><span className="text-sm font-bold text-zinc-300">{selected.length} selezionati</span></div><div className="grid gap-3 lg:grid-cols-2">{rows.map(row=><article key={row.player_id} className={`rounded-2xl border p-4 ${row.selected?'border-neroverde-400/25 bg-neroverde-400/[.04]':'border-zinc-800 bg-zinc-950/50'}`}><div className="flex items-start justify-between gap-3"><label className="flex min-w-0 items-start gap-3"><input className="mt-1 h-5 w-5 accent-emerald-500" type="checkbox" checked={row.selected} onChange={event=>patchRow(row.player_id,{selected:event.target.checked})}/><span className="min-w-0"><b className="block truncate">{row.player_name}</b><span className="text-xs text-zinc-400">#{row.shirt_number??'–'} · {row.position??'Ruolo N/D'}</span></span></label>{row.archive_rating!=null&&<div className="text-right"><div className="text-2xl font-black text-neroverde-300">{Number(row.archive_rating).toFixed(1)}</div><div className="text-[10px] uppercase text-zinc-400">{row.archive_rating_level} · {Math.round(Number(row.archive_rating_confidence??0)*100)}%</div></div>}</div>
          {row.selected&&<><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{simpleFields.map(([key,label])=><label className="text-xs" key={key}><span className="mb-1 block truncate text-zinc-400">{label}</span><input className="input !px-2 !py-2" type="number" min="0" max={key==='minutes'?130:undefined} value={cell(row[key])} onChange={event=>patchRow(row.player_id,{[key]:event.target.value})}/></label>)}</div><div className="mt-3 flex flex-wrap gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={row.substitute!==1} onChange={event=>patchRow(row.player_id,{substitute:event.target.checked?0:1})}/>Titolare</label><label className="flex items-center gap-2"><input type="checkbox" checked={row.captain===1} onChange={event=>patchRow(row.player_id,{captain:event.target.checked?1:0})}/>Capitano</label></div><details className="mt-3 rounded-xl border border-zinc-800 p-3"><summary className="cursor-pointer text-xs font-bold text-zinc-400">Statistiche avanzate ({advancedFields.length} campi facoltativi)</summary><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{advancedFields.map(([key,label])=><label className="text-xs" key={key}><span className="mb-1 block truncate text-zinc-400" title={label}>{label}</span><input className="input !px-2 !py-2" type="number" min="0" max={key==='pass_accuracy'?100:undefined} step={key==='pass_accuracy'?'0.1':'1'} value={cell(row[key])} onChange={event=>patchRow(row.player_id,{[key]:event.target.value})}/></label>)}</div></details>{(row.archive_rating_breakdown?.length??0)>0&&<details className="mt-3 text-xs text-zinc-400"><summary className="cursor-pointer font-bold">Perché {Number(row.archive_rating).toFixed(1)}</summary><ul className="mt-2 grid gap-1 sm:grid-cols-2">{row.archive_rating_breakdown?.map((item,index)=><li key={`${item.label}-${index}`} className="flex justify-between gap-2"><span>{item.label}</span><b className={item.delta>=0?'text-emerald-300':'text-red-300'}>{item.delta>=0?'+':''}{item.delta.toFixed(1)}</b></li>)}</ul></details>}</>}</article>)}</div></section>
      <section className="sticky bottom-3 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur"><div className="flex flex-col gap-3 lg:flex-row lg:items-end"><label className="min-w-0 flex-1 text-sm"><span className="mb-1.5 block font-bold text-zinc-300">URL della fonte <b className="text-neroverde-400">*</b></span><input className="input" type="url" required value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="https://www.legaseriea.it/..."/></label><button className="btn-primary" disabled={busy||!completed||!selected.length||!sourceUrl} onClick={()=>void save()}><Save className="h-4 w-4"/>{busy?'Calcolo…':'Salva e calcola voti'}</button></div>{message&&<div className="mt-3 flex items-start gap-2 text-sm text-zinc-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neroverde-300"/>{message}</div>}</section>
    </div>
  </div></div>;
}
