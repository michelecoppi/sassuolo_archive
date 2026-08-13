import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

type Policy = {
  allowedLicenses: string[];
  blockedLicenses: string[];
  blockedSeverity: 'low' | 'moderate' | 'high' | 'critical';
  exceptions: Array<{ package: string; advisory?: string; expiresAt: string; reason: string }>;
};

type LockPackage = { version?: string; license?: string; link?: boolean };
type AuditVia = string | { source?: number | string; title?: string; severity?: string };
type AuditEntry = { severity?: string; via?: AuditVia[] };

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
const policy = JSON.parse(readFileSync(new URL('supply-chain-policy.json', root), 'utf8')) as Policy;
const failures: string[] = [];

const dependencyGroups = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
for (const group of dependencyGroups) {
  for (const [name, requested] of Object.entries<string>(manifest[group] ?? {})) {
    if (!exactVersion.test(requested)) failures.push(`${group}.${name} non e' fissata: ${requested}`);
    const locked = lock.packages?.['']?.[group]?.[name];
    if (locked !== requested) failures.push(`${name}: manifest ${requested}, lockfile ${locked ?? 'assente'}`);
  }
}

if (!manifest.packageManager?.match(/^npm@\d+\.\d+\.\d+$/)) failures.push('packageManager npm non fissato');
if (!manifest.engines?.node || !manifest.engines?.npm) failures.push('engines node/npm mancanti');

for (const [path, value] of Object.entries<LockPackage>(lock.packages ?? {})) {
  if (!path || value.link || !path.startsWith('node_modules/')) continue;
  if (!value.license) {
    failures.push(`${path}: licenza assente dal lockfile`);
    continue;
  }
  if (policy.blockedLicenses.includes(value.license) || !policy.allowedLicenses.includes(value.license)) {
    failures.push(`${path}: licenza non ammessa (${value.license})`);
  }
}

function validException(packageName: string, advisory: string) {
  const now = Date.now();
  return policy.exceptions.some((item) =>
    item.package === packageName
    && (!item.advisory || item.advisory === advisory)
    && Boolean(item.reason.trim())
    && Date.parse(item.expiresAt) > now,
  );
}

if (process.argv.includes('--audit')) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['audit', '--json', '--omit=dev'], { cwd: new URL('.', root), encoding: 'utf8' });
  let report: { vulnerabilities?: Record<string, AuditEntry>; error?: unknown };
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch {
    failures.push(`npm audit non ha prodotto JSON valido: ${result.stderr.trim()}`);
    report = {};
  }
  if (report.error) failures.push(`npm audit non disponibile: ${JSON.stringify(report.error)}`);
  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
    if (vulnerability.severity !== policy.blockedSeverity) continue;
    const advisories = (vulnerability.via ?? [])
      .filter((via): via is Exclude<AuditVia, string> => typeof via !== 'string')
      .map((via) => String(via.source ?? via.title ?? 'unknown'));
    if (!advisories.length) advisories.push('unknown');
    for (const advisory of advisories) {
      if (!validException(packageName, advisory)) failures.push(`${packageName}: vulnerabilita' critical ${advisory}`);
    }
  }
}

for (const exception of policy.exceptions) {
  if (!exception.reason.trim()) failures.push(`eccezione ${exception.package}: motivazione assente`);
  if (!Number.isFinite(Date.parse(exception.expiresAt))) failures.push(`eccezione ${exception.package}: scadenza non valida`);
  else if (Date.parse(exception.expiresAt) <= Date.now()) failures.push(`eccezione ${exception.package}: scaduta il ${exception.expiresAt}`);
}

if (failures.length) {
  console.error(`Supply-chain check fallito (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Supply-chain check OK: versioni fissate, ${Object.keys(lock.packages ?? {}).length - 1} pacchetti con licenze ammesse${process.argv.includes('--audit') ? ', audit critical superato' : ''}.`);
}
