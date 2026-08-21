import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type Favorite={url:string;label:string;type:'player'|'season'|'match'|'view';savedAt:string};
type Preferences = { reducedMotion:boolean; offline:boolean; lastContext?:string; savedViews:Record<string,string>;favorites:Favorite[] };
type Experience = Preferences & { lastCachedAt:string|null; usingCachedData:boolean; cachedPath:string|null; setReducedMotion:(value:boolean)=>void; saveView:(key:string, query:string)=>void; restoreLastContext:()=>void; clearView:(key:string)=>void;toggleFavorite:(favorite:Omit<Favorite,'savedAt'>)=>void;isFavorite:(url:string)=>boolean;clearFavorites:()=>void;importFavorites:(favorites:Favorite[])=>void };
const KEY='sassuolo-history-preferences';
const defaults:Preferences={reducedMotion:false,offline:!navigator.onLine,savedViews:{},favorites:[]};
const C=createContext<Experience|null>(null);

export function ExperienceProvider({children}:{children:ReactNode}){
  const location=useLocation(),navigate=useNavigate();
  const [p,setP]=useState<Preferences>(()=>{try{const {theme,...saved}=JSON.parse(localStorage.getItem(KEY)||'{}');return {...defaults,...saved,offline:!navigator.onLine};}catch{return defaults}});
  useEffect(()=>{document.documentElement.classList.toggle('reduce-motion',p.reducedMotion);localStorage.setItem(KEY,JSON.stringify(p));},[p]);
  const [cacheRevision,setCacheRevision]=useState(0);
  const [cacheFallback,setCacheFallback]=useState<{path:string;savedAt:string}|null>(null);
  useEffect(()=>{const update=()=>setP(x=>({...x,offline:!navigator.onLine}));const cacheUpdate=()=>setCacheRevision(value=>value+1);const fallback=(event:Event)=>setCacheFallback((event as CustomEvent<{path:string;savedAt:string}>).detail);const fresh=(event:Event)=>{const path=(event as CustomEvent<{path:string}>).detail?.path;setCacheFallback(current=>!current||current.path===path?null:current);};window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener('sassuolo-cache-updated',cacheUpdate);window.addEventListener('sassuolo-cache-fallback',fallback);window.addEventListener('sassuolo-network-response',fresh);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('sassuolo-cache-updated',cacheUpdate);window.removeEventListener('sassuolo-cache-fallback',fallback);window.removeEventListener('sassuolo-network-response',fresh)};},[]);
  useEffect(()=>{if(location.pathname!=='/'||location.search)setP(x=>x.lastContext===`${location.pathname}${location.search}`?x:{...x,lastContext:`${location.pathname}${location.search}`});},[location.pathname,location.search]);
  const lastCachedAt=useMemo(()=>{let latest:string|null=null;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('sassuolo-history-cache:'))continue;try{const savedAt=JSON.parse(localStorage.getItem(key)||'{}').savedAt;if(savedAt&&(!latest||savedAt>latest))latest=savedAt;}catch{/* ignore */}}return latest;},[p.offline,cacheRevision]);
  const value=useMemo<Experience>(()=>({...p,lastCachedAt:cacheFallback?.savedAt??lastCachedAt,usingCachedData:Boolean(cacheFallback),cachedPath:cacheFallback?.path??null,setReducedMotion:value=>setP(x=>({...x,reducedMotion:value})),saveView:(key,query)=>setP(x=>({...x,savedViews:{...x.savedViews,[key]:query}})),clearView:key=>setP(x=>{const savedViews={...x.savedViews};delete savedViews[key];return {...x,savedViews}}),restoreLastContext:()=>{if(p.lastContext)navigate(p.lastContext)},toggleFavorite:favorite=>setP(x=>({...x,favorites:x.favorites.some(item=>item.url===favorite.url)?x.favorites.filter(item=>item.url!==favorite.url):[...x.favorites,{...favorite,savedAt:new Date().toISOString()}]})),isFavorite:url=>p.favorites.some(item=>item.url===url),clearFavorites:()=>setP(x=>({...x,favorites:[]})),importFavorites:favorites=>setP(x=>({...x,favorites:[...new Map(favorites.filter(item=>item?.url&&item?.label).map(item=>[item.url,item])).values()]}))}),[p,navigate,lastCachedAt,cacheFallback]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useExperience(){const value=useContext(C);if(!value)throw new Error('ExperienceProvider mancante');return value;}
