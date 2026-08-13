import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { DataTable, ErrorState, Loading, PageTitle } from '../components/Ui';
import { isTelemetryOptOut, setTelemetryEnabled } from '../services/telemetry';

type Data={lastRecalculation:string|null;rules:{name:string;formula:string}[];providerPriority:string[]};
type CompetitionKind='league'|'playoff'|'playout'|'domestic_cup'|'continental_cup'|'super_cup'|'unclassified';
type CoverageRow={season:string;competition:string;expected_matches:number|null;found_matches:number;squad_players:number;player_seasons_with_stats:number;standing_rows:number;source_records:number;status:'complete'|'partial'|'unknown';declared_in_scope:boolean;competition_kind:CompetitionKind;gap_reason:string|null};
type Coverage={generatedAt:string;lastAuditAt:string|null;definition:string;scope:{version:number;startSeason:string;endSeason:string;inclusionPolicy:string;evidence:Array<{label:string;url?:string;path?:string}>};rows:CoverageRow[]};

const sectionClass='scroll-mt-24 card p-5';
const statusLabel={complete:'Completa',partial:'Parziale',unknown:'Non valutabile'} as const;
const statusClass={complete:'text-neroverde-300',partial:'text-amber-200',unknown:'text-zinc-400'} as const;
const kindLabel:Record<CompetitionKind,string>={league:'Campionato',playoff:'Playoff',playout:'Playout',domestic_cup:'Coppa nazionale',continental_cup:'Coppa europea',super_cup:'Supercoppa',unclassified:'Da classificare'};

export default function Methodology(){
  const[data,setData]=useState<Data|null>(null);const[coverage,setCoverage]=useState<Coverage|null>(null);const[error,setError]=useState(false);
  const[telemetryEnabled,setTelemetryState]=useState(()=>!isTelemetryOptOut());
  const load=()=>{setError(false);Promise.all([api<Data>('/methodology'),api<Coverage>('/coverage')]).then(([methodology,matrix])=>{setData(methodology);setCoverage(matrix);}).catch(()=>setError(true));};
  useEffect(load,[]);
  if(error)return <ErrorState message="Non è stato possibile caricare metodologia e matrice di copertura." retry={load}/>;
  if(!data||!coverage)return <Loading/>;
  return <>
    <PageTitle title="Fonti e metodologia" subtitle="Cosa copre l’archivio, come vengono scelti e corretti i dati e come leggere ogni indicatore tecnico."/>
    <nav aria-label="Sezioni della metodologia" className="card mb-5 flex flex-wrap gap-2 p-3 text-xs font-bold">
      {[['coverage','Copertura'],['sources','Fonti'],['conflicts','Conflitti e correzioni'],['missing-data','N/D'],['detail-levels','Livelli partita'],['privacy','Privacy'],['formulas','Formule']].map(([id,label])=><a key={id} className="rounded-lg bg-zinc-950 px-3 py-2 text-zinc-300 hover:text-neroverde-300" href={`#${id}`}>{label}</a>)}
    </nav>

    <div className="grid gap-5 lg:grid-cols-2">
      <section id="coverage" className={sectionClass}>
        <h2 className="font-bold">Copertura dell’archivio</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Il perimetro dichiarato va dal <strong className="text-zinc-200">{coverage.scope.startSeason}</strong> al <strong className="text-zinc-200">{coverage.scope.endSeason}</strong>. {coverage.scope.inclusionPolicy}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">La copertura è misurata per stagione e competizione sui record realmente presenti, non stimata dal nome della stagione. {coverage.definition}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="font-bold text-neroverde-300">Completa</dt><dd className="mt-1 text-zinc-400">Soddisfa tutti i requisiti indicati.</dd></div>
          <div><dt className="font-bold text-amber-200">Parziale</dt><dd className="mt-1 text-zinc-400">Esistono dati, ma manca almeno un requisito.</dd></div>
          <div><dt className="font-bold text-zinc-300">Non valutabile</dt><dd className="mt-1 text-zinc-400">Non ci sono dati sufficienti per misurarla.</dd></div>
        </dl>
        <p className="mt-4 text-xs text-zinc-400">Ultimo audit: {coverage.lastAuditAt?new Date(coverage.lastAuditAt).toLocaleString('it-IT'):'N/D'} · matrice generata: {new Date(coverage.generatedAt).toLocaleString('it-IT')}</p>
      </section>

      <section id="sources" className={sectionClass}>
        <h2 className="font-bold">Fonti e ordine di priorità</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Il badge mostra il provider e, quando disponibile, la data dell’ultima verifica. L’icona esterna apre la pagina puntuale; la data non garantisce che tutti i campi del record abbiano la stessa fonte.</p>
        <ol className="mt-4 space-y-3">{data.providerPriority.map((item,i)=><li className="flex gap-3 text-sm" key={item}><span className="font-black text-neroverde-300">{i+1}</span><span>{item}</span></li>)}</ol>
        <p className="mt-4 text-xs leading-5 text-zinc-400">L’ordine è una regola di precedenza, non un voto assoluto: una fonte più in alto sostituisce un valore solo con identità e perimetro compatibili e con evidenza conservata.</p>
      </section>

      <section id="conflicts" className={sectionClass}>
        <h2 className="font-bold">Conflitti e correzioni manuali</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Valori incompatibili tra provider non vengono scelti in silenzio. Il conflitto resta aperto nel Data Manager finché un revisore registra decisione, motivazione ed evidenza. La risoluzione conserva entrambi i valori originali, alimenta il change log e può essere riaperta.</p>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Una correzione manuale è protetta dagli import successivi: non equivale a un dato inventato, ma a una decisione curatoriale tracciata. Le proposte non approvate non modificano il dato pubblico.</p>
        <Link className="mt-4 inline-flex text-sm font-bold text-neroverde-300 hover:underline" to="/data-manager">Apri il Data Manager →</Link>
      </section>

      <section id="missing-data" className={sectionClass}>
        <h2 className="font-bold">Come leggere N/D, zero e trattino</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div><dt className="font-bold text-white">N/D</dt><dd className="mt-1 text-zinc-400">Il dato non è disponibile, non è coperto dalla fonte o non è verificato. Non entra nei calcoli come zero.</dd></div>
          <div><dt className="font-bold text-white">0</dt><dd className="mt-1 text-zinc-400">La fonte misura il campo e ne attesta l’assenza, per esempio zero gol.</dd></div>
          <div><dt className="font-bold text-white">—</dt><dd className="mt-1 text-zinc-400">Il campo non si applica a quella riga o vista, per esempio i punti in un tabellone a eliminazione.</dd></div>
        </dl>
      </section>

      <section id="detail-levels" className={`${sectionClass} lg:col-span-2`}>
        <h2 className="font-bold">Livelli di dettaglio partita</h2>
        <dl className="mt-3 grid gap-3 text-sm lg:grid-cols-3">
          <div className="rounded-xl bg-zinc-950/50 p-4"><dt><span className="badge text-zinc-300">BASIC</span></dt><dd className="mt-2 leading-6 text-zinc-400">Identità della gara e risultato quando conclusa; i moduli avanzati possono mancare.</dd></div>
          <div className="rounded-xl bg-zinc-950/50 p-4"><dt><span className="badge text-amber-200">STANDARD</span></dt><dd className="mt-2 leading-6 text-zinc-400">Metadati aggiuntivi della gara, come turno, stadio, arbitro o stato, senza blocchi avanzati verificati.</dd></div>
          <div className="rounded-xl bg-zinc-950/50 p-4"><dt><span className="badge text-neroverde-300">DETAILED</span></dt><dd className="mt-2 leading-6 text-zinc-400">È presente almeno un blocco avanzato tra eventi, formazioni, statistiche squadra o statistiche giocatore. Il badge non implica che siano presenti tutti i blocchi.</dd></div>
        </dl>
      </section>

      <section id="privacy" className={`${sectionClass} lg:col-span-2`}>
        <h2 className="font-bold">Telemetria tecnica e privacy</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Raccogliamo in forma minimizzata soltanto eccezioni, errori di caricamento route e Web Vitals campionati. La route è normalizzata e non include ricerca o query string; token, email, stack completi, indirizzi IP e dati personali non vengono conservati. Gli eventi scadono dopo 30 giorni.</p>
        <button className="btn-secondary mt-4" onClick={()=>{setTelemetryEnabled(!telemetryEnabled);setTelemetryState(!isTelemetryOptOut());}} aria-pressed={telemetryEnabled}>{telemetryEnabled?'Disattiva telemetria tecnica':'Attiva telemetria tecnica'}</button>
        <p className="mt-2 text-xs text-zinc-400">Stato: {telemetryEnabled?'attiva':'disattivata'}. Global Privacy Control e Do Not Track hanno sempre precedenza.</p>
      </section>

      <section id="formulas" className={`${sectionClass} lg:col-span-2`}>
        <h2 className="font-bold">Formule e perimetro</h2>
        <p className="mt-1 text-xs text-zinc-400">Ultimo ricalcolo: {data.lastRecalculation?new Date(data.lastRecalculation).toLocaleString('it-IT'):'N/D'}</p>
        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">{data.rules.map(rule=><div key={rule.name}><dt className="font-bold text-neroverde-300">{rule.name}</dt><dd className="mt-1 text-sm leading-6 text-zinc-400">{rule.formula}</dd></div>)}</dl>
      </section>
    </div>

    <section className="card mt-5 p-5" aria-labelledby="coverage-matrix-title">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="coverage-matrix-title" className="font-bold">Matrice di copertura canonica</h2><p className="mt-1 max-w-4xl text-sm text-zinc-400">Ogni riga mantiene separate campionato, playoff/playout e coppe. Anche una competizione senza record resta visibile con la motivazione della lacuna.</p></div><a className="text-xs font-bold text-neroverde-300 hover:underline" href="#coverage">Come si legge ↑</a></div>
      <div className="mt-4 max-h-[34rem] overflow-auto"><DataTable label="Matrice di copertura per stagione e competizione"><table><thead><tr><th>Stagione</th><th>Ambito</th><th>Partite</th><th>Rosa</th><th>Con statistiche</th><th>Classifica</th><th>Fonti</th><th>Stato e lacuna</th></tr></thead><tbody>{coverage.rows.map(row=><tr key={`${row.season}-${row.competition}`}><td><span className="font-bold text-white">{row.season}</span><br/><span className="text-xs text-zinc-400">{row.competition}</span></td><td><span className="badge text-zinc-300">{kindLabel[row.competition_kind]}</span></td><td>{row.found_matches}/{row.expected_matches??'N/D'}</td><td>{row.squad_players}</td><td>{row.player_seasons_with_stats}</td><td>{row.standing_rows}</td><td>{row.source_records}</td><td className="min-w-64"><a aria-label={`${statusLabel[row.status]}: leggi la definizione`} className={`badge hover:border-neroverde-400/50 ${statusClass[row.status]}`} href="#coverage">{statusLabel[row.status]}</a>{row.gap_reason&&<p className="mt-2 text-xs leading-5 text-zinc-400">{row.gap_reason}</p>}{!row.declared_in_scope&&<p className="mt-1 text-xs font-bold text-red-300">Fuori dal manifesto</p>}</td></tr>)}</tbody></table></DataTable></div>
    </section>
  </>;
}
