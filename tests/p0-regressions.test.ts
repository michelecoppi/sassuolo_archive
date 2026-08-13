import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sassuolo-history-test-'));
process.env.SASSUOLO_DB_PATH = path.join(tempRoot, 'test.db');

const { db, initDb, normalizePlayerPosition } = await import('../server/db/database.js');
const { importAll, recomputeDerivedPlayerStats } = await import('../server/services/importer.js');
const { normalizeKickoffEventMinute } = await import('../server/services/kickoffSync.js');
const { headToHead, records, hallOfFame } = await import('../server/services/stats.js');

function clearDb() {
  db.exec(`DELETE FROM change_log; DELETE FROM source_references; DELETE FROM data_conflicts; DELETE FROM transfers; DELETE FROM match_injuries; DELETE FROM match_player_stats; DELETE FROM match_team_stats; DELETE FROM match_lineups; DELETE FROM match_events; DELETE FROM match_details; DELETE FROM matches; DELETE FROM player_seasons; DELETE FROM players; DELETE FROM seasons;`);
}

before(() => initDb());
after(() => { db.close(); fs.rmSync(tempRoot, { recursive: true, force: true }); });

test('importer deduplicates different kickoff times and team aliases, records conflicts, and preserves manual rows', () => {
  clearDb();
  const base = path.join(tempRoot, 'import');
  for (const dir of ['seasons', 'matches', 'players', 'player-seasons']) fs.mkdirSync(path.join(base, dir), { recursive: true });
  fs.writeFileSync(path.join(base, 'matches', 'fixtures.json'), JSON.stringify([
    { external_key: 'one', date: '2025-08-20T18:45:00Z', season: '2025/26', competition: 'Serie A', home_team: 'Sassuolo', away_team: 'Milan', home_score: 2, away_score: 0, source_provider: 'provider-one' },
    { external_key: 'two', date: '2025-08-20 20:45:00+02:00', season: '2025/26', competition: 'Serie A', home_team: 'US Sassuolo', away_team: 'AC Milan', home_score: 1, away_score: 0, source_provider: 'provider-two' }
  ]));
  importAll({ base });
  assert.equal((db.prepare(`SELECT COUNT(1) AS count FROM matches`).get() as any).count, 1);
  assert.equal((db.prepare(`SELECT COUNT(1) AS count FROM data_conflicts WHERE field='home_score'`).get() as any).count, 1);

  db.prepare(`UPDATE matches SET source_provider='manual',home_score=9 WHERE external_key='one'`).run();
  fs.writeFileSync(path.join(base, 'matches', 'manual-protection.json'), JSON.stringify([{ external_key: 'one', date: '2025-08-20T18:45:00Z', season: '2025/26', competition: 'Serie A', home_team: 'Sassuolo', away_team: 'Milan', home_score: 0, away_score: 7, source_provider: 'provider-one' }]));
  importAll({ base });
  assert.equal((db.prepare(`SELECT home_score FROM matches WHERE external_key='one'`).get() as any).home_score, 9);
});

test('database rejects a completed fixture outside its season and accepts an unplayed future fixture', () => {
  clearDb();
  assert.throws(() => db.prepare(`INSERT INTO matches(external_key,date,season,home_team,away_team,home_score,away_score) VALUES('bad','2028-01-01','2025/26','A','B',1,0)`).run(), /compatibile con la stagione/);
  assert.doesNotThrow(() => db.prepare(`INSERT INTO matches(external_key,date,season,home_team,away_team) VALUES('future','2028-01-01','2025/26','A','B')`).run());
});

test('database rejects impossible event and player-stat values', () => {
  clearDb();
  const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,home_team,away_team) VALUES(?,?,?,?,?)`).run('validation','2020-10-01','2020/21','U.S. Sassuolo Calcio','Roma').lastInsertRowid);
  assert.throws(() => db.prepare(`INSERT INTO match_events(match_id,provider_match_id,minute,type) VALUES(?,?,?,?)`).run(matchId,'fixture',-5,'Card'), /Minuto evento non valido/);
  const playerId=Number(db.prepare(`INSERT INTO players(name) VALUES('Validation Player')`).run().lastInsertRowid);
  assert.throws(() => db.prepare(`INSERT INTO player_seasons(player_id,season,competition,minutes) VALUES(?,?,?,?)`).run(playerId,'2020/21','Serie A',-1), /Statistica giocatore non valida/);
});

test('kickoff normalizes unknown or impossible event minutes without weakening database validation', () => {
  assert.equal(normalizeKickoffEventMinute(-5), null);
  assert.equal(normalizeKickoffEventMinute(131), null);
  assert.equal(normalizeKickoffEventMinute(92), 92);
  assert.equal(normalizeKickoffEventMinute(31, true), null);
  assert.equal(normalizeKickoffEventMinute(4, true), 4);
});

test('event provenance and curator audit tables are available for manual verification', () => {
  clearDb();
  const matchId=Number(db.prepare(`INSERT INTO matches(external_key,date,season,home_team,away_team) VALUES(?,?,?,?,?)`).run('provenance','2025-10-03','2025/26','Verona','U.S. Sassuolo Calcio').lastInsertRowid);
  const eventId=Number(db.prepare(`INSERT INTO match_events(match_id,source_provider,provider_match_id,minute,player_name,type,detail,source_url,verification_note,verified_by,last_verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(matchId,'manual','fixture',71,'Walid Cheddira','Card','Yellow Card','https://example.test/report','Video/referto controllato','Curatore','2026-08-09T00:00:00.000Z').lastInsertRowid);
  db.prepare(`INSERT INTO source_references(entity_type,entity_id,field,source_url,note,verified_at,created_at) VALUES(?,?,?,?,?,?,?)`).run('match_event',eventId,'minute','https://example.test/report','Video/referto controllato','2026-08-09T00:00:00.000Z','2026-08-09T00:00:00.000Z');
  db.prepare(`INSERT INTO change_log(entity_type,entity_id,action,after_json,created_at) VALUES(?,?,?,?,?)`).run('match_event',eventId,'update','{}','2026-08-09T00:00:00.000Z');
  assert.equal((db.prepare(`SELECT source_url FROM match_events WHERE id=?`).get(eventId) as any).source_url,'https://example.test/report');
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM source_references WHERE entity_type='match_event' AND entity_id=?`).get(eventId) as any).count,1);
  assert.equal((db.prepare(`SELECT COUNT(*) AS count FROM change_log WHERE entity_type='match_event' AND entity_id=?`).get(eventId) as any).count,1);
});

test('statistics services calculate H2H, streaks, and Hall of Fame from deterministic fixtures', () => {
  clearDb();
  const insert = db.prepare(`INSERT INTO matches(external_key,date,season,competition,home_team,away_team,home_score,away_score) VALUES(?,?,?,?,?,?,?,?)`);
  insert.run('a', '2020-09-01', '2020/21', 'Serie A', 'U.S. Sassuolo Calcio', 'Roma', 2, 1);
  insert.run('b', '2020-09-08', '2020/21', 'Serie A', 'U.S. Sassuolo Calcio', 'Milan', 3, 0);
  insert.run('c', '2020-09-15', '2020/21', 'Serie A', 'Inter', 'U.S. Sassuolo Calcio', 2, 0);
  insert.run('d', '2020-09-22', '2020/21', 'Serie A', 'U.S. Sassuolo Calcio', 'AC Milan', 1, 0);
  const h2h = headToHead('Milan');
  assert.equal(h2h.played, 2); assert.equal(h2h.wins, 2); assert.equal(h2h.currentStreak, 'W x2');
  assert.equal(records().longestWinningStreak, 2);

  const playerId = Number(db.prepare(`INSERT INTO players(name) VALUES('Domenico Berardi')`).run().lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals) VALUES(?,?,?,?,?)`).run(playerId, '2020/21', 'Serie A', 30, 17);
  recomputeDerivedPlayerStats();
  const hall = hallOfFame() as any;
  assert.equal(hall.goals[0].name, 'Domenico Berardi');
  assert.equal(hall.singleSeasonGoals[0].goals, 17);
  assert.equal(hall.byCompetition['Serie A'].goals[0].name, 'Domenico Berardi');
  assert.deepEqual(hall.byCompetition['Coppa Italia'].goals, []);
});

test('Hall of Fame exposes own goals and negative-statistics leaders', () => {
  clearDb();
  const playerId = Number(db.prepare(`INSERT INTO players(name) VALUES('Negative Stats Player')`).run().lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,own_goals,yellow_cards,red_cards,fouls_committed) VALUES(?,?,?,?,?,?,?)`).run(playerId, '2020/21', 'Serie A', 2, 5, 1, 12);
  recomputeDerivedPlayerStats();
  const hall = hallOfFame({ competition: 'Serie A' }) as any;
  assert.equal(hall.negative.own_goals[0].own_goals, 2);
  assert.equal(hall.negative.yellow_cards[0].yellow_cards, 5);
  assert.equal(hall.negative.red_cards[0].red_cards, 1);
  assert.equal(hall.negative.fouls_committed[0].fouls_committed, 12);
  assert.equal((db.prepare(`SELECT own_goals FROM players WHERE id=?`).get(playerId) as any).own_goals, 2);
});

test('P1 archive metadata keeps provider identities and match coverage explicit', () => {
  clearDb();
  const playerId=Number(db.prepare(`INSERT INTO players(name,source_provider,source_external_id) VALUES(?,?,?)`).run('Mario Rossi','FBref','abc-123').lastInsertRowid);
  db.prepare(`INSERT INTO player_source_ids(player_id,source_provider,source_player_id) VALUES(?,?,?)`).run(playerId,'FBref','abc-123');
  assert.equal((db.prepare(`SELECT player_id FROM player_source_ids WHERE source_provider='FBref' AND source_player_id='abc-123'`).get() as any).player_id,playerId);
  db.prepare(`INSERT INTO matches(external_key,date,season,home_team,away_team,home_score,away_score,halftime_score) VALUES(?,?,?,?,?,?,?,?)`).run('coverage','2020-10-01','2020/21','U.S. Sassuolo Calcio','Roma',1,0,'1-0');
  assert.equal((db.prepare(`SELECT completeness_level FROM matches WHERE external_key='coverage'`).get() as any).completeness_level,'STANDARD');
});

test('player positions normalize provider abbreviations into one squad taxonomy', () => {
  assert.equal(normalizePlayerPosition('G'), 'Goalkeeper');
  assert.equal(normalizePlayerPosition('goalkeeper'), 'Goalkeeper');
  assert.equal(normalizePlayerPosition('F'), 'Attacker');
  assert.equal(normalizePlayerPosition('forward'), 'Attacker');
  assert.equal(normalizePlayerPosition('M'), 'Midfielder');
  assert.equal(normalizePlayerPosition('MF'), 'Midfielder');
});

test('Hall of Fame filters by season and role without converting NULL into zero', () => {
  clearDb();
  const a=Number(db.prepare(`INSERT INTO players(name,position) VALUES(?,?)`).run('Filter Attacker','Attacker').lastInsertRowid);
  const b=Number(db.prepare(`INSERT INTO players(name,position) VALUES(?,?)`).run('Filter Defender','Defender').lastInsertRowid);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals) VALUES(?,?,?,?,?)`).run(a,'2022/23','Serie A',20,5);
  db.prepare(`INSERT INTO player_seasons(player_id,season,competition,appearances,goals) VALUES(?,?,?,?,?)`).run(b,'2022/23','Serie A',null,null);
  const hall=hallOfFame({season:'2022/23',position:'Attacker',minGoals:1}) as any;
  assert.equal(hall.goals[0].name,'Filter Attacker');
  assert.equal(hall.byCompetition['Serie A'].goals.length,1);
});

test('combined Hall of Fame rankings aggregate one player across seasons', () => {
  clearDb();
  const playerId=Number(db.prepare(`INSERT INTO players(name,position) VALUES(?,?)`).run('A. Consigli','Goalkeeper').lastInsertRowid);
  const insert=db.prepare(`INSERT INTO player_seasons(player_id,season,competition,minutes) VALUES(?,?,?,?)`);
  insert.run(playerId,'2022/23','Serie A',3150);
  insert.run(playerId,'2023/24','Serie A',3150);
  const hall=hallOfFame({competition:'Serie A'}) as any;
  assert.equal(hall.minutes.length,1);
  assert.equal(hall.minutes[0].name,'A. Consigli');
  assert.equal(hall.minutes[0].minutes,6300);
});

test('transfer identity ignores provider publication date within the same season', () => {
  clearDb();
  const insert=db.prepare(`INSERT INTO transfers(external_key,player_name,date,type,direction,from_team_name,to_team_name,season,source_provider) VALUES(?,?,?,?,?,?,?,?,?)`);
  insert.run('one','B. Knezovic','2026-07-19','Transfer','OUT','Sassuolo','Casarano','2026/27','api-football');
  assert.throws(() => insert.run('two','B. Knezovic','2026-07-20','Transfer','OUT','Sassuolo','Casarano','2026/27','api-football'), /UNIQUE constraint failed/);
});
