import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

const eventTypes = new Set(['exception', 'boundary', 'route_load', 'web_vital']);
const vitalNames = new Set(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
const contextKeys = new Set(['component', 'chunk', 'effectiveType', 'visibility']);

export type FrontendTelemetryInput = {
  eventType?: unknown; release?: unknown; route?: unknown; online?: unknown;
  name?: unknown; value?: unknown; rating?: unknown; message?: unknown;
  stack?: unknown; context?: unknown;
};

export function normalizeTelemetryRoute(value: unknown) {
  let pathname = String(value ?? '/').split(/[?#]/, 1)[0] || '/';
  if (!pathname.startsWith('/')) pathname = '/';
  try { pathname = decodeURI(pathname); } catch { pathname = '/'; }
  return pathname.replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id').replace(/\/\d{4}(?:\/|%2F)\d{2}(?=\/|$)/gi, '/:season').slice(0, 160);
}

export function redactTelemetryText(value: unknown) {
  return String(value ?? '')
    .replace(/https?:\/\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?/gi, (url) => url.split(/[?#]/, 1)[0])
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(token|api[-_ ]?key|authorization|password|search|query|q)\s*[:=]\s*[^\s&,;]+/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]')
    .slice(0, 240);
}

export function sanitizeFrontendTelemetry(input: FrontendTelemetryInput) {
  const eventType = String(input.eventType ?? '');
  if (!eventTypes.has(eventType)) throw new Error('Tipo evento telemetria non valido');
  const release = String(input.release ?? '').trim();
  if (!/^[0-9A-Za-z._-]{1,64}$/.test(release)) throw new Error('Versione release non valida');
  const name = input.name == null ? null : String(input.name).toUpperCase().slice(0, 32);
  if (eventType === 'web_vital' && (!name || !vitalNames.has(name))) throw new Error('Web Vital non supportato');
  const numericValue = input.value == null ? null : Number(input.value);
  if (numericValue != null && (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1_000_000)) throw new Error('Valore telemetria non valido');
  const rawContext = input.context && typeof input.context === 'object' && !Array.isArray(input.context) ? input.context as Record<string, unknown> : {};
  const context = Object.fromEntries(Object.entries(rawContext).filter(([key]) => contextKeys.has(key)).map(([key, value]) => [key, redactTelemetryText(value).slice(0, 80)]));
  const stack = redactTelemetryText(input.stack);
  return { eventType, release, route: normalizeTelemetryRoute(input.route), online: input.online === false ? 0 : 1, name, value: numericValue, rating: input.rating == null ? null : String(input.rating).slice(0, 16), message: input.message == null ? null : redactTelemetryText(input.message), stackHash: stack ? crypto.createHash('sha256').update(stack).digest('hex') : null, context };
}

export function recordFrontendTelemetry(db: Database, input: FrontendTelemetryInput) {
  const event = sanitizeFrontendTelemetry(input);
  const createdAt = new Date().toISOString();
  const id = db.transaction(() => {
    db.prepare(`DELETE FROM frontend_telemetry WHERE created_at < datetime('now','-30 days')`).run();
    const inserted = db.prepare(`INSERT INTO frontend_telemetry(event_type,release,route,online,name,value,rating,message,stack_hash,context_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(event.eventType, event.release, event.route, event.online, event.name, event.value, event.rating, event.message, event.stackHash, JSON.stringify(event.context), createdAt);
    db.prepare(`DELETE FROM frontend_telemetry WHERE id IN (SELECT id FROM frontend_telemetry ORDER BY id DESC LIMIT -1 OFFSET 10000)`).run();
    return Number(inserted.lastInsertRowid);
  })();
  return { id, createdAt };
}

export function frontendTelemetrySummary(db: Database) {
  const last24Hours = db.prepare(`SELECT event_type AS eventType,COUNT(*) AS count FROM frontend_telemetry WHERE created_at>=datetime('now','-24 hours') GROUP BY event_type ORDER BY count DESC`).all();
  const byRelease = db.prepare(`SELECT release,COUNT(*) AS count,MAX(created_at) AS lastSeenAt FROM frontend_telemetry WHERE created_at>=datetime('now','-24 hours') GROUP BY release ORDER BY count DESC LIMIT 10`).all();
  const recent = db.prepare(`SELECT id,event_type AS eventType,release,route,online,name,value,rating,message,stack_hash AS stackHash,context_json AS context,created_at AS createdAt FROM frontend_telemetry ORDER BY id DESC LIMIT 20`).all() as any[];
  return { retentionDays: 30, maxEvents: 10000, last24Hours, byRelease, recent: recent.map((row) => ({ ...row, online: Boolean(row.online), context: JSON.parse(row.context || '{}') })) };
}
