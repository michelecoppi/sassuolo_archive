import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Empty,Loading,PageTitle,fmt,SourceBadge } from '../components/Ui';
import type { Player } from '../types';

export default function Players(){
  const[d,setD]=useState<Player[]|null>(null);const[all,setAll]=useState<Player[]>([]);const[sort,setSort]=useState('appearances');const[position,setPosition]=useState('');const[nationality,setNationality]=useState('');const[season,setSeason]=useState('');
  const load=()=>{const q=new URLSearchParams({sort});if(position)q.set('position',position);if(nationality)q.set('nationality',nationality);if(season)q.set('season',season);api<Player[]>(`/players?${q}`).then(setD);};
  useEffect(()=>{void api<Player[]>('/players?all=1&sort=name').then(setAll)},[]);useEffect(()=>{void load()},[sort,position,nationality,season]);
  const options=useMemo(()=>({positions:[...new Set(all.map(x=>x.position).filter(Boolean) as string[])].sort(),nationalities:[...new Set(all.map(x=>x.nationality).filter(Boolean) as string[])].sort(),seasons:[...new Set(all.flatMap(x=>[] as string[]))]}),[all]);
  if(!d)return <Loading/>;
  return <><PageTitle title="Giocatori" subtitle="Filtra l'archivio per ruolo, nazionalità e stagione. I campi non rilevati dalla fonte restano N/D."/>
    <div className="card mb-5 grid gap-3 p-4 md:grid-cols-4"><select className="input" value={position} onChange={e=>setPosition(e.target.value)}><option value="">Tutti i ruoli</option>{options.positions.map(x=><option key={x}>{x}</option>)}</select><select className="input" value={nationality} onChange={e=>setNationality(e.target.value)}><option value="">Tutte le nazionalità</option>{options.nationalities.map(x=><option key={x}>{x}</option>)}</select><input className="input" value={season} onChange={e=>setSeason(e.target.value)} placeholder="Stagione, es. 2012/13"/><select className="input" value={sort} onChange={e=>setSort(e.target.value)}><option value="appearances">Presenze</option><option value="goals">Gol</option><option value="assists">Assist</option><option value="minutes">Minuti</option><option value="name">Nome</option></select></div>
    {!d.length?<Empty text="Nessun giocatore corrisponde ai filtri selezionati."/>:<div className="table-wrap"><table><thead><tr><th>Giocatore</th><th>Ruolo</th><th>Nazionalità</th><th>Pres.</th><th>Gol</th><th>Assist</th><th>Minuti</th><th>Identità fonte</th><th>Fonte</th></tr></thead><tbody>{d.map(p=><tr key={p.id}><td><Link className="flex items-center gap-3 font-bold text-neroverde-400 hover:underline" to={`/players/${p.id}`}>{p.photo_url&&<img src={p.photo_url} className="h-9 w-9 rounded-full bg-zinc-800 object-cover" alt=""/>}{p.name}</Link></td><td>{fmt(p.position)}</td><td>{fmt(p.nationality)}</td><td>{fmt(p.appearances)}</td><td>{fmt(p.goals)}</td><td>{fmt(p.assists)}</td><td>{fmt(p.minutes)}</td><td className="text-zinc-500">{fmt(p.source_external_id??p.api_football_id)}</td><td><SourceBadge provider={p.source_provider} url={p.source_url} verifiedAt={p.last_verified_at}/></td></tr>)}</tbody></table></div>}</>;
}
