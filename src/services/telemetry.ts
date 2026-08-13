export type FrontendEventType = 'exception' | 'boundary' | 'route_load' | 'web_vital';
export type FrontendEvent = { eventType: FrontendEventType; name?: string; value?: number; rating?: string; message?: string; stack?: string; context?: Record<string, string> };

const STORAGE_KEY = 'sassuolo-telemetry-opt-out';
const RELEASE = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
let installed = false;

export function normalizeClientRoute(value = window.location.pathname) {
  return (value.split(/[?#]/, 1)[0] || '/').replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id').replace(/\/\d{4}(?:\/|%2F)\d{2}(?=\/|$)/gi, '/:season').slice(0, 160);
}

export function isTelemetryOptOut() {
  if (typeof window === 'undefined') return true;
  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
  return localStorage.getItem(STORAGE_KEY) === '1' || navigator.doNotTrack === '1' || privacyNavigator.globalPrivacyControl === true;
}

export function setTelemetryEnabled(enabled: boolean) {
  if (enabled) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, '1');
}

export function shouldSample(eventType: FrontendEventType, random = Math.random()) {
  return eventType !== 'web_vital' || random < 0.2;
}

export function reportFrontendEvent(event: FrontendEvent) {
  if (isTelemetryOptOut() || !shouldSample(event.eventType)) return;
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const payload = {
    ...event,
    release: RELEASE,
    route: normalizeClientRoute(),
    online: navigator.onLine,
    context: { effectiveType: connection?.effectiveType, visibility: document.visibilityState, ...event.context },
  };
  void fetch('/api/telemetry/frontend', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => undefined);
}

function rating(name: string, value: number) {
  const thresholds: Record<string, [number, number]> = { CLS: [0.1, 0.25], FCP: [1800, 3000], INP: [200, 500], LCP: [2500, 4000], TTFB: [800, 1800] };
  const [good, poor] = thresholds[name] ?? [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

function observe(type: string, callback: (entries: PerformanceEntry[]) => void) {
  try { new PerformanceObserver((list) => callback(list.getEntries())).observe({ type, buffered: true }); } catch { /* metrica non supportata dal browser */ }
}

export function installFrontendTelemetry() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : null;
    const message = error?.message ?? event.message ?? 'Resource load failed';
    const routeLoad = /dynamically imported|loading chunk|failed to fetch module/i.test(message);
    reportFrontendEvent({ eventType: routeLoad ? 'route_load' : 'exception', message, stack: error?.stack, context: routeLoad ? { chunk: 'route' } : undefined });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason ?? 'Unhandled rejection'));
    const routeLoad = /dynamically imported|loading chunk|failed to fetch module/i.test(error.message);
    reportFrontendEvent({ eventType: routeLoad ? 'route_load' : 'exception', message: error.message, stack: error.stack, context: routeLoad ? { chunk: 'route' } : undefined });
  });
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation) reportFrontendEvent({ eventType: 'web_vital', name: 'TTFB', value: navigation.responseStart, rating: rating('TTFB', navigation.responseStart) });
  }, { once: true });
  observe('paint', (entries) => { const entry = entries.find((item) => item.name === 'first-contentful-paint'); if (entry) reportFrontendEvent({ eventType: 'web_vital', name: 'FCP', value: entry.startTime, rating: rating('FCP', entry.startTime) }); });
  observe('largest-contentful-paint', (entries) => { const value = entries.at(-1)?.startTime; if (value != null) reportFrontendEvent({ eventType: 'web_vital', name: 'LCP', value, rating: rating('LCP', value) }); });
  let cls = 0;
  observe('layout-shift', (entries) => { for (const entry of entries as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) if (!entry.hadRecentInput) cls += entry.value ?? 0; });
  observe('event', (entries) => { const value = Math.max(0, ...entries.map((entry) => entry.duration)); if (value) reportFrontendEvent({ eventType: 'web_vital', name: 'INP', value, rating: rating('INP', value) }); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cls) reportFrontendEvent({ eventType: 'web_vital', name: 'CLS', value: cls, rating: rating('CLS', cls) }); });
}
