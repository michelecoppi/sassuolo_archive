import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api,post } from '../services/api';
import { Empty,Loading,PageTitle,fmt } from '../components/Ui';
import type { Player } from '../types';

type Row=Player&{season_appearances:number|null;season_starts:number|null;season_minutes:number|null;season_goals:number|null;season_assists:number|null;season_rating:number|null};
type D={season:string|null;competition?:string|null;players:Row[]};
const order=['Goalkeeper','Defender','Midfielder','Attacker'];
const normalizePosition=(value:string|null|undefined)=>{const key=(value??'').trim().toLowerCase();return ({g:'Goalkeeper',gk:'Goalkeeper',goalkeeper:'Goalkeeper','goal keeper':'Goalkeeper',keeper:'Goalkeeper',d:'Defender',defender:'Defender',defence:'Defender',defense:'Defender',m:'Midfielder',midfielder:'Midfielder',midfield:'Midfielder',f:'Attacker',fw:'Attacker',forward:'Attacker',attacker:'Attacker',striker:'Attacker'} as Record<string,string>)[key]??value??'Altro';};

export default function CurrentSquad(){
  const[d,setD]=useState<D|null>(null);const[busy,setBusy]=useState(false);
  const load=()=>api<D>('/squad/current').then(setD);
  useEffect(()=>{void load()},[]);
  const update=async()=>{setBusy(true);try{await post('/api-football/current');await load();}finally{setBusy(false)}};
  const groups=useMemo(()=>{const map=new Map<string,Row[]>();for(const player of d?.players??[]){const key=normalizePosition(player.position);map.set(key,[...(map.get(key)??[]),player]);}return [...map.entries()].sort((a,b)=>(order.indexOf(a[0])<0?99:order.indexOf(a[0]))-(order.indexOf(b[0])<0?99:order.indexOf(b[0])));},[d]);
  if(!d)return <Loading/>;
  return <><PageTitle title="Rosa attuale" subtitle={`Ruoli normalizzati in Portieri, Difensori, Centrocampisti e Attaccanti${d.season?` · statistiche ${d.season} ${d.competition??''}`:''}.`} action={<button className="btn-primary" disabled={busy} onClick={update}><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>Aggiorna rosa + stats</button>}/>
    {!d.players.length?<Empty text="Nessuna rosa corrente memorizzata. Configura API_FOOTBALL_KEY e premi Aggiorna rosa + stats."/>:<div className="space-y-6">{groups.map(([position,rows])=><section key={position}><h2 className="mb-3 text-lg font-bold">{position}</h2><div className="table-wrap"><table><thead><tr><th>#</th><th>Giocatore</th><th>Nazionalità</th><th>Pres.</th><th>Tit.</th><th>Min.</th><th>Gol</th><th>Assist</th><th>Rating</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td>{fmt(p.shirt_number)}</td><td><Link className="flex items-center gap-3 font-bold text-neroverde-400 hover:underline" to={`/players/${p.id}`}>{p.photo_url&&<img src={p.photo_url} className="h-10 w-10 rounded-full bg-zinc-800 object-cover" alt=""/>}{p.name}</Link></td><td>{fmt(p.nationality)}</td><td>{fmt(p.season_appearances)}</td><td>{fmt(p.season_starts)}</td><td>{fmt(p.season_minutes)}</td><td>{fmt(p.season_goals)}</td><td>{fmt(p.season_assists)}</td><td>{p.season_rating==null?'N/D':Number(p.season_rating).toFixed(2)}</td></tr>)}</tbody></table></div></section>)}</div>}
  </>;
}
