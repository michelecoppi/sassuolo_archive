import { useEffect,useId,useState,type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Heart,Landmark,Trash2,X } from 'lucide-react';
import { useMuseum } from '../context/MuseumContext';
import { emotionLabels,experienceLabels,type MuseumEmotion,type MuseumExperience,type MuseumMemoryDraft,type MuseumTarget } from '../services/personalMuseum';
import { useModalA11y } from '../hooks/useModalA11y';

const defaultDraft:MuseumMemoryDraft={experience:'archive',emotion:'pride',intensity:3,note:'',favoriteMoment:''};
const emotionGlyphs:Record<MuseumEmotion,string>={goosebumps:'✦',joy:'☀',pride:'◆',tension:'⌁',heartbreak:'♡'};

export default function MemoryButton({target,compact=false,className=''}:{target:MuseumTarget;compact?:boolean;className?:string}){
  const museum=useMuseum(),memory=museum.getMemory(target),[open,setOpen]=useState(false),[draft,setDraft]=useState<MuseumMemoryDraft>(defaultDraft),[confirmRemove,setConfirmRemove]=useState(false),[status,setStatus]=useState('');
  const titleId=useId(),descriptionId=useId();
  const close=()=>setOpen(false);
  const dialogRef=useModalA11y(close,open);
  useEffect(()=>{if(!open)return;setDraft(memory?{experience:memory.experience,emotion:memory.emotion,intensity:memory.intensity,note:memory.note,favoriteMoment:memory.favoriteMoment}:defaultDraft);setConfirmRemove(false);setStatus('');const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous};},[open,memory]);
  const save=(event:FormEvent)=>{event.preventDefault();museum.saveMemory(target,draft);setStatus('Ricordo salvato solo su questo dispositivo.');window.setTimeout(close,350);};
  const remove=()=>{if(!confirmRemove){setConfirmRemove(true);return;}museum.removeMemory(target);setStatus('Ricordo rimosso.');window.setTimeout(close,250);};
  return <>
    <button type="button" className={`${memory?'btn-secondary text-neroverde-300':'btn-secondary'} ${compact?'!min-h-9 !px-3 text-xs':''} ${className}`} onClick={()=>setOpen(true)} aria-haspopup="dialog"><Landmark aria-hidden="true" className="h-4 w-4"/>{memory?'Nel mio museo':'Aggiungi al museo'}</button>
    {open&&createPortal(<div className="museum-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><div ref={dialogRef} className="museum-memory-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
      <div className="museum-memory-glow" aria-hidden="true"/>
      <header className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-7"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-amber-300"><Heart aria-hidden="true" className="h-3.5 w-3.5"/>Memoria privata</div><h2 id={titleId} className="text-xl font-black text-white md:text-2xl">{target.label}</h2><p id={descriptionId} className="mt-1 text-sm text-zinc-400">Racconta come questo frammento neroverde è entrato nella tua storia.</p></div><button className="btn-secondary !min-h-10 !px-3" onClick={close} aria-label="Chiudi editor del ricordo"><X aria-hidden="true" className="h-4 w-4"/></button></header>
      <form className="relative space-y-5 overflow-y-auto px-5 py-5 md:px-7" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-zinc-200">Come l’hai vissuta<select className="input mt-2 w-full" value={draft.experience} onChange={event=>setDraft(value=>({...value,experience:event.target.value as MuseumExperience}))}>{Object.entries(experienceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold text-zinc-200">Momento preferito<input className="input mt-2 w-full" maxLength={160} placeholder="Un gol, un gesto, un’emozione…" value={draft.favoriteMoment} onChange={event=>setDraft(value=>({...value,favoriteMoment:event.target.value}))}/><span className="mt-1 block text-right text-[10px] font-medium text-zinc-500">{draft.favoriteMoment.length}/160</span></label></div>
        <fieldset><legend className="text-sm font-bold text-zinc-200">Emozione dominante</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{(Object.keys(emotionLabels) as MuseumEmotion[]).map(emotion=><button key={emotion} type="button" aria-pressed={draft.emotion===emotion} className={`museum-emotion ${draft.emotion===emotion?'is-active':''}`} onClick={()=>setDraft(value=>({...value,emotion}))}><span aria-hidden="true" className="text-xl">{emotionGlyphs[emotion]}</span><span>{emotionLabels[emotion]}</span></button>)}</div></fieldset>
        <label className="block text-sm font-bold text-zinc-200"><span className="flex items-center justify-between gap-3"><span>Quanto è intenso questo ricordo?</span><output className="museum-intensity-output">{draft.intensity}/5</output></span><input className="museum-range mt-3 w-full" type="range" min="1" max="5" step="1" aria-label="Intensità del ricordo" value={draft.intensity} onChange={event=>setDraft(value=>({...value,intensity:Number(event.target.value) as MuseumMemoryDraft['intensity']}))}/><span className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-500"><span>Sussurro</span><span>Indimenticabile</span></span></label>
        <label className="block text-sm font-bold text-zinc-200">La tua nota<textarea className="input mt-2 min-h-28 w-full resize-y" maxLength={500} placeholder="Dove eri, con chi, cosa hai provato…" value={draft.note} onChange={event=>setDraft(value=>({...value,note:event.target.value}))}/><span className="mt-1 block text-right text-[10px] font-medium text-zinc-500">{draft.note.length}/500</span></label>
        <p className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.06] px-3 py-2 text-xs leading-5 text-emerald-100">Resta nel browser di questo dispositivo. Non viene inviato al server e non entra nelle statistiche pubbliche.</p>
        {(status||museum.storageError)&&<p role="status" aria-live="polite" className={`text-sm font-semibold ${museum.storageError?'text-amber-200':'text-neroverde-300'}`}>{museum.storageError||status}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">{memory?<button type="button" className={`btn-secondary ${confirmRemove?'border-red-400/50 text-red-200':'text-zinc-300'}`} onClick={remove}><Trash2 aria-hidden="true" className="h-4 w-4"/>{confirmRemove?'Conferma rimozione':'Rimuovi ricordo'}</button>:<span/>}<div className="flex gap-2"><button type="button" className="btn-secondary" onClick={close}>Annulla</button><button type="submit" className="btn-primary"><Heart aria-hidden="true" className="h-4 w-4"/>{memory?'Aggiorna ricordo':'Porta nel museo'}</button></div></div>
      </form>
    </div></div>,document.body)}
  </>;
}
