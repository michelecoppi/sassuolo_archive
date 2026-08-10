import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Edit3, ExternalLink, Save, Search, Trash2, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Loading, PageTitle, fmt } from '../components/Ui';

type Entity = 'seasons' | 'matches' | 'players' | 'player-seasons' | 'transfers' | 'match-events';
type Row = Record<string, any> & { id:number };
type Field = { key:string; label:string; type?:'text'|'number'|'date'|'checkbox'; required?:boolean; placeholder?:string };

const CONFIG: Record<Entity,{label:string; fields:Field[]; summary:(r:Row)=>string}> = {
  seasons:{label:'Stagioni',summary:r=>`${r.season} · ${r.competition}`,fields:[
    {key:'season',label:'Stagione',required:true,placeholder:'2013/14'}, {key:'competition',label:'Competizione',required:true,placeholder:'Serie A'},
    {key:'final_position',label:'Posizione finale',type:'number'}, {key:'matches',label:'Partite',type:'number'}, {key:'wins',label:'Vittorie',type:'number'}, {key:'draws',label:'Pareggi',type:'number'}, {key:'losses',label:'Sconfitte',type:'number'},
    {key:'goals_for',label:'Gol fatti',type:'number'}, {key:'goals_against',label:'Gol subiti',type:'number'}, {key:'points',label:'Punti',type:'number'}, {key:'manager',label:'Allenatore'}, {key:'home_record',label:'Record casa',placeholder:'10-5-4'}, {key:'away_record',label:'Record trasferta',placeholder:'6-4-9'}, {key:'source_url',label:'URL fonte'}
  ]},
  matches:{label:'Partite',summary:r=>`${r.date} · ${r.home_team} ${r.home_score ?? '–'}-${r.away_score ?? '–'} ${r.away_team}`,fields:[
    {key:'date',label:'Data',type:'date',required:true}, {key:'season',label:'Stagione',placeholder:'2025/26'}, {key:'competition',label:'Competizione',placeholder:'Serie A'}, {key:'round',label:'Giornata'},
    {key:'home_team',label:'Casa',required:true}, {key:'away_team',label:'Trasferta',required:true}, {key:'home_score',label:'Gol casa',type:'number'}, {key:'away_score',label:'Gol trasferta',type:'number'}, {key:'halftime_score',label:'Parziale HT',placeholder:'1-0'},
    {key:'stadium',label:'Stadio'}, {key:'attendance',label:'Spettatori',type:'number'}, {key:'referee',label:'Arbitro'}, {key:'possession_home',label:'Possesso casa %',type:'number'}, {key:'possession_away',label:'Possesso trasferta %',type:'number'},
    {key:'shots_home',label:'Tiri casa',type:'number'}, {key:'shots_away',label:'Tiri trasferta',type:'number'}, {key:'shots_on_target_home',label:'Tiri in porta casa',type:'number'}, {key:'shots_on_target_away',label:'Tiri in porta trasferta',type:'number'},
    {key:'corners_home',label:'Corner casa',type:'number'}, {key:'corners_away',label:'Corner trasferta',type:'number'}, {key:'fouls_home',label:'Falli casa',type:'number'}, {key:'fouls_away',label:'Falli trasferta',type:'number'}, {key:'xg_home',label:'xG casa',type:'number'}, {key:'xg_away',label:'xG trasferta',type:'number'}, {key:'source_url',label:'URL fonte'}
  ]},
  players:{label:'Giocatori',summary:r=>`${r.name}${r.position?` · ${r.position}`:''}`,fields:[
    {key:'name',label:'Nome',required:true}, {key:'photo_url',label:'URL foto'}, {key:'nationality',label:'Nazionalità'}, {key:'birth_date',label:'Data di nascita',type:'date'}, {key:'position',label:'Ruolo'}, {key:'shirt_number',label:'Numero',type:'number'},
    {key:'first_appearance',label:'Prima presenza',type:'date'}, {key:'last_appearance',label:'Ultima presenza',type:'date'}, {key:'appearances',label:'Presenze',type:'number'}, {key:'starts',label:'Titolare',type:'number'}, {key:'minutes',label:'Minuti',type:'number'},
    {key:'goals',label:'Gol',type:'number'}, {key:'assists',label:'Assist',type:'number'}, {key:'yellow_cards',label:'Gialli',type:'number'}, {key:'red_cards',label:'Rossi',type:'number'}, {key:'clean_sheets',label:'Clean sheet',type:'number'}, {key:'current_squad',label:'Rosa attuale',type:'checkbox'}, {key:'source_url',label:'URL fonte'}
  ]},
  'player-seasons':{label:'Statistiche giocatore/stagione',summary:r=>`${r.player_name} · ${r.season} · ${r.competition}`,fields:[
    {key:'player_name',label:'Giocatore',required:true}, {key:'season',label:'Stagione',required:true,placeholder:'2025/26'}, {key:'competition',label:'Competizione',required:true,placeholder:'Serie A'},
    {key:'appearances',label:'Presenze',type:'number'}, {key:'starts',label:'Titolare',type:'number'}, {key:'minutes',label:'Minuti',type:'number'}, {key:'goals',label:'Gol',type:'number'}, {key:'assists',label:'Assist',type:'number'}, {key:'rating',label:'Rating',type:'number'}, {key:'shots_total',label:'Tiri',type:'number'}, {key:'shots_on',label:'Tiri in porta',type:'number'}, {key:'passes_key',label:'Passaggi chiave',type:'number'}, {key:'tackles_total',label:'Tackle',type:'number'}, {key:'yellow_cards',label:'Gialli',type:'number'}, {key:'red_cards',label:'Rossi',type:'number'}, {key:'clean_sheets',label:'Clean sheet',type:'number'}, {key:'source_url',label:'URL fonte'}
  ]},
  transfers:{label:'Trasferimenti',summary:r=>`${r.date??'N/D'} · ${r.player_name} · ${r.direction}`,fields:[
    {key:'player_name',label:'Giocatore',required:true}, {key:'date',label:'Data',type:'date'}, {key:'season',label:'Stagione',placeholder:'2025/26'}, {key:'direction',label:'Direzione',required:true,placeholder:'IN oppure OUT'}, {key:'type',label:'Tipo / cifra'}, {key:'from_team_name',label:'Da squadra'}, {key:'to_team_name',label:'A squadra'}, {key:'source_url',label:'URL fonte'}
  ]},
  'match-events':{label:'Eventi partita',summary:r=>`${r.match_date?.slice(0,10)??'Data N/D'} · ${r.home_team??'N/D'} ${r.home_score??'–'}-${r.away_score??'–'} ${r.away_team??'N/D'} · ${r.minute==null?'minuto N/D':`${r.minute}${r.extra_minute?`+${r.extra_minute}`:''}'`} · ${r.player_name??r.team_name??'Evento'}`,fields:[
    {key:'match_id',label:'Partita (ID)',type:'number',required:true,placeholder:'ID partita'}, {key:'minute',label:'Minuto',type:'number',placeholder:'Lascia vuoto se non verificato'}, {key:'extra_minute',label:'Recupero',type:'number'}, {key:'team_name',label:'Squadra'}, {key:'player_name',label:'Giocatore'}, {key:'assist_name',label:'Assist / giocatore sostituito'}, {key:'type',label:'Tipo',placeholder:'Card, Goal, subst…'}, {key:'detail',label:'Dettaglio',placeholder:'Yellow Card'}, {key:'comments',label:'Nota evento'}, {key:'home_score',label:'Punteggio casa dopo evento',type:'number'}, {key:'away_score',label:'Punteggio trasferta dopo evento',type:'number'}, {key:'source_url',label:'URL referto / video autorizzato'}, {key:'verification_note',label:'Nota curatoriale'}, {key:'verified_by',label:'Verificato da'}, {key:'verified',label:'Dato verificato',type:'checkbox'}
  ]}
};

const entityValues = Object.keys(CONFIG) as Entity[];
const isEntity=(value:string|null):value is Entity=>entityValues.includes(value as Entity);
const emptyFor=(entity:Entity)=>Object.fromEntries(CONFIG[entity].fields.map(f=>[f.key,f.type==='checkbox'?false:'']));

export default function ManualEditor(){
  const [params]=useSearchParams();
  const initialEntity:Entity=isEntity(params.get('entity'))?params.get('entity') as Entity:'seasons';
  const [entity,setEntity]=useState<Entity>(initialEntity);
  const [rows,setRows]=useState<Row[]|null>(null);
  const [matches,setMatches]=useState<Row[]>([]);
  const [form,setForm]=useState<Record<string,any>>(()=>emptyFor(initialEntity));
  const [editing,setEditing]=useState<number|null>(null);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const openedLinkedEvent=useRef(false);
  const cfg=CONFIG[entity];
  const load=async()=>{setRows(null);setRows(await api<Row[]>(`/manual/${entity}`));};

  useEffect(()=>{
    openedLinkedEvent.current=false;
    setEditing(null);
    const next=emptyFor(entity);
    if(entity==='match-events'&&params.get('matchId'))next.match_id=params.get('matchId')??'';
    setForm(next);
    setQuery(entity==='match-events'&&params.get('id')?`#${params.get('id')}`:'');
    setStatus('');
    void load();
    if(entity==='match-events')void api<Row[]>('/manual/matches').then(setMatches);
  },[entity]);

  const filtered=useMemo(()=>rows?.filter(r=>`${r.id} ${cfg.summary(r)}`.toLowerCase().includes(query.toLowerCase()))??[],[rows,query,cfg]);
  const beginEdit=(r:Row)=>{
    const next=emptyFor(entity);
    for(const f of cfg.fields)next[f.key]=f.type==='checkbox'?Boolean(r[f.key]):(r[f.key]??'');
    setForm(next);setEditing(r.id);window.scrollTo({top:0,behavior:'smooth'});
  };
  useEffect(()=>{
    const linkedId=Number(params.get('id'));
    if(entity!=='match-events'||openedLinkedEvent.current||!Number.isInteger(linkedId)||!rows)return;
    const linked=rows.find(row=>row.id===linkedId);
    if(linked){openedLinkedEvent.current=true;beginEdit(linked);}
  },[entity,rows]);
  const reset=()=>{setEditing(null);setForm(emptyFor(entity));};
  const save=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setStatus('');
    try{await api(`/manual/${entity}${editing?`/${editing}`:''}`,{method:editing?'PUT':'POST',body:JSON.stringify(form)});setStatus(editing?'Modifica salvata.':'Dato aggiunto.');reset();await load();}
    catch(err){setStatus(`Errore: ${String(err)}`);}finally{setBusy(false);}
  };
  const remove=async(r:Row)=>{
    setBusy(true);
    try{
      const impact=await api<{cascades?:Record<string,number>;related?:Record<string,number>}>(`/manual/${entity}/${r.id}/impact`);
      const changes=Object.entries({...impact.cascades,...impact.related}).filter(([,count])=>count>0).map(([name,count])=>`${name}: ${count}`).join(', ');
      const warning=changes?`\nImpatto collegato: ${changes}.`:'';
      if(!confirm(`Eliminare “${cfg.summary(r)}”?${warning}\nVerrà creato un backup prima della cancellazione.`))return;
      await api(`/manual/${entity}/${r.id}`,{method:'DELETE'});if(editing===r.id)reset();await load();setStatus('Dato eliminato. Backup creato e modifica registrata.');
    }
    catch(err){setStatus(`Errore: ${String(err)}`);}finally{setBusy(false);}
  };
  const selectedMatch=entity==='match-events'?matches.find(m=>Number(m.id)===Number(form.match_id)):undefined;
  const matchText=selectedMatch?`${String(selectedMatch.date).slice(0,10)} · ${selectedMatch.home_team} ${selectedMatch.home_score??'–'}-${selectedMatch.away_score??'–'} ${selectedMatch.away_team}`:'';
  const sourceSearch=selectedMatch?`https://www.google.com/search?q=${encodeURIComponent(`${selectedMatch.home_team} ${selectedMatch.away_team} ${String(selectedMatch.date).slice(0,10)} referto video`)}`:'';

  return <>
    <PageTitle title="Modifica dati manualmente" subtitle="Correggi o integra SQLite dal browser, conservando la provenienza delle verifiche manuali." action={<Link className="btn-secondary" to="/data-manager"><ArrowLeft className="h-4 w-4"/>Data Manager</Link>}/>
    <div className="mb-5 flex flex-wrap gap-2">{entityValues.map(k=><button key={k} onClick={()=>setEntity(k)} className={entity===k?'btn-primary':'btn-secondary'}>{CONFIG[k].label}</button>)}</div>
    <form onSubmit={save} className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">{editing?'Modifica':'Nuovo'} · {cfg.label}</h2><p className="mt-1 text-xs text-zinc-500">Lascia vuoti i valori che non conosci: restano N/D, senza stime.</p></div>{editing&&<button type="button" onClick={reset} className="btn-secondary"><X className="h-4 w-4"/>Annulla</button>}</div>
      {entity==='match-events'&&<><datalist id="manual-match-options">{matches.map(m=><option key={m.id} value={m.id}>{String(m.date).slice(0,10)} · {m.home_team} – {m.away_team}</option>)}</datalist><div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-sky-100"><b>Prima controlla la gara.</b>{selectedMatch?<span className="ml-1">{matchText}</span>:<span className="ml-1">Inserisci l’ID della partita per aprire contesto e fonti.</span>}{selectedMatch&&<div className="mt-3 flex flex-wrap gap-2"><Link className="btn-secondary !min-h-8 !px-3 !py-1 text-xs" to={`/matches/${selectedMatch.id}`} target="_blank"><ExternalLink className="h-3.5 w-3.5"/>Apri scheda partita</Link><a className="btn-secondary !min-h-8 !px-3 !py-1 text-xs" href={sourceSearch} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Cerca referto o video autorizzato</a></div>}</div></>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cfg.fields.map(f=><label key={f.key} className="text-sm text-zinc-400"><span className="mb-1 block">{f.label}{f.required&&<b className="text-neroverde-400"> *</b>}</span>{f.type==='checkbox'?<input type="checkbox" checked={Boolean(form[f.key])} onChange={e=>setForm({...form,[f.key]:e.target.checked})} className="h-5 w-5 accent-emerald-500"/>:<input className="input" required={f.required} list={entity==='match-events'&&f.key==='match_id'?'manual-match-options':undefined} type={f.type??'text'} min={f.key==='minute'||f.key==='extra_minute'?0:undefined} max={f.key==='minute'?130:f.key==='extra_minute'?30:undefined} step={f.key.startsWith('xg_')||f.key.startsWith('possession_')?'0.01':undefined} placeholder={f.placeholder} value={form[f.key]??''} onChange={e=>setForm({...form,[f.key]:e.target.value})}/>}</label>)}</div>
      <div className="mt-5 flex items-center gap-3"><button className="btn-primary" disabled={busy}><Save className="h-4 w-4"/>{editing?'Salva modifiche':'Aggiungi'}</button>{status&&<span className="text-sm text-zinc-300">{status}</span>}</div>
    </form>
    <div className="card p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-bold">Dati presenti</h2><p className="text-xs text-zinc-500">{rows?.length??0} record</p></div><div className="relative w-full md:w-96"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600"/><input className="input pl-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca nei record…"/></div></div>
      {!rows?<Loading/>:<div className="space-y-2">{filtered.slice(0,500).map(r=><div key={r.id} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="truncate font-medium text-zinc-100">{cfg.summary(r)}</div><div className="mt-1 text-xs text-zinc-500">Fonte: {fmt(r.source_provider)} · ID {r.id}{entity==='match-events'&&<> · <Link className="text-neroverde-400 hover:underline" to={`/matches/${r.match_id}`} target="_blank">Apri partita</Link></>}</div></div><div className="flex shrink-0 gap-2"><button className="btn-secondary" onClick={()=>beginEdit(r)}><Edit3 className="h-4 w-4"/>Modifica</button><button className="btn-secondary text-red-300" onClick={()=>remove(r)}><Trash2 className="h-4 w-4"/>Elimina</button></div></div>)}{filtered.length>500&&<p className="pt-2 text-sm text-zinc-500">Mostrati i primi 500 risultati. Usa la ricerca per restringere l’elenco.</p>}{filtered.length===0&&<p className="py-6 text-center text-sm text-zinc-500">Nessun record.</p>}</div>}
    </div>
  </>;
}
