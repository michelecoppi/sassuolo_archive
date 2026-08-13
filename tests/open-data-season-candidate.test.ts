import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after,test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-open-data-season-'));process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'archive.db');
const {db,initDb}=await import('../server/db/database.js');const {importOpenDataSeasonCandidate,previewOpenDataSeasonCandidate}=await import('../server/services/openDataSeasonCandidate.js');initDb();
const roots={statsbomb:path.resolve('data/reconciliation/candidates/match-details-statsbomb-serie-a-2015-16'),wyscout:path.resolve('data/reconciliation/candidates/match-details-wyscout-serie-a-2017-18')};
const candidates={statsbomb:{candidate_path:roots.statsbomb,season:'2015/16',competition:'Serie A',source_provider:'StatsBomb Open Data'},wyscout:{candidate_path:roots.wyscout,season:'2017/18',competition:'Serie A',source_provider:'Wyscout Soccer Match Event Dataset'}};
for(const [key,root] of Object.entries(roots)){const rich=JSON.parse(fs.readFileSync(path.join(root,'rich-data.json'),'utf8'));for(const match of rich.matches)db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider,completeness_level) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(`${key}:${match.providerMatchId}`,match.date,rich.season,rich.competition,match.homeTeam.name,match.awayTeam.name,match.homeScore,match.awayScore,'historical-baseline','BASIC');}
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('i pacchetti stagionali verificano checksum, 38 fixture, XI e risultati',()=>{for(const key of ['statsbomb','wyscout'] as const){const preview=previewOpenDataSeasonCandidate(roots[key],candidates[key]);assert.equal(preview.canApply,true);assert.equal(preview.errors,0);assert.equal(preview.rows,38);assert.equal(preview.validRows,38);}});

test('gli import open data sono idempotenti, attribuiti e preservano gli autogol',()=>{const statsbomb=importOpenDataSeasonCandidate(roots.statsbomb,candidates.statsbomb);assert.equal(statsbomb.details,38);assert.equal(statsbomb.lineups,76);assert.equal(statsbomb.events,484);assert.equal(statsbomb.teamStats,76);assert.ok(statsbomb.playerStats>400);const wyscout=importOpenDataSeasonCandidate(roots.wyscout,candidates.wyscout);assert.equal(wyscout.details,38);assert.equal(wyscout.lineups,76);assert.equal(wyscout.events,484);assert.equal(wyscout.teamStats,76);assert.ok(wyscout.playerStats>400);assert.ok((db.prepare(`SELECT count(*) c FROM match_events WHERE is_own_goal=1`).get() as any).c>=1);assert.ok((db.prepare(`SELECT count(*) c FROM source_references WHERE source_provider IN ('StatsBomb Open Data','Wyscout Soccer Match Event Dataset')`).get() as any).c>=76);const again=importOpenDataSeasonCandidate(roots.wyscout,candidates.wyscout);assert.equal(again.created,0);});
