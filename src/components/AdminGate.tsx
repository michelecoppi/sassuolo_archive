import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { getAdminSession, loginAdmin, logoutAdmin, type AdminSession } from '../services/api';
import { Loading } from './Ui';

export default function AdminGate({children}:{children:ReactNode}){
  const [session,setSession]=useState<AdminSession|null>(null);
  const [token,setToken]=useState('');const [name,setName]=useState('Curatore');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{void getAdminSession().then(setSession).catch(()=>setSession({authenticated:false,actor:null,csrfToken:null,expiresAt:null}));const listener=(event:Event)=>setSession((event as CustomEvent<AdminSession>).detail);window.addEventListener('sassuolo-admin-session',listener);return()=>window.removeEventListener('sassuolo-admin-session',listener)},[]);
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{setSession(await loginAdmin(token,name));setToken('')}catch(e){setError(String(e))}finally{setBusy(false)}};
  const logout=async()=>{setBusy(true);try{await logoutAdmin();setSession({authenticated:false,actor:null,csrfToken:null,expiresAt:null})}catch(e){setError(String(e))}finally{setBusy(false)}};
  if(!session)return <Loading/>;
  if(!session.authenticated)return <div className="mx-auto max-w-md card p-6"><div className="mb-4 flex items-center gap-3"><KeyRound className="h-6 w-6 text-neroverde-300"/><div><h1 className="text-xl font-black">Accesso amministrativo</h1><p className="text-sm text-zinc-400">La credenziale viene scambiata con una sessione protetta e non viene salvata dal browser.</p></div></div><form className="space-y-3" onSubmit={submit}><label className="block text-sm font-bold">Nome curatore<input className="input mt-1 w-full" value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><label className="block text-sm font-bold">Credenziale amministrativa<input className="input mt-1 w-full" type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="current-password" required/></label>{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}<button className="btn-primary w-full" disabled={busy}>{busy?'Accesso…':'Accedi'}</button></form></div>;
  return <><div className="mb-4 flex items-center justify-end gap-2 text-xs text-zinc-400"><ShieldCheck className="h-4 w-4 text-neroverde-300"/>Sessione: {session.actor}<button className="btn-secondary !min-h-8 !px-2 !py-1" disabled={busy} onClick={logout}><LogOut className="h-3.5 w-3.5"/>Esci</button></div>{children}</>;
}
