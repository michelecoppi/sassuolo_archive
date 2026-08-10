import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Clock3, Edit3, MapPin, RefreshCw, Shield, Users } from 'lucide-react';
import { api, post } from '../services/api';
import { Empty, Loading, PageTitle, Score, fmt } from '../components/Ui';
import MatchQuickEditor from '../components/MatchQuickEditor';
import type { Match } from '../types';

type EventRow = {
  id:number; minute:number|null; extra_minute:number|null; team_provider_id?:string|null; team_name:string|null;
  player_id:number|null; player_provider_id?:string|null; player_name:string|null; assist_player_id:number|null; assist_name:string|null;
  type:string|null; detail:string|null; comments:string|null; source_url?:string|null; verification_note?:string|null; verified_by?:string|null; last_verified_at?:string|null; home_score?:number|null; away_score?:number|null;
};
type LineupPlayer = { player?:{ id?:string|number|null; localPlayerId?:number|null; name?:string; number?:number|null; pos?:string|null; grid?:string|null } };
type Lineup = { id:number; provider_team_id?:string|null; team_name:string|null; team_logo:string|null; formation:string|null; coach_name:string|null; startXI:LineupPlayer[]; substitutes:LineupPlayer[] };
type TeamStat = { type:string; value:any; label?:string|null };
type TeamStats = { id:number; provider_team_id?:string|null; team_name:string|null; team_logo:string|null; statistics:TeamStat[] };
type PlayerStat = {
  id:number; provider_team_id?:string|null; team_name:string|null; team_logo:string|null; player_id:number|null; linked_player_id:number|null; provider_player_id?:string|null;
  player_name:string; player_photo:string|null; minutes:number|null; shirt_number:number|null; position:string|null; rating:number|null; captain:number|null; substitute:number|null;
  offsides:number|null; shots_total:number|null; shots_on:number|null; goals:number|null; goals_conceded:number|null; assists:number|null; saves:number|null;
  passes_total:number|null; passes_key:number|null; pass_accuracy:number|null; tackles_total:number|null; blocks:number|null; interceptions:number|null; duels_total:number|null; duels_won:number|null;
  dribbles_attempts:number|null; dribbles_success:number|null; dribbles_past?:number|null; fouls_drawn?:number|null; fouls_committed?:number|null; penalty_won?:number|null; penalty_committed?:number|null; penalty_scored?:number|null; penalty_missed?:number|null; penalty_saved?:number|null; yellow_cards:number|null; red_cards:number|null;
};
type Details = {
  source_provider?:string|null; provider_match_id?:string|null; status_long?:string|null; status_short?:string|null; elapsed?:number|null;
  venue_name?:string|null; venue_city?:string|null; league_name?:string|null; league_round?:string|null;
  home_team_logo?:string|null; away_team_logo?:string|null;
};
type Injury = { id:number; team_name:string|null; player_id:number|null; linked_player_id:number|null; player_name:string; type:string|null; reason:string|null; start_date:string|null; end_date:string|null };
type Payload = { match:Match; details:Details|null; events:EventRow[]; lineups:Lineup[]; teamStats:TeamStats[]; playerStats:PlayerStat[]; injuries:Injury[] };

const statLabel=(v:string)=>v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const displayValue=(v:any)=>v==null||v===''?'N/D':String(v);
function eventGlyph(type:string|null,detail:string|null){
  const t=`${type??''} ${detail??''}`.toLowerCase();
  if(t.includes('goal'))return t.includes('miss')?'❌':'⚽';
  if(t.includes('red')&&t.includes('card'))return '🟥';
  if(t.includes('yellow')||t.includes('card'))return '🟨';
  if(t.includes('sub'))return '🔄';
  if(t.includes('var'))return '📺';
  return '•';
}
function minuteLabel(e:EventRow){if(e.minute==null)return '—';return e.extra_minute?`${e.minute}+${e.extra_minute}'`:`${e.minute}'`;}

export default function MatchDetail(){
  const {id}=useParams();
  const [data,setData]=useState<Payload|null>(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [showQuickEditor, setShowQuickEditor] = useState(false);
  const load=()=>api<Payload>(`/matches/${id}`).then(setData);
  useEffect(()=>{void load()},[id]);

  const sync=async()=>{
    setBusy(true);setMsg('');
    try{
      const r=await post<any>(`/kickoff/match/${id}`);
      const result=r.result??r;
      const notices=[...(result?.errors??[]),...(result?.warnings??[])];
      setMsg(notices.length?`Aggiornato con avvisi: ${notices.join(' | ')}`:`Dettagli KickoffAPI aggiornati · ${result.requests??0} richieste API`);
      await load();
    }catch(e){setMsg(String(e));}finally{setBusy(false);}
  };

  const groupedPlayers=useMemo(()=>{
    const map=new Map<string,PlayerStat[]>();
    for(const p of data?.playerStats??[]){const key=p.provider_team_id??p.team_name??'team';const arr=map.get(String(key))??[];arr.push(p);map.set(String(key),arr);}
    return [...map.entries()];
  },[data]);

  const statRows=useMemo(()=>{
    if(!data?.teamStats?.length)return [];
    const keys:string[]=[];
    for(const block of data.teamStats)for(const s of block.statistics??[])if(!keys.includes(s.type))keys.push(s.type);
    return keys.map(type=>({type,values:data.teamStats.map(b=>b.statistics.find(s=>s.type===type)?.value??null)}));
  },[data]);

  if(!data)return <Loading/>;
  const m=data.match,d=data.details;
  return <>{showQuickEditor && <MatchQuickEditor match={m} onClose={() => setShowQuickEditor(false)} onRefresh={load} />}
    <div className="mb-4 flex flex-wrap gap-2 text-xs text-zinc-500"><Link to="/matches" className="hover:text-neroverde-300">Partite</Link><span>/</span>{m.season&&<><Link to={`/seasons/${encodeURIComponent(m.season)}`} className="hover:text-neroverde-300">{m.season}</Link><span>/</span></>}<span>{m.home_team} – {m.away_team}</span></div>
    <div className="mb-4"><Link className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white" to="/matches"><ArrowLeft className="h-4 w-4"/>Torna alle partite</Link></div>
    <PageTitle
      title={`${m.home_team} vs ${m.away_team}`}
      subtitle={`${m.competition??'Competizione N/D'} · ${m.season??'Stagione N/D'} · ${d?.league_round??m.round??'Giornata N/D'}${d?.source_provider?` · ${d.source_provider}`:''}`}
      action={<div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setShowQuickEditor(true)}><Edit3 className="h-4 w-4"/>Modifica Rapida</button><Link className="btn-secondary" to={`/data-manager/manual?entity=match-events&matchId=${id}`}><Edit3 className="h-4 w-4"/>Modifica eventi</Link><button className="btn-secondary" disabled={busy} onClick={sync}><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>{busy?'Aggiornamento…':'Aggiorna dettagli KickoffAPI'}</button></div>}
    />
    <div className="mb-4 flex flex-wrap items-center gap-3"><span className={`badge ${m.completeness_level==='DETAILED'?'text-neroverde-300':m.completeness_level==='STANDARD'?'text-amber-200':'text-zinc-400'}`}>Copertura: {m.completeness_level||'BASIC'}</span>{m.source_url?<a className="text-xs text-neroverde-400 hover:underline" href={m.source_url} target="_blank" rel="noreferrer">Apri fonte {m.source_provider||'esterna'}</a>:m.source_provider&&<span className="text-xs text-zinc-500">Fonte: {m.source_provider}</span>}</div>
    {msg&&<div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">{msg}</div>}

    <section className="card mb-5 overflow-hidden p-5 md:p-7">
      <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col items-center gap-3 text-center md:items-end md:text-right">{d?.home_team_logo&&<img className="h-16 w-16 object-contain" src={d.home_team_logo} alt=""/>}<div className="text-xl font-black">{m.home_team}</div></div>
        <div className="text-center"><div className="text-4xl font-black"><Score home={m.home_score} away={m.away_score}/></div><div className="mt-2 text-xs uppercase tracking-wider text-zinc-500">{d?.status_long??d?.status_short??'Stato N/D'}</div>{m.halftime_score&&<div className="mt-1 text-xs text-zinc-500">Intervallo {m.halftime_score}</div>}</div>
        <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">{d?.away_team_logo&&<img className="h-16 w-16 object-contain" src={d.away_team_logo} alt=""/>}<div className="text-xl font-black">{m.away_team}</div></div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-zinc-800 pt-5 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4"/>{new Date(m.date).toLocaleString('it-IT')}</span>
        <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4"/>{d?.venue_name??m.stadium??'Stadio N/D'}{d?.venue_city?` · ${d.venue_city}`:''}</span>
        <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4"/>Arbitro: {m.referee??'N/D'}</span>
      </div>
    </section>

    <section className="card mb-5 p-5"><div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-neroverde-400"/><h2 className="text-lg font-bold">Eventi della partita</h2></div>{data.events.length?<div className="space-y-2">{data.events.map(e=><div key={e.id} className="grid grid-cols-[58px_34px_1fr] items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><div className="font-black tabular-nums text-zinc-300">{minuteLabel(e)}</div><div className="text-xl">{eventGlyph(e.type,e.detail)}</div><div><div className="font-semibold text-white">{e.player_id?<Link className="hover:text-neroverde-400" to={`/players/${e.player_id}`}>{e.player_name??'N/D'}</Link>:e.player_name??e.team_name??'Evento'}</div><div className="mt-0.5 text-xs text-zinc-400">{e.detail??e.type??'N/D'}{e.assist_name?(String(e.type??'').toLowerCase().includes('sub')?<> · Entra: {e.assist_player_id?<Link className="text-zinc-200 hover:text-neroverde-400" to={`/players/${e.assist_player_id}`}>{e.assist_name}</Link>:e.assist_name}</>:<> · Assist: {e.assist_player_id?<Link className="text-zinc-200 hover:text-neroverde-400" to={`/players/${e.assist_player_id}`}>{e.assist_name}</Link>:e.assist_name}</>):null}{e.home_score!=null&&e.away_score!=null?` · ${e.home_score}-${e.away_score}`:''}{e.comments?` · ${e.comments}`:''}</div></div></div>)}</div>:<Empty title="Eventi non disponibili" text="Sincronizza i dettagli KickoffAPI. Alcuni match possono avere copertura parziale."/>}</section>

    <section className="card mb-5 p-5"><h2 className="mb-4 text-lg font-bold">Statistiche squadra</h2>{data.teamStats.length&&statRows.length?<div className="table-wrap"><table><thead><tr><th>Statistica</th>{data.teamStats.map(t=><th key={t.id} className="text-center">{t.team_name}</th>)}</tr></thead><tbody>{statRows.map(r=><tr key={r.type}><td>{statLabel(r.type)}</td>{r.values.map((v,i)=><td key={i} className="text-center font-semibold tabular-nums">{displayValue(v)}</td>)}</tr>)}</tbody></table></div>:<Empty title="Statistiche non disponibili"/>}</section>

    <section className="mb-5"><div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-neroverde-400"/><h2 className="text-lg font-bold">Formazioni</h2></div>{data.lineups.length?<div className="grid gap-4 xl:grid-cols-2">{data.lineups.map(l=><div className="card p-5" key={l.id}><div className="mb-4 flex items-center gap-3">{l.team_logo&&<img className="h-9 w-9 object-contain" src={l.team_logo} alt=""/>}<div><div className="font-black">{l.team_name}</div><div className="text-xs text-zinc-500">{l.formation??'Modulo N/D'} · Allenatore {l.coach_name??'N/D'}</div></div></div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Titolari</div><div className="grid gap-2 sm:grid-cols-2">{l.startXI.map((x,i)=><div key={`${x.player?.id??i}`} className="rounded-lg bg-zinc-950 px-3 py-2 text-sm"><span className="mr-2 text-zinc-500">{x.player?.number??'—'}</span>{x.player?.localPlayerId?<Link className="font-semibold text-white hover:text-neroverde-400" title="Apri profilo giocatore" to={`/players/${x.player.localPlayerId}`}>{x.player?.name??'N/D'}</Link>:<span>{x.player?.name??'N/D'}</span>} <span className="ml-1 text-xs text-zinc-600">{x.player?.pos??''}</span></div>)}</div><div className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Panchina</div><div className="grid gap-2 sm:grid-cols-2">{l.substitutes.map((x,i)=><div key={`${x.player?.id??i}`} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"><span className="mr-2 text-zinc-600">{x.player?.number??'—'}</span>{x.player?.localPlayerId?<Link className="font-semibold text-zinc-200 hover:text-neroverde-400" title="Apri profilo giocatore" to={`/players/${x.player.localPlayerId}`}>{x.player?.name??'N/D'}</Link>:<span>{x.player?.name??'N/D'}</span>}</div>)}</div></div>)}</div>:<Empty title="Formazioni non disponibili" text="KickoffAPI può avere copertura parziale su alcuni match; l'app non inventa i dati mancanti."/>}</section>

    <section className="card mb-5 p-5"><h2 className="mb-4 text-lg font-bold">Indisponibili / infortuni</h2>{data.injuries?.length?<div className="grid gap-2 md:grid-cols-2">{data.injuries.map(i=><div key={i.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><div className="font-semibold">{i.player_id?<Link className="hover:text-neroverde-400" to={`/players/${i.player_id}`}>{i.player_name}</Link>:i.player_name}</div><div className="mt-1 text-xs text-zinc-400">{i.team_name??'Squadra N/D'} · {i.type??i.reason??'Indisponibile'}{i.reason&&i.type?` · ${i.reason}`:''}</div></div>)}</div>:<Empty title="Nessuna indisponibilità disponibile per questa fixture"/>}</section>

    <section><h2 className="mb-4 text-lg font-bold">Statistiche giocatori</h2>{groupedPlayers.length?<div className="space-y-5">{groupedPlayers.map(([team,players])=><div className="card p-5" key={team}><div className="mb-4 flex items-center gap-3">{players[0]?.team_logo&&<img className="h-8 w-8 object-contain" src={players[0].team_logo} alt=""/>}<h3 className="font-black">{players[0]?.team_name??'Squadra'}</h3></div><div className="table-wrap"><table><thead><tr><th>Giocatore</th><th>Min</th><th>Rating</th><th>G</th><th>A</th><th>Tiri tot/SOP</th><th>Passaggi tot/precisi</th><th>Key pass</th><th>Tackle</th><th>Intercetti</th><th>Blocchi</th><th>Duelli vinti/tot</th><th>Dribbling ok/tot</th><th>Falli subiti/fatti</th><th>Offside</th><th>Parate</th><th>Rigori S/M/P</th><th>Cartellini</th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td><div className="flex items-center gap-2">{p.player_photo&&<img className="h-8 w-8 rounded-full object-cover" src={p.player_photo} alt=""/>}<div>{p.player_id?<Link className="font-semibold text-white hover:text-neroverde-400" to={`/players/${p.player_id}`}>{p.player_name}</Link>:<span className="font-semibold">{p.player_name}</span>}<div className="text-xs text-zinc-600">{p.position??'N/D'}{p.captain?' · C':''}</div></div></div></td><td>{fmt(p.minutes)}</td><td className="font-bold">{p.rating==null?'N/D':Number(p.rating).toFixed(1)}</td><td>{fmt(p.goals)}</td><td>{fmt(p.assists)}</td><td>{fmt(p.shots_total)} / {fmt(p.shots_on)}</td><td>{fmt(p.passes_total)} / {fmt(p.pass_accuracy)}</td><td>{fmt(p.passes_key)}</td><td>{fmt(p.tackles_total)}</td><td>{fmt(p.interceptions)}</td><td>{fmt(p.blocks)}</td><td>{fmt(p.duels_won)} / {fmt(p.duels_total)}</td><td>{fmt(p.dribbles_success)} / {fmt(p.dribbles_attempts)}</td><td>{fmt(p.fouls_drawn)} / {fmt(p.fouls_committed)}</td><td>{fmt(p.offsides)}</td><td>{fmt(p.saves)}</td><td>{fmt(p.penalty_scored)} / {fmt(p.penalty_missed)} / {fmt(p.penalty_saved)}</td><td>{p.yellow_cards?`🟨 ${p.yellow_cards}`:''}{p.red_cards?` 🟥 ${p.red_cards}`:''}{!p.yellow_cards&&!p.red_cards?'—':''}</td></tr>)}</tbody></table></div></div>)}</div>:<Empty title="Statistiche giocatori non disponibili"/>}</section>
  </>;
}
