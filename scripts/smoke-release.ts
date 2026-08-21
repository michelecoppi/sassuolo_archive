const base = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const expectedDataset = process.env.SMOKE_EXPECTED_DATASET?.trim();

export {};

async function response(pathname: string) {
  const result = await fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
  if (!result.ok) throw new Error(`${pathname}: HTTP ${result.status}`);
  return result;
}

const health = await (await response('/api/health')).json() as { ok?: boolean; status?: string };
if (!health.ok || health.status === 'unhealthy') throw new Error(`Health non operativo: ${JSON.stringify(health)}`);

const release = await (await response('/api/dataset-release')).json() as { version?: string; databaseSha256?: string };
if (!release.version || !/^sha256:[a-f0-9]{64}$/.test(release.databaseSha256 ?? '')) throw new Error('Manifest dataset non valido');
if (expectedDataset && release.version !== expectedDataset) throw new Error(`Dataset ${release.version}, atteso ${expectedDataset}`);

const publicStatus = await (await response('/api/status')).json() as { dataset?: { version?: string }; entries?: Array<{ type?: string; releaseVersion?: string }> };
if (publicStatus.dataset?.version !== release.version || !publicStatus.entries?.some(entry => entry.type === 'release' && entry.releaseVersion === release.version)) throw new Error('Stato pubblico non allineato alla release dati');

const feed = await response('/api/status/feed.xml');
if (!(feed.headers.get('content-type') ?? '').includes('application/rss+xml') || !(await feed.text()).includes('<rss version="2.0">')) throw new Error('Feed RSS dello stato pubblico non valido');

const archive = await (await response('/api/matches?page=1&pageSize=10')).json() as { rows?: unknown[]; total?: number };
if (!Array.isArray(archive.rows) || !archive.rows.length || !archive.total) throw new Error('Archivio partite vuoto o non paginabile');

const directRoute = await response('/players');
if (!(directRoute.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Fallback SPA non disponibile sulla route diretta');

console.log(JSON.stringify({ ok: true, base, dataset: release.version, matches: archive.total, checks: 6 }));
