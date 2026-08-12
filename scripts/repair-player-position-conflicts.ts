import { createBackupSnapshot, db, nowIso, recordChange } from '../server/db/database.js';

const ALESSANDRO_RUSSO_API_ID = 30766;
const FLAVIO_RUSSO_API_ID = 330758;
const russoSource = 'https://www.sassuolocalcio.it/wp-content/uploads/match-program/2022-23/170_Sassuolo-Udinese.pdf';
const kiriakopoulosSource = 'https://www.epo.gr/en/mens-national-team/kyriakopoulos-giorgos';

const flavio = db.prepare(`SELECT * FROM players WHERE api_football_id=?`).get(FLAVIO_RUSSO_API_ID) as any;
const kiriakopoulos = db.prepare(`SELECT * FROM players WHERE name=?`).get('Giorgos Kiriakopoulos') as any;
if (!flavio) throw new Error('Flavio Russo (API 330758) non trovato');

const backup = createBackupSnapshot('repair-player-position-conflicts');
const result = db.transaction(() => {
  let alessandro = db.prepare(`SELECT * FROM players WHERE api_football_id=? OR name=? ORDER BY api_football_id=? DESC LIMIT 1`)
    .get(ALESSANDRO_RUSSO_API_ID, 'Alessandro Russo', ALESSANDRO_RUSSO_API_ID) as any;
  if (!alessandro) {
    const inserted = db.prepare(`INSERT INTO players(api_football_id,name,firstname,lastname,nationality,birth_date,position,current_squad,source_provider,source_external_id,source_url,last_verified_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(ALESSANDRO_RUSSO_API_ID, 'Alessandro Russo', 'Alessandro', 'Russo', 'Italy', '2001-03-31', 'Goalkeeper', 0, 'api-football', String(ALESSANDRO_RUSSO_API_ID), russoSource, nowIso());
    alessandro = db.prepare(`SELECT * FROM players WHERE id=?`).get(Number(inserted.lastInsertRowid));
  } else {
    db.prepare(`UPDATE players SET api_football_id=?,firstname=COALESCE(firstname,'Alessandro'),lastname=COALESCE(lastname,'Russo'),nationality=COALESCE(nationality,'Italy'),birth_date=COALESCE(birth_date,'2001-03-31'),position='Goalkeeper',source_external_id=COALESCE(source_external_id,?),source_url=COALESCE(source_url,?),last_verified_at=? WHERE id=?`)
      .run(ALESSANDRO_RUSSO_API_ID, String(ALESSANDRO_RUSSO_API_ID), russoSource, nowIso(), alessandro.id);
  }

  const collision = db.prepare(`SELECT ps.season,ps.competition FROM player_seasons ps WHERE ps.player_id=? AND EXISTS(SELECT 1 FROM player_seasons target WHERE target.player_id=? AND target.season=ps.season AND target.competition=ps.competition)`).get(flavio.id, alessandro.id);
  if (collision) throw new Error(`Conflitto player_seasons durante lo split: ${JSON.stringify(collision)}`);

  db.prepare(`UPDATE player_source_ids SET player_id=?,source_url=COALESCE(source_url,?),last_verified_at=? WHERE source_provider='api-football' AND source_player_id=?`)
    .run(alessandro.id, russoSource, nowIso(), String(ALESSANDRO_RUSSO_API_ID));
  db.prepare(`INSERT OR IGNORE INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at) VALUES(?,?,?,?,?)`)
    .run(alessandro.id, 'api-football', String(ALESSANDRO_RUSSO_API_ID), russoSource, nowIso());

  const seasons = db.prepare(`UPDATE player_seasons SET player_id=? WHERE player_id=? AND position='Goalkeeper'`).run(alessandro.id, flavio.id).changes;
  const stats = db.prepare(`UPDATE match_player_stats SET player_id=?,player_name='Alessandro Russo' WHERE player_id=? AND (provider_player_id=? OR api_football_player_id=?)`)
    .run(alessandro.id, flavio.id, String(ALESSANDRO_RUSSO_API_ID), ALESSANDRO_RUSSO_API_ID).changes;
  const events = db.prepare(`UPDATE match_events SET player_id=?,player_name='Alessandro Russo' WHERE player_id=? AND (player_provider_id=? OR player_api_id=?)`)
    .run(alessandro.id, flavio.id, String(ALESSANDRO_RUSSO_API_ID), ALESSANDRO_RUSSO_API_ID).changes;
  const assists = db.prepare(`UPDATE match_events SET assist_player_id=?,assist_name='Alessandro Russo' WHERE assist_player_id=? AND (assist_player_provider_id=? OR assist_player_api_id=?)`)
    .run(alessandro.id, flavio.id, String(ALESSANDRO_RUSSO_API_ID), ALESSANDRO_RUSSO_API_ID).changes;
  const injuries = db.prepare(`UPDATE match_injuries SET player_id=?,player_name='Alessandro Russo' WHERE player_id=? AND player_api_id=?`)
    .run(alessandro.id, flavio.id, ALESSANDRO_RUSSO_API_ID).changes;
  const transfers = db.prepare(`UPDATE transfers SET player_id=?,player_name='Alessandro Russo' WHERE player_id=? AND api_football_player_id=?`)
    .run(alessandro.id, flavio.id, ALESSANDRO_RUSSO_API_ID).changes;

  if (kiriakopoulos && kiriakopoulos.position !== 'Defender') {
    db.prepare(`UPDATE players SET position='Defender',source_url=?,last_verified_at=? WHERE id=?`).run(kiriakopoulosSource, nowIso(), kiriakopoulos.id);
    recordChange({ entityType: 'players', entityId: kiriakopoulos.id, action: 'update', before: { position: kiriakopoulos.position }, after: { position: 'Defender' }, sourceUrl: kiriakopoulosSource, note: 'Ruolo canonico verificato: difensore/terzino sinistro.', author: 'position-audit', backupId: backup.id });
  }

  recordChange({ entityType: 'players', entityId: alessandro.id, action: 'create', before: { mergedIntoPlayerId: flavio.id, wrongName: 'Flavio Russo' }, after: { name: 'Alessandro Russo', position: 'Goalkeeper', apiFootballId: ALESSANDRO_RUSSO_API_ID, moved: { seasons, stats, events, assists, injuries, transfers } }, sourceUrl: russoSource, note: 'Separata collisione omonimica tra il portiere Alessandro Russo e l’attaccante Flavio Russo.', author: 'position-audit', backupId: backup.id });
  return { backup, alessandroId: alessandro.id, flavioId: flavio.id, moved: { seasons, stats, events, assists, injuries, transfers }, kiriakopoulosUpdated: Boolean(kiriakopoulos && kiriakopoulos.position !== 'Defender') };
})();

console.log(JSON.stringify(result, null, 2));
