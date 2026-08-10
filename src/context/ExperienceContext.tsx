import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Preferences = { reducedMotion:boolean; offline:boolean; lastContext?:string; savedViews:Record<string,string> };
type Experience = Preferences & { lastCachedAt:string|null; setReducedMotion:(value:boolean)=>void; saveView:(key:string, query:string)=>void; restoreLastContext:()=>void; clearView:(key:string)=>void };
const KEY='sassuolo-history-preferences';
const defaults:Preferences={reducedMotion:false,offline:!navigator.onLine,savedViews:{}};
const C=createContext<Experience|null>(null);

export function ExperienceProvider({children}:{children:ReactNode}){
  const location=useLocation(),navigate=useNavigate();
  const [p,setP]=useState<Preferences>(()=>{try{const {theme,...saved}=JSON.parse(localStorage.getItem(KEY)||'{}');return {...defaults,...saved};}catch{return defaults}});
  useEffect(()=>{document.documentElement.classList.toggle('reduce-motion',p.reducedMotion);localStorage.setItem(KEY,JSON.stringify(p));},[p]);
  useEffect(()=>{const update=()=>setP(x=>({...x,offline:!navigator.onLine}));window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)};},[]);
  useEffect(()=>{if(location.pathname!=='/'||location.search)setP(x=>x.lastContext===`${location.pathname}${location.search}`?x:{...x,lastContext:`${location.pathname}${location.search}`});},[location.pathname,location.search]);
  const lastCachedAt=useMemo(()=>{let latest:string|null=null;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('sassuolo-history-cache:'))continue;try{const savedAt=JSON.parse(localStorage.getItem(key)||'{}').savedAt;if(savedAt&&(!latest||savedAt>latest))latest=savedAt;}catch{/* ignore */}}return latest;},[p.offline]);
  const value=useMemo<Experience>(()=>({...p,lastCachedAt,setReducedMotion:value=>setP(x=>({...x,reducedMotion:value})),saveView:(key,query)=>setP(x=>({...x,savedViews:{...x.savedViews,[key]:query}})),clearView:key=>setP(x=>{const savedViews={...x.savedViews};delete savedViews[key];return {...x,savedViews}}),restoreLastContext:()=>{if(p.lastContext)navigate(p.lastContext)}}),[p,navigate,lastCachedAt]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useExperience(){const value=useContext(C);if(!value)throw new Error('ExperienceProvider mancante');return value;}
