import { useEffect, useState } from 'react';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Empty, Loading, PageTitle } from '../components/Ui';

type C = { id:number; raw_name:string; source_provider:string|null; source_player_id:string|null; context:string|null; reason:string|null; candidates:{id:number;name:string}[] };
type P = { id:number; name:string };

export default function PlayerIdentityManager(){
  const [data,setData]=useState<any>(); const [players,setPlayers]=useState<P[]>([]);
  const [selected,setSelected]=useState<Record<number,number>>({}); const [search,setSearch]=useState<Record<number,string>>({}); const [busy,setBusy]=useState<number|null>(null);
  const load=()=>api<any>('/data-manager').then(setData);
  useEffect(()=>{void load();api<P[]>('/players?all=1&sort=name').then(setPlayers)},[]);
  const act=async(c:C,action:'merge'|'create'|'reject')=>{
    const playerId=selected[c.id]; const name=action==='create'?window.prompt('Nome completo del nuovo giocatore',c.raw_name):undefined;
    if(action==='merge'&&!playerId)return window.alert('Cerca e seleziona prima il giocatore reale.');
    if(action==='create'&&!name)return; if(action==='reject'&&!window.confirm(`Rifiutare "${c.raw_name}"?`))return;
    setBusy(c.id); try{await api(`/player-identity-conflicts/${c.id}/resolve`,{method:'POST',body:JSON.stringify({action,playerId,name})});await load()}finally{setBusy(null)}
  };
  if(!data)return <Loading/>; const conflicts:C[]=data.playerConflicts??[];
  return <><PageTitle title="Identità giocatori" subtitle="Cerca il profilo reale e collega il nome: la scelta viene salvata come alias." action={<Link className="btn-secondary" to="/data-manager"><ArrowLeft className="h-4 w-4"/>Data Manager</Link>}/>
    <div className="mb-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4"><UsersRound className="h-5 w-5 text-amber-300"/><div><b>{conflicts.length} candidati</b><p className="text-sm text-zinc-400">Dopo un collegamento, lo stesso nome verrà riconosciuto automaticamente negli import futuri.</p></div></div>
    {!conflicts.length?<Empty title="Nessun candidato da gestire"/>:<div className="space-y-4">{conflicts.map(c=>{const q=(search[c.id]??'').toLowerCase();const list=players.filter(p=>p.name.toLowerCase().includes(q)).slice(0,30);return <article className="card p-5" key={c.id}><div className="flex items-start justify-between gap-3"><div><div className="text-xl font-black">{c.raw_name}</div><div className="mt-1 text-sm text-zinc-500">{c.reason??'Possibile duplicato'} · {c.source_provider??'Fonte non indicata'}{c.source_player_id?` · ID ${c.source_player_id}`:''}</div></div><button className="btn-secondary !border-red-500/30 !text-red-300" disabled={busy===c.id} onClick={()=>act(c,'reject')}>Rifiuta</button></div>
      <div className="mt-5 rounded-xl border border-neroverde-400/20 bg-neroverde-400/5 p-4"><label className="mb-2 block text-sm font-bold text-neroverde-300">Cerca giocatore reale</label><input className="input mb-2 w-full" placeholder="Scrivi nome o cognome..." value={search[c.id]??''} onChange={e=>setSearch(x=>({...x,[c.id]:e.target.value}))}/><select className="input w-full" value={selected[c.id]??''} onChange={e=>setSelected(x=>({...x,[c.id]:Number(e.target.value)}))}><option value="">Seleziona tra i risultati...</option>{list.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="btn-primary mt-2" disabled={busy===c.id||!selected[c.id]} onClick={()=>act(c,'merge')}>Collega e salva questa scelta</button><p className="mt-2 text-xs text-zinc-500">Il nome originale resta come alias e verrà risolto automaticamente la prossima volta.</p></div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800 p-3"><div><b>Non è presente?</b><p className="text-xs text-zinc-500">Crea un profilo solo se è davvero una persona nuova.</p></div><button className="btn-secondary" disabled={busy===c.id} onClick={()=>act(c,'create')}>Crea nuovo</button></div></article>})}</div>}
  </>;
}
