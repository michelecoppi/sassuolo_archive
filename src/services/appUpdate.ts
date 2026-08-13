export const APP_UPDATE_READY = 'sassuolo-history:update-ready';

let reloadOnControllerChange = false;

export function registerAppUpdates() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const announce = () => window.dispatchEvent(new CustomEvent(APP_UPDATE_READY, { detail: registration }));
    if (registration.waiting && navigator.serviceWorker.controller) announce();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announce();
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadOnControllerChange) return;
      reloadOnControllerChange = false;
      window.location.reload();
    });
  });
}

export function activateWaitingUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return false;
  reloadOnControllerChange = true;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}
