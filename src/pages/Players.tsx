import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown,ArrowUp,ChevronsUpDown } from 'lucide-react';
import { api } from '../services/api';
import { Empty,Loading,PageTitle,fmt,SourceBadge } from '../components/Ui';
import type { Player } from '../types';

type SortKey='appearances'|'goals'|'assists'|'minutes'|'name';
type SortDirection='asc'|'desc';
const sortableColumns:ReadonlyArray<{key:Exclude<SortKey,'name'>;label:string}>=[
  {key:'appearances',label:'Pres.'},{key:'goals',label:'Gol'},
  {key:'assists',label:'Assist'},{key:'minutes',label:'Minuti'}
];

export default function Players(){
  const[d,setD]=useState<Player[]|null>(null);const[all,setAll]=useState<Player[]>([]);const[sort,setSort]=useState<SortKey>('appearances');const[direction,setDirection]=useState<SortDirection>('desc');const[position,setPosition]=useState('');const[nationality,setNationality]=useState('');const[season,setSeason]=useState('');
  const load=()=>{const q=new URLSearchParams({sort,direction});if(position)q.set('position',position);if(nationality)q.set('nationality',nationality);if(season)q.set('season',season);api<Player[]>(`/players?${q}`).then(setD);};
  useEffect(()=>{void api<Player[]>('/players?all=1&sort=name&direction=asc').then(setAll)},[]);useEffect(()=>{void load()},[sort,direction,position,nationality,season]);
  const options=useMemo(()=>({positions:[...new Set(all.map(x=>x.position).filter(Boolean) as string[])].sort(),nationalities:[...new Set(all.map(x=>x.nationality).filter(Boolean) as string[])].sort(),seasons:[...new Set(all.flatMap(x=>[] as string[]))]}),[all]);
  const changeSort=(key:SortKey)=>{if(key===sort)setDirection(value=>value==='desc'?'asc':'desc');else{setSort(key);setDirection(key==='name'?'asc':'desc');}};
  const sortableHeader=({key,label}:{key:Exclude<SortKey,'name'>;label:string})=>{
    const active=sort===key;const Icon=active?(direction==='desc'?ArrowDown:ArrowUp):ChevronsUpDown;
    return <th key={key} aria-sort={active?(direction==='desc'?'descending':'ascending'):'none'}><button type="button" className={`inline-flex items-center gap-1.5 whitespace-nowrap transition hover:text-white focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neroverde-400 ${active?'text-neroverde-400':''}`} onClick={()=>changeSort(key)} title={`Ordina per ${label}`}><span>{label}</span><Icon aria-hidden="true" className="h-3.5 w-3.5"/></button></th>;
  };
  if(!d)return <Loading/>;
  return <><PageTitle title="Giocatori" subtitle="Filtra l'archivio per ruolo, nazionalità e stagione. I campi non rilevati dalla fonte restano N/D."/>
    <div className="card mb-5 grid gap-3 p-4 md:grid-cols-4"><select className="input" value={position} onChange={e=>setPosition(e.target.value)}><option value="">Tutti i ruoli</option>{options.positions.map(x=><option key={x}>{x}</option>)}</select><select className="input" value={nationality} onChange={e=>setNationality(e.target.value)}><option value="">Tutte le nazionalità</option>{options.nationalities.map(x=><option key={x}>{x}</option>)}</select><input className="input" value={season} onChange={e=>setSeason(e.target.value)} placeholder="Stagione, es. 2012/13"/><select className="input" value={sort} onChange={e=>changeSort(e.target.value as SortKey)}><option value="appearances">Presenze</option><option value="goals">Gol</option><option value="assists">Assist</option><option value="minutes">Minuti</option><option value="name">Nome</option></select></div>
    {!d.length?<Empty text="Nessun giocatore corrisponde ai filtri selezionati."/>:<div className="table-wrap"><table><thead><tr><th>Giocatore</th><th>Ruolo</th><th>Nazionalità</th>{sortableColumns.map(sortableHeader)}<th>Identità fonte</th><th>Fonte</th></tr></thead><tbody>{d.map(p=><tr key={p.id}><td><Link className="flex items-center gap-3 font-bold text-neroverde-400 hover:underline" to={`/players/${p.id}`}>{p.photo_url&&<img src={p.photo_url} className="h-9 w-9 rounded-full bg-zinc-800 object-cover" alt=""/>}{p.name}</Link></td><td>{fmt(p.position)}</td><td>{fmt(p.nationality)}</td><td>{fmt(p.appearances)}</td><td>{fmt(p.goals)}</td><td>{fmt(p.assists)}</td><td>{fmt(p.minutes)}</td><td className="text-zinc-500">{fmt(p.source_external_id??p.api_football_id)}</td><td><SourceBadge provider={p.source_provider} url={p.source_url} verifiedAt={p.last_verified_at}/></td></tr>)}</tbody></table></div>}</>;
}
