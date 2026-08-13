import { useState } from 'react';
import { Download, FileJson, Link2, Printer } from 'lucide-react';
import { datasetReleaseMetadata } from '../services/datasetRelease';

export type ExportColumn<T>={key:string;label:string;unit?:string;value:(row:T)=>unknown};
type Props<T>={filename:string;rows:T[];columns:ExportColumn<T>[];filters?:Record<string,unknown>;sources?:string[]};

const generatedAt=()=>new Date().toISOString();
const csvCell=(value:unknown)=>{
  const text=value==null?'NULL':String(value);
  return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
};
const download=(filename:string,type:string,content:string)=>{
  const href=URL.createObjectURL(new Blob([content],{type}));
  const anchor=document.createElement('a');anchor.href=href;anchor.download=filename;anchor.click();URL.revokeObjectURL(href);
};

export default function ViewActions<T>({filename,rows,columns,filters={},sources=[]}:Props<T>){
  const[message,setMessage]=useState('');
  const printGenerated=generatedAt();const uniqueSources=[...new Set(sources.filter(Boolean))];
  const metadata=()=>({generated_at:generatedAt(),...datasetReleaseMetadata(),null_value:'NULL',filters,sort:new URLSearchParams(window.location.search).get('sort')??null,source_providers:[...new Set(sources.filter(Boolean))],url:window.location.href});
  const exportRows=()=>rows.map(row=>Object.fromEntries(columns.map(column=>[column.unit?`${column.label} [${column.unit}]`:column.label,column.value(row)??null])));
  const csv=()=>{const meta=metadata(),header=columns.map(column=>column.unit?`${column.label} [${column.unit}]`:column.label);return [`generated_at,${csvCell(meta.generated_at)}`,`dataset_version,${csvCell(meta.dataset_version??null)}`,`dataset_sha256,${csvCell(meta.dataset_sha256??null)}`,`null_value,${meta.null_value}`,`filters,${csvCell(JSON.stringify(meta.filters))}`,`source_providers,${csvCell(meta.source_providers.join(' | ')||'NULL')}`,'',header.map(csvCell).join(','),...exportRows().map(row=>Object.values(row).map(csvCell).join(','))].join('\r\n');};
  const saveCsv=()=>{download(`${filename}.csv`,'text/csv;charset=utf-8',`\uFEFF${csv()}`);setMessage(`CSV esportato: ${rows.length} righe.`)};
  const saveJson=()=>{download(`${filename}.json`,'application/json;charset=utf-8',JSON.stringify({metadata:metadata(),rows:exportRows()},null,2));setMessage(`JSON esportato: ${rows.length} righe.`)};
  const share=async()=>{await navigator.clipboard.writeText(window.location.href);setMessage('Link della vista copiato.')};
  return <div className="view-actions flex flex-wrap gap-2" aria-label="Esporta e condividi la vista">
    <button className="btn-secondary" type="button" onClick={saveCsv}><Download className="h-4 w-4"/>CSV</button>
    <button className="btn-secondary" type="button" onClick={saveJson}><FileJson className="h-4 w-4"/>JSON</button>
    <button className="btn-secondary" type="button" onClick={()=>window.print()}><Printer className="h-4 w-4"/>Stampa</button>
    <button className="btn-secondary" type="button" onClick={()=>void share()}><Link2 className="h-4 w-4"/>Copia link</button>
    <span className="sr-only" aria-live="polite">{message}</span>
    <div className="print-export-meta hidden text-xs"><b>Vista esportata:</b> {rows.length} righe · generata {printGenerated} · NULL = dato non disponibile · fonti: {uniqueSources.join(', ')||'N/D'} · filtri: {JSON.stringify(filters)}</div>
  </div>;
}
