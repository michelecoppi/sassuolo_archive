const ADMIN_READ_EXACT = new Set([
  '/api-football/status',
  '/corrections',
  '/data-manager',
  '/data-quality',
  '/health/details',
  '/kickoff/status',
  '/news/dedupe-preview',
  '/sync/jobs',
  '/telemetry/frontend/summary',
]);

const ADMIN_READ_PREFIXES = [
  '/data/candidates/',
  '/data/provenance/',
  '/manual/',
  '/player-identity-conflicts/',
];

export function isAdminReadPath(pathname: string) {
  return ADMIN_READ_EXACT.has(pathname) || ADMIN_READ_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function isPublicMutation(method: string, pathname: string) {
  return method === 'POST' && (pathname === '/corrections' || pathname === '/telemetry/frontend');
}
