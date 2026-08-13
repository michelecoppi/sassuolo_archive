import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after,test } from 'node:test';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sassuolo-statsbomb-candidate-'));
process.env.SASSUOLO_DB_PATH=path.join(tempRoot,'statsbomb.db');
const {db,initDb}=await import('../server/db/database.js');
const {importStatsBombCandidate,previewStatsBombCandidate}=await import('../server/services/statsbombCandidate.js');
initDb();
const candidateDir=path.resolve('data/reconciliation/candidates/match-details-statsbomb-serie-a-2015-16-poc');
const candidate={candidate_path:'data/reconciliation/candidates/match-details-statsbomb-serie-a-2015-16-poc',season:'2015/16',competition:'Serie A',source_provider:'StatsBomb Open Data',source_url:'https://github.com/hudl/open-data/tree/master/data'};
const fixtureId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score,source_provider,source_url,completeness_level) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run('statsbomb-poc-fixture','2016-03-06','2015/16','Serie A','U.S. Sassuolo Calcio','Milan',2,0,'football-data.co.uk','https://www.football-data.co.uk/mmz4281/1516/I1.csv','STANDARD').lastInsertRowid);
for(const name of ['Andrea Consigli','Domenico Berardi','Nicola Sansone'])db.prepare(`INSERT INTO players(name) VALUES(?)`).run(name);
after(()=>{db.close();fs.rmSync(tempRoot,{recursive:true,force:true});});

test('la POC StatsBomb valida checksum, fixture, formazioni e gol prima di scrivere',()=>{
  const preview=previewStatsBombCandidate(candidateDir,candidate);
  assert.equal(preview.canApply,true);assert.equal(preview.errors,0);assert.equal(preview.rows,1);
  const manifest=JSON.parse(fs.readFileSync(path.join(candidateDir,'manifest.json'),'utf8'));
  assert.equal(preview.checksum,manifest.sha256);assert.equal(preview.richChecksum,manifest.rich_sha256);
  assert.deepEqual(preview.counts.lineups,2);assert.equal(preview.counts.events,13);
  assert.equal((db.prepare(`SELECT COUNT(*) count FROM match_events WHERE match_id=?`).get(fixtureId) as any).count,0);
});

test('l’import StatsBomb è idempotente e collega solo identità canoniche sicure',()=>{
  const first=importStatsBombCandidate(candidateDir,candidate);
  assert.deepEqual({details:first.detailsCreated,lineups:first.lineupsCreated,events:first.eventsCreated},{details:1,lineups:2,events:13});
  const saved=db.prepare(`SELECT stadium,referee FROM matches WHERE id=?`).get(fixtureId) as any;
  assert.equal(saved.referee,'Piero Giacomelli');assert.match(saved.stadium,/MAPEI Stadium/);
  assert.equal((db.prepare(`SELECT api_fixture_id FROM match_details WHERE match_id=?`).get(fixtureId) as any).api_fixture_id,-3879771);
  assert.equal((db.prepare(`SELECT COUNT(*) count FROM match_lineups WHERE match_id=? AND api_fixture_id=-3879771`).get(fixtureId) as any).count,2);
  assert.equal((db.prepare(`SELECT COUNT(*) count FROM match_events WHERE match_id=? AND api_fixture_id=-3879771`).get(fixtureId) as any).count,13);
  assert.equal((db.prepare(`SELECT COUNT(*) count FROM match_events WHERE match_id=? AND player_id IS NOT NULL`).get(fixtureId) as any).count>0,true);
  assert.equal((db.prepare(`SELECT COUNT(*) count FROM player_match_conflicts`).get() as any).count,0);
  const second=importStatsBombCandidate(candidateDir,candidate);
  assert.equal(second.created,0);assert.deepEqual({details:second.detailsCreated,lineups:second.lineupsCreated,events:second.eventsCreated},{details:0,lineups:0,events:0});
});
