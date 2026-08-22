import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
import { PERSONAL_MUSEUM_KEY,createMuseumMemory,emptyPersonalMuseum,mergePersonalMuseums,normalizePersonalMuseum,type MuseumMemory,type MuseumMemoryDraft,type MuseumProfile,type MuseumTarget,type PersonalMuseumState } from '../services/personalMuseum';

type MuseumContextValue={
  state:PersonalMuseumState;
  memories:MuseumMemory[];
  storageError:string;
  getMemory:(target:Pick<MuseumTarget,'type'|'entityId'>)=>MuseumMemory|null;
  saveMemory:(target:MuseumTarget,draft:MuseumMemoryDraft)=>void;
  removeMemory:(target:Pick<MuseumTarget,'type'|'entityId'>)=>void;
  updateProfile:(profile:MuseumProfile)=>void;
  importState:(state:PersonalMuseumState)=>void;
  clearMuseum:()=>void;
};
const MuseumContext=createContext<MuseumContextValue|null>(null);

function loadMuseum(){try{return normalizePersonalMuseum(JSON.parse(localStorage.getItem(PERSONAL_MUSEUM_KEY)??'null'));}catch{return emptyPersonalMuseum();}}

export function MuseumProvider({children}:{children:ReactNode}){
  const[state,setState]=useState<PersonalMuseumState>(loadMuseum),[storageError,setStorageError]=useState('');
  useEffect(()=>{try{localStorage.setItem(PERSONAL_MUSEUM_KEY,JSON.stringify(state));setStorageError('');}catch{setStorageError('Spazio locale esaurito: esporta il museo prima di aggiungere altri ricordi.');}},[state]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key!==PERSONAL_MUSEUM_KEY)return;try{setState(normalizePersonalMuseum(JSON.parse(event.newValue??'null')));}catch{setState(emptyPersonalMuseum());}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  const value=useMemo<MuseumContextValue>(()=>({state,memories:state.memories,storageError,
    getMemory:target=>state.memories.find(memory=>memory.type===target.type&&memory.entityId===target.entityId)??null,
    saveMemory:(target,draft)=>setState(current=>{const existing=current.memories.find(memory=>memory.type===target.type&&memory.entityId===target.entityId);const memory=createMuseumMemory(target,draft,new Date().toISOString(),existing);return normalizePersonalMuseum({...current,memories:[memory,...current.memories.filter(item=>item.key!==memory.key)]});}),
    removeMemory:target=>setState(current=>({...current,memories:current.memories.filter(memory=>!(memory.type===target.type&&memory.entityId===target.entityId))})),
    updateProfile:profile=>setState(current=>({...current,profile:{supporterSince:profile.supporterSince.trim().slice(0,20),dedication:profile.dedication.trim().slice(0,180)}})),
    importState:incoming=>setState(current=>mergePersonalMuseums(current,incoming)),clearMuseum:()=>setState(emptyPersonalMuseum()),
  }),[state,storageError]);
  return <MuseumContext.Provider value={value}>{children}</MuseumContext.Provider>;
}

export function useMuseum(){const value=useContext(MuseumContext);if(!value)throw new Error('MuseumProvider mancante');return value;}
