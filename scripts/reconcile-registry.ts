import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, initDb, nowIso } from '../server/db/database.js';

initDb();

const root = path.resolve('data/reconciliation/candidates');
const legacyRoot = path.resolve('data/research-candidates');
// Keep old checkouts readable while the canonical layout is migrated.
db.prepare(`UPDATE research_candidates SET candidate_path=REPLACE(candidate_path,'data/research-candidates/','data/reconciliation/candidates/') WHERE candidate_path LIKE 'data/research-candidates/%'`).run();
db.prepare(`UPDATE audit_runs SET report_path=REPLACE(report_path,'data/audits/','data/reconciliation/audits/') WHERE report_path LIKE 'data/audits/%'`).run();
const scanRoot = fs.existsSync(root) ? root : legacyRoot;
const files = fs.existsSync(scanRoot)
  ? fs.readdirSync(scanRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(scanRoot, entry.name, 'manifest.json'))
    .filter(file => fs.existsSync(file))
  : [];

const upsert = db.prepare(`INSERT INTO research_candidates(
  candidate_path,area,season,competition,source_provider,source_url,manifest_sha256,status,
  records_total,records_discarded,fields_covered_json,validation_status,last_seen_at,notes
) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(candidate_path) DO UPDATE SET
  area=excluded.area,season=excluded.season,competition=excluded.competition,
  source_provider=excluded.source_provider,source_url=excluded.source_url,
  manifest_sha256=excluded.manifest_sha256,records_total=excluded.records_total,
  records_discarded=excluded.records_discarded,fields_covered_json=excluded.fields_covered_json,
  validation_status=excluded.validation_status,last_seen_at=excluded.last_seen_at,notes=excluded.notes`);

const results = files.map(file => {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as any;
  const text = fs.readFileSync(file, 'utf8');
  const digest = crypto.createHash('sha256').update(text).digest('hex');
  const validationStatus = String(manifest.validation?.status ?? 'not_run');
  const status = validationStatus === 'ok' ? 'validated' : 'candidate';
  const candidatePath = `data/reconciliation/candidates/${path.basename(path.dirname(file))}`;
  upsert.run(
    candidatePath,
    String(manifest.area ?? 'unknown'),
    manifest.season ?? null,
    manifest.competition ?? null,
    manifest.source_provider ?? null,
    manifest.source_url ?? null,
    digest,
    status,
    Number(manifest.records_total ?? manifest.row_count ?? 0),
    Number(manifest.records_discarded ?? 0),
    JSON.stringify(manifest.fields_covered ?? []),
    validationStatus,
    nowIso(),
    Array.isArray(manifest.notes) ? manifest.notes.join(' | ') : (manifest.notes ?? null),
  );
  return { candidatePath, status, validationStatus, recordsTotal: Number(manifest.records_total ?? manifest.row_count ?? 0), manifestSha256: digest };
});

console.log(JSON.stringify({ scanned: results.length, candidates: results }, null, 2));
