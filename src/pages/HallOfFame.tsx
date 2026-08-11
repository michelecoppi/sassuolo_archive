import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompetitionBadge, Empty, Loading, PageTitle, fmt } from '../components/Ui';
import { CalculationContext, MetricMethod, type StatisticDefinition } from '../components/CalculationDisclosure';
import { api } from '../services/api';

type Row = { id?: number; player_id?: number; name: string; photo_url?: string | null; position?: string | null; appearances?: number | null; goals?: number | null; own_goals?: number | null; assists?: number | null; minutes?: number | null; clean_sheets?: number | null; yellow_cards?: number | null; red_cards?: number | null; fouls_committed?: number | null; season?: string | null; competition?: string | null };
type Rankings = { appearances: Row[]; goals: Row[]; own_goals: Row[]; assists: Row[]; minutes: Row[]; clean_sheets: Row[] };
type NegativeRankings = { own_goals: Row[]; yellow_cards: Row[]; red_cards: Row[]; fouls_committed: Row[] };
type Meta={lastRecalculation:string|null;filters:{competition:string|null;season:string|null;position:string|null;minimums:Record<string,number|null>};coverage:{playerSeasonRows:number;players:number;seasons:number;competitions:number;lastVerifiedAt:string|null};aggregation:string;rankingLimit:number;competitions:string[];definitions:StatisticDefinition[]};
type Data = Rankings & { negative?: NegativeRankings; teamOwnGoals?: { season: string; competition: string; own_goals_for: number | null; own_goals_against: number | null }[]; byCompetition?: Record<string, Rankings>; meta:Meta };

function Ranking({ title, rows, field, definition }: { title: string; rows: Row[]; field: keyof Row; definition?:StatisticDefinition }) {
  return <div className="card p-5"><h2 className="font-bold">{title}</h2><MetricMethod definition={definition}/><div className="mt-4">{rows.length ? <div className="space-y-2">{rows.slice(0, 10).map((row, index) => { const id = row.player_id ?? row.id; return <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${index < 3 ? 'border-neroverde-500/30 bg-neroverde-500/5' : 'border-zinc-800 bg-zinc-950/50'}`} key={`${row.name}-${row.season ?? ''}-${index}`}><div className="flex min-w-0 items-center gap-3"><span className="w-6 text-sm font-black text-zinc-500">#{index + 1}</span>{row.photo_url && <img className="h-9 w-9 rounded-full object-cover" src={row.photo_url} alt="" /> }<div className="min-w-0">{id ? <Link className="truncate font-semibold text-neroverde-400 hover:underline" to={`/players/${id}`}>{row.name}</Link> : <span className="font-semibold">{row.name}</span>}<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">{row.position || 'Ruolo N/D'}{row.season && <span>· {row.season}</span>}{row.competition && <CompetitionBadge competition={row.competition} />}</div></div></div><span className="font-black tabular-nums">{fmt(row[field])}</span></div>; })}</div> : <Empty text="N/D — nessuna statistica verificata per i filtri selezionati." />}</div></div>;
}

const competitions = ['', 'Serie A', 'Serie B', 'Serie C', 'Europa League', 'Coppa Italia'];
const positions = ['', 'Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

export default function HallOfFame() {
  const [data, setData] = useState<Data | null>(null);
  const [competition, setCompetition] = useState('Serie A');
  const [season, setSeason] = useState('');
  const [position, setPosition] = useState('');
  const [minimums, setMinimums] = useState({ minAppearances: '', minGoals: '', minAssists: '', minMinutes: '', minCleanSheets: '' });
  const load = () => { const query = new URLSearchParams(); if (competition) query.set('competition', competition); if (season) query.set('season', season); if (position) query.set('position', position); Object.entries(minimums).forEach(([key, value]) => { if (value) query.set(key, value); }); api<Data>(`/hall-of-fame?${query}`).then(setData); };
  useEffect(() => { void load(); }, [competition, season, position, minimums]);
  if (!data) return <Loading />;
  const negative = data.negative;
  const definition=Object.fromEntries(data.meta.definitions.map(item=>[item.key,item]));
  const activeMinimums=Object.entries(data.meta.filters.minimums).filter(([,value])=>value!=null).map(([key,value])=>`${key} ≥ ${value}`).join(', ')||'nessuna soglia aggiuntiva';
  const perimeter=[competition||'tutte le competizioni',season||'tutte le stagioni',position||'tutti i ruoli'].join(' · ');
  return <><PageTitle title="Hall of Fame" subtitle="Classifiche calcolate dal database locale. N/D significa dato non disponibile, non zero." />
    <div className="card mb-5 grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
      <select className="input" value={competition} onChange={event => setCompetition(event.target.value)} aria-label="Competizione"><option value="">Tutte le competizioni</option>{competitions.slice(1).map(item => <option key={item}>{item}</option>)}</select>
      <input className="input" value={season} onChange={event => setSeason(event.target.value)} placeholder="Stagione, es. 2022/23" aria-label="Stagione" />
      <select className="input" value={position} onChange={event => setPosition(event.target.value)} aria-label="Ruolo"><option value="">Tutti i ruoli</option>{positions.slice(1).map(item => <option key={item}>{item}</option>)}</select>
      {([['minAppearances', 'Min. presenze'], ['minGoals', 'Min. gol'], ['minAssists', 'Min. assist'], ['minMinutes', 'Min. minuti'], ['minCleanSheets', 'Min. clean sheet']] as const).map(([key, label]) => <input key={key} className="input" type="number" min="0" value={minimums[key]} onChange={event => setMinimums(value => ({ ...value, [key]: event.target.value }))} placeholder={label} aria-label={label} />)}
    </div>
    <div className="mb-4 flex flex-wrap gap-2">{competitions.map(item => <button key={item || 'all'} className={competition === item ? 'btn-primary' : 'btn-secondary'} onClick={() => setCompetition(item)}>{item ? <CompetitionBadge competition={item} /> : 'Tutte'}</button>)}</div>
    <CalculationContext lastRecalculation={data.meta.lastRecalculation} perimeter={`${perimeter}. ${data.meta.aggregation} Soglie: ${activeMinimums}.`} items={[{label:'Righe PlayerSeason',value:data.meta.coverage.playerSeasonRows},{label:'Giocatori',value:data.meta.coverage.players},{label:'Stagioni',value:data.meta.coverage.seasons},{label:'Competizioni',value:data.meta.coverage.competitions}]}/>
    <div className="grid gap-4 lg:grid-cols-2"><Ranking title="Più presenze" rows={data.appearances} field="appearances" definition={definition.appearances}/><Ranking title="Più gol" rows={data.goals} field="goals" definition={definition.goals}/><Ranking title="Più assist" rows={data.assists} field="assists" definition={definition.assists}/><Ranking title="Più minuti" rows={data.minutes} field="minutes" definition={definition.minutes}/><Ranking title="Più clean sheet" rows={data.clean_sheets} field="clean_sheets" definition={definition.clean_sheets}/></div>
    <section className="mt-6"><h2 className="mb-3 text-xl font-black text-amber-200">Statistiche negative</h2><p className="mb-4 text-sm text-zinc-500">Leader per autogol, cartellini gialli, cartellini rossi e falli commessi.</p><div className="grid gap-4 lg:grid-cols-2"><Ranking title="Più autogol" rows={negative?.own_goals ?? data.own_goals} field="own_goals" definition={definition.own_goals}/><Ranking title="Più cartellini gialli" rows={negative?.yellow_cards ?? []} field="yellow_cards" definition={definition.yellow_cards}/><Ranking title="Più cartellini rossi" rows={negative?.red_cards ?? []} field="red_cards" definition={definition.red_cards}/><Ranking title="Più falli commessi" rows={negative?.fouls_committed ?? []} field="fouls_committed" definition={definition.fouls_committed}/></div></section>
    {!!data.teamOwnGoals?.length && <section className="mt-6 card p-5"><h2 className="font-bold">Autogol a favore / contro</h2><MetricMethod definition={definition.teamOwnGoals}/><div className="mt-4 table-wrap"><table><thead><tr><th>Stagione</th><th>Competizione</th><th>A favore</th><th>Contro</th></tr></thead><tbody>{data.teamOwnGoals.map(row => <tr key={`${row.season}-${row.competition}`}><td>{row.season}</td><td>{row.competition}</td><td>{fmt(row.own_goals_for)}</td><td>{fmt(row.own_goals_against)}</td></tr>)}</tbody></table></div></section>}
  </>;
}
