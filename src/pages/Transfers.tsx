import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft,ArrowUpRight,RefreshCw } from 'lucide-react';
import { api,post } from '../services/api';
import { Empty,Loading,PageTitle,fmt } from '../components/Ui';
import type { Transfer } from '../types';

type Season={season:string};
export default function Transfers(){
  const[data,setData]=useState<Transfer[]|null>(null);const[seasons,setSeasons]=useState<Season[]>([]);const[season,setSeason]=useState('');const[type,setType]=useState('');const[busy,setBusy]=useState(false);
  const load=()=>{const query=new URLSearchParams();if(season)query.set('season',season);if(type)query.set('type',type);return api<Transfer[]>(`/transfers?${query}`).then(setData)};
  useEffect(()=>{api<Season[]>('/seasons').then(setSeasons)},[]);useEffect(()=>{setData(null);void load()},[season,type]);
  const update=async()=>{setBusy(true);try{await post('/api-football/transfers');await load();}finally{setBusy(false)}};
  const grouped=useMemo(()=>({arrivals:data?.filter(x=>x.direction==='IN')??[],departures:data?.filter(x=>x.direction==='OUT')??[]}),[data]);
  if(!data)return <Loading/>;
  const table=(rows:Transfer[],direction:'IN'|'OUT')=>rows.length?<div className="table-wrap"><table><thead><tr><th>Data</th><th>Giocatore</th><th>{direction==='IN'?'Da':'A'}</th><th>Tipo</th><th>Stagione</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td>{t.date?new Date(`${t.date}T00:00:00`).toLocaleDateString('it-IT'):'N/D'}</td><td>{t.player_id?<Link className="font-bold text-neroverde-400 hover:underline" to={`/players/${t.player_id}`}>{t.player_name}</Link>:<b>{t.player_name}</b>}</td><td>{fmt(direction==='IN'?t.from_team_name:t.to_team_name)}</td><td><span className="badge">{fmt(t.type)}</span></td><td>{fmt(t.season)}</td></tr>)}</tbody></table></div>:<Empty text="Nessun trasferimento memorizzato per questo filtro."/>;
  return <><PageTitle title="Trasferimenti" subtitle="Arrivi, prestiti, rientri e partenze restano eventi distinti e vengono deduplicati dal database locale." action={<div className="flex flex-wrap gap-2"><select className="input w-40" value={season} onChange={e=>setSeason(e.target.value)}><option value="">Tutte le stagioni</option>{[...new Set(seasons.map(s=>s.season))].map(x=><option key={x} value={x}>{x}</option>)}</select><select className="input w-40" value={type} onChange={e=>setType(e.target.value)}><option value="">Tutti i tipi</option><option value="Transfer">Transfer</option><option value="Loan">Prestito</option><option value="Return from loan">Rientro prestito</option><option value="Free">Svincolato</option><option value="Free agent">Fine contratto / svincolo</option></select><button className="btn-secondary" disabled={busy} onClick={update}><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>Aggiorna</button></div>}/><div className="grid gap-5 xl:grid-cols-2"><section><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ArrowDownLeft className="h-5 w-5 text-neroverde-400"/>Arrivi <span className="text-sm text-zinc-500">({grouped.arrivals.length})</span></h2>{table(grouped.arrivals,'IN')}</section><section><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ArrowUpRight className="h-5 w-5 text-amber-300"/>Partenze <span className="text-sm text-zinc-500">({grouped.departures.length})</span></h2>{table(grouped.departures,'OUT')}</section></div></>;
}
