import { useEffect, useState } from 'react';
import { activateWaitingUpdate, APP_UPDATE_READY } from '../services/appUpdate';

export default function AppUpdateNotice() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [activating, setActivating] = useState(false);
  useEffect(() => {
    const ready = (event: Event) => setRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
    window.addEventListener(APP_UPDATE_READY, ready);
    return () => window.removeEventListener(APP_UPDATE_READY, ready);
  }, []);
  if (!registration) return null;
  const update = () => {
    if (activateWaitingUpdate(registration)) setActivating(true);
  };
  return <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-neroverde-400/40 bg-zinc-950 p-4 text-sm text-zinc-100 shadow-2xl">
    <div className="font-bold">Nuova versione disponibile</div>
    <p className="mt-1 text-zinc-400">L’aggiornamento verrà applicato solo quando lo confermi. Preferenze e dati locali restano invariati.</p>
    <div className="mt-3 flex gap-2">
      <button className="btn-primary" disabled={activating} onClick={update}>{activating ? 'Aggiornamento…' : 'Aggiorna ora'}</button>
      <button className="btn-secondary" disabled={activating} onClick={() => setRegistration(null)}>Più tardi</button>
    </div>
  </div>;
}
