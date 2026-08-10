import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { CompetitionBadge, Empty, Loading, PageTitle, fmt, SourceBadge } from '../components/Ui';
import type { Season } from '../types';

export default function Seasons() {
  const [data, setData] = useState<Season[] | null>(null);
  const [competition, setCompetition] = useState('');
  useEffect(() => { api<Season[]>('/seasons').then(setData); }, []);
  const groups = useMemo(() => {
    const map = new Map<string, Season[]>();
    for (const row of data ?? []) map.set(row.season, [...(map.get(row.season) ?? []), row]);
    return [...map.entries()];
  }, [data]);
  const visible = groups.filter(([, rows]) => !competition || rows.some(row => row.competition === competition));
  const competitions = [...new Set((data ?? []).map(row => row.competition))].sort();
  if (!data) return <Loading />;
  return <>
    <PageTitle title="Stagioni" subtitle="Una stagione contiene tutte le competizioni disputate; le statistiche restano separate per competizione." />
    <div className="card mb-5 flex flex-wrap items-center gap-2 p-3">
      <span className="mr-1 text-sm text-zinc-500">Filtra:</span>
      <button className={competition ? 'btn-secondary' : 'btn-primary'} onClick={() => setCompetition('')}>Tutte</button>
      {competitions.map(item => <button key={item} className={competition === item ? 'btn-primary' : 'btn-secondary'} onClick={() => setCompetition(item)}><CompetitionBadge competition={item} /></button>)}
    </div>
    {!visible.length ? <Empty text="Nessuna stagione corrisponde al filtro selezionato." /> : <div className="space-y-4">
      {visible.map(([season, rows]) => <section className="card overflow-hidden" key={season}>
        <div className="flex flex-col gap-2 border-b border-zinc-800 bg-zinc-950/40 p-4 md:flex-row md:items-center md:justify-between">
          <Link className="text-xl font-black text-white hover:text-neroverde-400" to={`/seasons/${encodeURIComponent(season)}`}>{season}</Link>
          <div className="flex flex-wrap gap-2">{rows.map(row => <Link key={row.id} to={`/seasons/${encodeURIComponent(season)}?competition=${encodeURIComponent(row.competition)}`}><CompetitionBadge competition={row.competition} /></Link>)}</div>
        </div>
        <div className="table-wrap rounded-none border-0"><table><thead><tr><th>Competizione</th><th>Partite</th><th>Pos.</th><th>V-N-P</th><th>GF-GS</th><th>Punti</th><th>Capocannoniere</th><th>Fonte</th></tr></thead><tbody>
          {rows.filter(row => !competition || row.competition === competition).map(row => <tr key={row.id}>
            <td><Link className="font-bold text-neroverde-400 hover:underline" to={`/seasons/${encodeURIComponent(season)}?competition=${encodeURIComponent(row.competition)}`}>{row.competition}</Link></td>
            <td>{fmt(row.matches)}</td><td>{row.competition==='Coppa Italia'?fmt(row.cup_exit):fmt(row.final_position)}</td>
            <td>{row.wins == null ? 'N/D' : `${row.wins}-${row.draws ?? 0}-${row.losses ?? 0}`}</td>
            <td>{row.goals_for == null ? 'N/D' : `${row.goals_for}-${row.goals_against ?? 0}`}</td><td>{row.competition==='Coppa Italia'?'—':fmt(row.points)}</td>
            <td>{row.competition==='Coppa Italia'&&row.top_scorer_goals===0?'Nessun marcatore':row.top_scorer_player_id?<Link className="text-neroverde-400 hover:underline" to={`/players/${row.top_scorer_player_id}`}>{row.top_scorer_player_name} ({row.top_scorer_goals})</Link>:row.top_scorer?`${row.top_scorer} (${fmt(row.top_scorer_goals)})`:'N/D'}</td>
            <td><SourceBadge provider={row.source_provider} url={row.source_url} verifiedAt={row.last_verified_at} /></td>
          </tr>)}
        </tbody></table></div>
      </section>)}
    </div>}
  </>;
}
