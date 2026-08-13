import crypto from 'node:crypto';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import type { NextFunction, Request, Response } from 'express';

type CachedResponse = {
  body: string;
  etag: string;
  expiresAt: number;
  generation: number;
};

export type CacheSnapshot = {
  entries: number;
  hits: number;
  misses: number;
  invalidations: number;
  ttlSeconds: number;
};

export function createApiResponseCache(ttlMs = 30_000) {
  const entries = new Map<string, CachedResponse>();
  let hits = 0;
  let misses = 0;
  let invalidations = 0;
  let generation = 0;
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  const cacheControl = 'public, max-age=0, must-revalidate';

  function invalidate() {
    generation++;
    invalidations++;
    entries.clear();
  }

  function middleware(req: Request, res: Response, next: NextFunction) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.path === '/telemetry/frontend') { res.setHeader('Cache-Control', 'no-store'); return next(); }
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) invalidate();
      });
      return next();
    }
    if (req.method !== 'GET' || req.path === '/health' || req.headers.authorization || req.headers.cookie) {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    const key = req.originalUrl;
    const now = Date.now();
    const cached = entries.get(key);
    if (cached && cached.expiresAt > now) {
      hits++;
      res.setHeader('Cache-Control', cacheControl);
      res.setHeader('ETag', cached.etag);
      res.setHeader('X-Cache', 'HIT');
      if (String(req.headers['if-none-match'] ?? '').split(/\s*,\s*/).includes(cached.etag)) {
        return res.status(304).end();
      }
      return res.status(200).type('application/json').send(cached.body);
    }
    if (cached) entries.delete(key);
    misses++;
    res.setHeader('X-Cache', 'MISS');
    const requestGeneration = generation;
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && generation === requestGeneration) {
        const serialized = JSON.stringify(body);
        const etag = `"${crypto.createHash('sha256').update(serialized).digest('base64url')}"`;
        entries.set(key, { body: serialized, etag, expiresAt: Date.now() + ttlMs, generation });
        // Browsers retain the ETag but always revalidate it. This lets a
        // successful mutation invalidate the server cache without clients
        // showing a still-fresh response from their private cache.
        res.setHeader('Cache-Control', cacheControl);
        res.setHeader('ETag', etag);
      }
      return originalJson(body);
    }) as Response['json'];
    next();
  }

  return {
    middleware,
    invalidate,
    snapshot: (): CacheSnapshot => ({ entries: entries.size, hits, misses, invalidations, ttlSeconds })
  };
}

export type RequestSnapshot = {
  startedAt: string;
  total: number;
  errors: number;
  averageDurationMs: number;
  slowestDurationMs: number;
  lastErrorAt: string | null;
};

export function createRequestObservability() {
  const startedAt = new Date().toISOString();
  let total = 0;
  let errors = 0;
  let totalDurationMs = 0;
  let slowestDurationMs = 0;
  let lastErrorAt: string | null = null;

  function middleware(_req: Request, res: Response, next: NextFunction) {
    const started = performance.now();
    res.on('finish', () => {
      const duration = performance.now() - started;
      total++;
      totalDurationMs += duration;
      slowestDurationMs = Math.max(slowestDurationMs, duration);
      if (res.statusCode >= 500) {
        errors++;
        lastErrorAt = new Date().toISOString();
      }
    });
    next();
  }

  return {
    middleware,
    snapshot: (): RequestSnapshot => ({
      startedAt,
      total,
      errors,
      averageDurationMs: total ? Number((totalDurationMs / total).toFixed(2)) : 0,
      slowestDurationMs: Number(slowestDurationMs.toFixed(2)),
      lastErrorAt
    })
  };
}

function safeError(value: unknown): string | null {
  if (!value) return null;
  return String(value)
    .replace(/((?:api[_-]?key|token|authorization)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/(["']?(?:api[_-]?key|token|authorization)["']?\s*:\s*["'])[^"']+/gi, '$1[redacted]')
    .slice(0, 300);
}

export function getOperationalStatus(
  database: Database,
  cache: CacheSnapshot,
  requests: RequestSnapshot
) {
  const queryStarted = performance.now();
  let databaseOk = false;
  let integrity = 'unavailable';
  let databaseBytes = 0;
  let databaseError: string | null = null;
  try {
    database.prepare('SELECT 1 AS ok').get();
    integrity = String(database.pragma('quick_check', { simple: true }));
    databaseOk = integrity === 'ok';
    const databases = database.pragma('database_list') as { name: string; file: string }[];
    const mainFile = databases.find((row) => row.name === 'main')?.file;
    if (mainFile) {
      for (const file of [mainFile, `${mainFile}-wal`, `${mainFile}-shm`]) {
        if (fs.existsSync(file)) databaseBytes += fs.statSync(file).size;
      }
    }
  } catch (error) {
    databaseError = safeError(error);
  }
  const queryDurationMs = Number((performance.now() - queryStarted).toFixed(2));

  const providers = databaseOk ? (database.prepare(`SELECT provider,resource,requests_used,estimated_remaining,last_request,last_successful_sync,last_error FROM sync_state ORDER BY provider,resource`).all() as any[]).map((row) => ({
    provider: row.provider,
    resource: row.resource,
    status: row.last_error ? 'error' : row.last_successful_sync ? 'ok' : 'unknown',
    requestsUsed: row.requests_used,
    estimatedRemaining: row.estimated_remaining,
    lastRequest: row.last_request,
    lastSuccessfulSync: row.last_successful_sync,
    lastError: safeError(row.last_error)
  })) : [];
  const recentImports = databaseOk ? (database.prepare(`SELECT id,kind,source_provider AS sourceProvider,area,status,started_at AS startedAt,finished_at AS finishedAt,CASE WHEN finished_at IS NULL THEN NULL ELSE CAST((julianday(finished_at)-julianday(started_at))*86400000 AS INTEGER) END AS durationMs FROM import_runs ORDER BY id DESC LIMIT 10`).all() as any[]) : [];
  const lastSyncAt = providers.map((row) => row.lastSuccessfulSync).filter(Boolean).sort().at(-1) ?? null;
  const degraded = providers.some((row) => row.status === 'error') || recentImports.some((row) => row.status === 'failed');

  return {
    ok: databaseOk,
    status: !databaseOk ? 'unhealthy' : degraded ? 'degraded' : 'healthy',
    service: 'sassuolo-history-api',
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: { ok: databaseOk, integrity, sizeBytes: databaseBytes, checkDurationMs: queryDurationMs, error: databaseError },
    requests,
    cache,
    lastSyncAt,
    providers,
    recentImports
  };
}
