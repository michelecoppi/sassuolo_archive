import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { Match } from '../types';
import { CompetitionBadge, CompletenessBadge, DataTable, Score, SourceBadge } from './Ui';

export function MatchCard({match:m}:{match:Match}){return <Link to={`/matches/${m.id}`} className="card block p-4 transition hover:border-neroverde-400/40"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><CompetitionBadge competition={m.competition}/>{Boolean(m.has_special_events)&&<span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-300"><AlertTriangle className="h-3 w-3"/>Evento particolare</span>}</div><span className="text-xs text-zinc-400">{new Date(m.date).toLocaleDateString('it-IT')}</span></div><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate font-bold text-white">{m.home_team}</span><Score home={m.home_score} away={m.away_score}/><span className="min-w-0 truncate text-right font-bold text-white">{m.away_team}</span></div></Link>}
export default function MatchTable({matches}:{matches:Match[]}){
  return <DataTable label="Storico partite"><table><thead><tr><th>Data</th><th>Stagione</th><th>Competizione</th><th>Partita</th><th>Risultato</th><th>Copertura</th><th>Fonte</th><th></th></tr></thead><tbody>{matches.map(m=><tr key={m.id}>
    <td>{new Date(m.date).toLocaleDateString('it-IT')}</td>
    <td>{m.season||'N/D'}</td>
    <td><CompetitionBadge competition={m.competition}/></td>
    <td><Link className="font-semibold text-white hover:text-neroverde-400" to={`/matches/${m.id}`}><span>{m.home_team}</span><span className="mx-2 text-zinc-400">vs</span><span>{m.away_team}</span></Link>{Boolean(m.has_special_events)&&<div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300"><AlertTriangle className="h-3 w-3"/>Evento particolare</div>}</td>
    <td><Score home={m.home_score} away={m.away_score}/></td>
    <td><CompletenessBadge level={m.completeness_level}/></td>
    <td><SourceBadge provider={m.source_provider} url={m.source_url} verifiedAt={m.last_verified_at}/></td>
    <td><Link className="text-xs font-semibold text-neroverde-400 hover:text-neroverde-300" to={`/matches/${m.id}`}>Dettagli →</Link></td>
  </tr>)}</tbody></table></DataTable>
}
