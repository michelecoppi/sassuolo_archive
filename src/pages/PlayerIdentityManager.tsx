import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Database, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Empty, Loading, PageTitle } from '../components/Ui';

type C = { id:number; raw_name:string; source_provider:string|null; source_player_id:string|null; context:string|null; reason:string|null; resolution_action?:string|null; candidates:{id:number;name:string;score?:number;explanation?:string}[] };
type P = { id:number; name:string };
type Preview = {
  conflict:C&{source_url?:string|null};
  target:{id:number;name:string;position:string|null;nationality:string|null;birth_date:string|null};
  stats:{seasons:number;appearances:number;minutes:number;goals:number;assists:number};
  matches:{match_stats:number;match_minutes:number;match_goals:number;match_assists:number};
  related:{transfers:number;source_ids:number;aliases:number};targetSources:Array<{source_provider:string;source_player_id:string;source_url:string|null;last_verified_at:string|null}>;
  incoming:{player_seasons:number;match_stats:number;transfers:number;note:string};
  effects:{alias_to_save:string;source_id_to_link:string|null;canonical_name:string};
};

const fmt=(value:number|null|undefined)=>value==null?'N/D':value.toLocaleString('it-IT');

export default function PlayerIdentityManager(){
  const [data,setData]=useState<any>();
  const [players,setPlayers]=useState<P[]>([]);
  const [selected,setSelected]=useState<Record<number,number>>({});
  const [search,setSearch]=useState<Record<number,string>>({});
  const [previews,setPreviews]=useState<Record<number,Preview|undefined>>({});
  const [busy,setBusy]=useState<number|null>(null);
  const [message,setMessage]=useState('');
  const load=()=>api<any>('/data-manager').then(setData);

  useEffect(()=>{void load();void api<P[]>('/players?all=1&sort=name').then(setPlayers)},[]);

  const choose=async(conflictId:number,playerId:number)=>{
    setSelected(current=>({...current,[conflictId]:playerId}));
    setPreviews(current=>({...current,[conflictId]:undefined}));
    if(!playerId)return;
    try{
      const preview=await api<Preview>(`/player-identity-conflicts/${conflictId}/preview?playerId=${playerId}`);
      setPreviews(current=>({...current,[conflictId]:preview}));
    }catch(error){setMessage(`Anteprima non disponibile: ${String(error)}`)}
  };

  const act=async(c:C,action:'merge'|'create'|'reject'|'defer')=>{
    const playerId=selected[c.id];
    const preview=previews[c.id];
    let name:string|undefined;
    if(action==='merge'){
      if(!playerId||!preview)return window.alert('Seleziona il giocatore reale e attendi l’anteprima.');
      if(!window.confirm(`Confermi il collegamento?\n\nOrigine: ${c.raw_name}\nDestinazione: ${preview.target.name}\nAlias salvato: ${preview.effects.alias_to_save}\nStatistiche trasferite: 0\n\nLe statistiche già presenti su ${preview.target.name} non vengono modificate.`))return;
    }
    if(action==='create'){
      name=window.prompt('Nome completo del nuovo giocatore',c.raw_name)?.trim();
      if(!name)return;
      if(!window.confirm(`Creare il nuovo profilo “${name}”?\n\nVerranno salvati alias e identificativo della fonte. Il profilo nasce senza stagioni, statistiche o trasferimenti.`))return;
    }
    if(action==='reject'&&!window.confirm(`Rifiutare “${c.raw_name}”? Nessun dato verrà collegato o creato.`))return;
    const note=window.prompt(action==='defer'?'Motivo del rinvio e prossima evidenza da cercare':'Motivazione e fonti consultate');if(!note?.trim())return;
    setBusy(c.id);
    setMessage('');
    try{
      const result=await api<any>(`/player-identity-conflicts/${c.id}/resolve`,{method:'POST',body:JSON.stringify({action,playerId,name,note})});
      setMessage(action==='merge'?`“${c.raw_name}” collegato a “${preview?.target.name}” · backup #${result.backupId}.`:action==='create'?`Creato il nuovo profilo “${name}” · backup #${result.backupId}.`:action==='defer'?`“${c.raw_name}” rinviato con motivazione registrata.`:`“${c.raw_name}” rifiutato · backup #${result.backupId}.`);
      await load();
    }catch(error){setMessage(`Operazione non completata: ${String(error)}`)}finally{setBusy(null)}
  };
  const reopen=async(id:number)=>{const note=window.prompt('Motivo della riapertura e nuova evidenza');if(!note?.trim())return;setBusy(id);try{const result=await api<any>(`/player-identity-conflicts/${id}/reopen`,{method:'POST',body:JSON.stringify({note})});setMessage(`Decisione annullata · backup #${result.backupId}.`);await load()}catch(error){setMessage(`Riapertura non completata: ${String(error)}`)}finally{setBusy(null)}};

  if(!data)return <Loading/>;
  const conflicts:C[]=data.playerConflicts??[];
  return <>
    <PageTitle title="Identità giocatori" subtitle="Controlla origine, destinazione ed effetto dell’operazione prima di confermare." action={<Link className="btn-secondary" to="/data-manager"><ArrowLeft className="h-4 w-4"/>Data Manager</Link>}/>
    {message&&<div className="mb-5 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm">{message}</div>}
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4"><UsersRound className="h-5 w-5 shrink-0 text-amber-300"/><div><b>{conflicts.length} identità da revisionare</b><p className="text-sm text-zinc-400">I punteggi sono suggerimenti spiegabili: nessun collegamento avviene automaticamente e questa operazione non trasferisce statistiche.</p>{(data.identitySummary??[]).map((row:any)=><span className="mr-2 mt-2 inline-block badge" key={`${row.provider}-${row.scope}`}>{row.provider} · {row.scope}: {row.unresolved}{row.deferred?` (${row.deferred} rinviate)`:''}</span>)}</div></div>
    {!conflicts.length?<Empty title="Nessun candidato da gestire"/>:<div className="space-y-4">{conflicts.map(c=>{
      const q=(search[c.id]??'').toLowerCase();
      const list=players.filter(p=>p.name.toLowerCase().includes(q)).slice(0,30);
      const preview=previews[c.id];
      return <article className="card p-5" key={c.id}>
        <div className="flex items-start justify-between gap-3"><div><div className="text-xl font-black">{c.raw_name}</div><div className="mt-1 text-sm text-zinc-400">{c.reason??'Possibile duplicato'} · {c.source_provider??'Fonte non indicata'}{c.source_player_id?` · ID ${c.source_player_id}`:''}</div><div className="mt-1 text-xs text-zinc-400">Contesto: {c.context??'non indicato'}{c.resolution_action==='defer'?' · revisione rinviata':''}</div></div><div className="flex gap-2"><button className="btn-secondary" disabled={busy===c.id} onClick={()=>act(c,'defer')}>Rinvia</button><button className="btn-secondary !border-red-500/30 !text-red-300" disabled={busy===c.id} onClick={()=>act(c,'reject')}>Rifiuta</button></div></div>
        <div className="mt-5 rounded-xl border border-neroverde-400/20 bg-neroverde-400/5 p-4"><label className="mb-2 block text-sm font-bold text-neroverde-300">Profilo canonico di destinazione</label><input className="input mb-2 w-full" placeholder="Scrivi nome o cognome..." value={search[c.id]??''} onChange={e=>setSearch(current=>({...current,[c.id]:e.target.value}))}/><select className="input w-full" value={selected[c.id]??''} onChange={e=>void choose(c.id,Number(e.target.value))}><option value="">Seleziona tra i risultati...</option>{list.map(p=>{const suggestion=c.candidates.find(candidate=>candidate.id===p.id);return <option key={p.id} value={p.id}>{p.name} · ID {p.id}{suggestion?.score!=null?` · ${suggestion.score}% ${suggestion.explanation}`:''}</option>})}</select>
          {selected[c.id]&&!preview&&<p className="mt-3 text-sm text-zinc-400">Caricamento anteprima…</p>}
          {preview&&<div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/70 p-4"><div className="mb-3 flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase text-zinc-400">Identità ricevuta</div><div className="truncate font-bold">{c.raw_name}</div><div className="text-xs text-zinc-400">{c.source_provider??'Fonte N/D'}{c.source_player_id?` · ${c.source_player_id}`:''}</div></div><ArrowRight className="h-5 w-5 shrink-0 text-neroverde-300"/><div className="min-w-0 flex-1 text-right"><div className="text-xs font-bold uppercase text-zinc-400">Profilo mantenuto</div><div className="truncate font-bold text-neroverde-300">{preview.target.name}</div><div className="text-xs text-zinc-400">ID {preview.target.id} · {preview.target.position??'ruolo N/D'}</div></div></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="rounded-lg bg-zinc-900 p-2">Stagioni <b className="block">{fmt(preview.stats.seasons)}</b></div><div className="rounded-lg bg-zinc-900 p-2">Presenze <b className="block">{fmt(preview.stats.appearances)}</b></div><div className="rounded-lg bg-zinc-900 p-2">Minuti <b className="block">{fmt(preview.stats.minutes)}</b></div><div className="rounded-lg bg-zinc-900 p-2">Trasferimenti <b className="block">{fmt(preview.related.transfers)}</b></div></div><div className="mt-3 flex gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-sky-100"><Database className="h-4 w-4 shrink-0"/><div><b>Effetto esatto:</b> salva l’alias “{preview.effects.alias_to_save}”{preview.effects.source_id_to_link?` e collega ${preview.effects.source_id_to_link}`:''}. <b>0 stagioni, 0 statistiche partita e 0 trasferimenti vengono spostati.</b></div></div></div>}
          {preview&&<div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2"><div><b className="text-zinc-200">Fonte in ingresso</b><div>{c.source_provider??'N/D'} · {c.source_player_id??'ID N/D'}{preview.conflict.source_url&&<> · <a className="text-neroverde-300 hover:underline" href={preview.conflict.source_url} target="_blank" rel="noreferrer">apri</a></>}</div></div><div><b className="text-zinc-200">Fonti del profilo</b><div>{preview.targetSources.length?preview.targetSources.map(source=>`${source.source_provider} · ${source.source_player_id}`).join(', '):'Nessun identificativo esterno'}</div></div></div>}
          <button className="btn-primary mt-3" disabled={busy===c.id||!preview} onClick={()=>act(c,'merge')}>Conferma collegamento identità</button></div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800 p-3"><div><b>Persona realmente nuova?</b><p className="text-xs text-zinc-400">Crea un profilo vuoto con alias e ID fonte; nessuna statistica viene importata qui.</p></div><button className="btn-secondary" disabled={busy===c.id} onClick={()=>act(c,'create')}>Crea nuovo profilo</button></div>
      </article>
    })}</div>}
    {!!data.identityDecisions?.length&&<section className="card mt-5 p-5"><h2 className="font-bold">Decisioni recenti</h2><p className="mt-1 text-sm text-zinc-400">La riapertura rimuove soltanto gli effetti della decisione selezionata e crea prima un nuovo backup.</p><div className="mt-3 space-y-2">{data.identityDecisions.map((decision:any)=><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 p-3 text-sm" key={decision.id}><div><b>{decision.raw_name}</b> · {decision.resolution_action}<div className="text-xs text-zinc-400">{decision.reviewer}: {decision.resolution_note} · backup #{decision.backup_id}</div></div><button className="btn-secondary" disabled={busy===decision.id} onClick={()=>reopen(decision.id)}>Riapri</button></div>)}</div></section>}
  </>;
}
