import { Link } from 'react-router-dom';

export type StatisticDefinition={key:string;label:string;formula:string;tieBreak:string;minimum:string};

export function MetricMethod({definition}:{definition?:StatisticDefinition}){
  if(!definition)return null;
  return <details className="mt-3 border-t border-zinc-800 pt-3 text-xs"><summary className="cursor-pointer font-bold text-neroverde-300">Come è calcolato</summary><dl className="mt-2 space-y-2 text-zinc-400"><div><dt className="font-semibold text-zinc-300">Formula</dt><dd>{definition.formula}</dd></div><div><dt className="font-semibold text-zinc-300">Spareggio</dt><dd>{definition.tieBreak}</dd></div><div><dt className="font-semibold text-zinc-300">Soglia</dt><dd>{definition.minimum}</dd></div></dl></details>;
}

export function CalculationContext({lastRecalculation,perimeter,items}:{lastRecalculation:string|null;perimeter:string;items:{label:string;value:string|number}[]}){
  return <aside className="card mb-5 p-4" aria-label="Copertura del calcolo"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="font-bold">Copertura del calcolo</h2><p className="mt-1 text-sm text-zinc-400">{perimeter}</p></div><div className="text-xs text-zinc-400">Ultimo ricalcolo: <b className="text-zinc-300">{lastRecalculation?new Date(lastRecalculation).toLocaleString('it-IT'):'N/D'}</b></div></div><dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{items.map(item=><div className="rounded-xl bg-zinc-950/60 p-3" key={item.label}><dt className="text-xs text-zinc-400">{item.label}</dt><dd className="mt-1 font-bold text-white">{item.value}</dd></div>)}</dl><Link className="mt-3 inline-flex text-xs font-bold text-neroverde-300 hover:underline" to="/methodology#formulas">Metodologia generale →</Link></aside>;
}
