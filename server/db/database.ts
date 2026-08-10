import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const defaultDbPath = path.resolve('server/db/sassuolo.db');
const dbPath = path.resolve(process.env.SASSUOLO_DB_PATH || defaultDbPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// An explicit path keeps automated tests isolated from the application archive.
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function normalizePlayerName(value: unknown): string {
  return String(value ?? '').replace(/&apos;|&#39;|&#x27;/gi, "'").trim();
}

function columnNames(table: string) {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[]).map(c => c.name));
}

function ensureColumn(table: string, definition: string) {
  const name = definition.trim().split(/\s+/)[0];
  if (!columnNames(table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL UNIQUE,
      short_name TEXT,
      country TEXT,
      badge_url TEXT,
      api_football_id INTEGER UNIQUE
    );

    CREATE TABLE IF NOT EXISTS team_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      alias TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season TEXT NOT NULL,
      competition TEXT NOT NULL DEFAULT 'Serie A',
      final_position INTEGER,
      matches INTEGER,
      wins INTEGER,
      draws INTEGER,
      losses INTEGER,
      goals_for INTEGER,
      goals_against INTEGER,
      points INTEGER,
      own_goals_for INTEGER,
      own_goals_against INTEGER,
      manager TEXT,
      stadium TEXT,
      top_scorer TEXT,
      top_assists TEXT,
      home_record TEXT,
      away_record TEXT,
      api_football_league_id INTEGER,
      api_football_season_year INTEGER,
      api_football_coverage_json TEXT,
      source_provider TEXT,
      source_url TEXT,
      last_verified_at TEXT,
      UNIQUE(season, competition)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_key TEXT UNIQUE,
      date TEXT NOT NULL,
      season TEXT,
      competition TEXT,
      round TEXT,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      halftime_score TEXT,
      scorers TEXT,
      assists TEXT,
      cards TEXT,
      stadium TEXT,
      attendance INTEGER,
      referee TEXT,
      possession_home REAL,
      possession_away REAL,
      shots_home INTEGER,
      shots_away INTEGER,
      shots_on_target_home INTEGER,
      shots_on_target_away INTEGER,
      corners_home INTEGER,
      corners_away INTEGER,
      fouls_home INTEGER,
      fouls_away INTEGER,
      xg_home REAL,
      xg_away REAL,
      completeness_level TEXT NOT NULL DEFAULT 'BASIC' CHECK(completeness_level IN ('BASIC','STANDARD','DETAILED')),
      source_provider TEXT,
      source_external_id TEXT,
      source_url TEXT,
      last_verified_at TEXT
    );

    -- A provider identifier is the durable identity of a player.  Names are
    -- labels, not keys: they can be shared by two people and vary by accents.
    CREATE TABLE IF NOT EXISTS player_source_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL,
      source_player_id TEXT NOT NULL,
      source_url TEXT,
      last_verified_at TEXT,
      UNIQUE(source_provider, source_player_id)
    );
    CREATE INDEX IF NOT EXISTS idx_player_source_ids_player ON player_source_ids(player_id);

    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
    CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season);
    CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches(home_team, away_team);

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_football_id INTEGER UNIQUE,
      name TEXT NOT NULL UNIQUE,
      firstname TEXT,
      lastname TEXT,
      nationality TEXT,
      birth_date TEXT,
      birth_place TEXT,
      birth_country TEXT,
      age INTEGER,
      height TEXT,
      weight TEXT,
      photo_url TEXT,
      position TEXT,
      shirt_number INTEGER,
      injured INTEGER NOT NULL DEFAULT 0,
      first_appearance TEXT,
      last_appearance TEXT,
      appearances INTEGER,
      starts INTEGER,
      minutes INTEGER,
      goals INTEGER,
      own_goals INTEGER,
      assists INTEGER,
      yellow_cards INTEGER,
      red_cards INTEGER,
      clean_sheets INTEGER,
      current_squad INTEGER NOT NULL DEFAULT 0,
      source_provider TEXT,
      source_external_id TEXT,
      source_url TEXT,
      last_verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS player_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      season TEXT NOT NULL,
      competition TEXT NOT NULL DEFAULT 'Serie A',
      api_football_league_id INTEGER,
      appearances INTEGER,
      starts INTEGER,
      minutes INTEGER,
      shirt_number INTEGER,
      position TEXT,
      rating REAL,
      captain INTEGER,
      substitutes_in INTEGER,
      substitutes_out INTEGER,
      substitutes_bench INTEGER,
      shots_total INTEGER,
      shots_on INTEGER,
      goals INTEGER,
      goals_conceded INTEGER,
      assists INTEGER,
      saves INTEGER,
      passes_total INTEGER,
      passes_key INTEGER,
      pass_accuracy REAL,
      tackles_total INTEGER,
      blocks INTEGER,
      interceptions INTEGER,
      duels_total INTEGER,
      duels_won INTEGER,
      dribbles_attempts INTEGER,
      dribbles_success INTEGER,
      fouls_drawn INTEGER,
      fouls_committed INTEGER,
      yellow_cards INTEGER,
      yellow_red_cards INTEGER,
      red_cards INTEGER,
      penalty_won INTEGER,
      penalty_committed INTEGER,
      penalty_scored INTEGER,
      penalty_missed INTEGER,
      penalty_saved INTEGER,
      clean_sheets INTEGER,
      source_provider TEXT,
      last_verified_at TEXT,
      UNIQUE(player_id, season, competition)
    );

    CREATE INDEX IF NOT EXISTS idx_player_seasons_season ON player_seasons(season, competition);
    CREATE INDEX IF NOT EXISTS idx_player_seasons_player ON player_seasons(player_id);

    CREATE TABLE IF NOT EXISTS season_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season TEXT NOT NULL,
      competition TEXT NOT NULL,
      api_football_league_id INTEGER,
      api_football_team_id INTEGER NOT NULL,
      team_name TEXT NOT NULL,
      team_logo TEXT,
      rank INTEGER,
      points INTEGER,
      goals_diff INTEGER,
      form TEXT,
      status TEXT,
      description TEXT,
      group_name TEXT,
      played INTEGER,
      wins INTEGER,
      draws INTEGER,
      losses INTEGER,
      goals_for INTEGER,
      goals_against INTEGER,
      home_played INTEGER,
      home_wins INTEGER,
      home_draws INTEGER,
      home_losses INTEGER,
      home_goals_for INTEGER,
      home_goals_against INTEGER,
      away_played INTEGER,
      away_wins INTEGER,
      away_draws INTEGER,
      away_losses INTEGER,
      away_goals_for INTEGER,
      away_goals_against INTEGER,
      source_provider TEXT,
      last_verified_at TEXT,
      UNIQUE(season, competition, api_football_team_id, group_name)
    );

    CREATE INDEX IF NOT EXISTS idx_standings_season ON season_standings(season, competition, rank);

    CREATE TABLE IF NOT EXISTS team_season_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season TEXT NOT NULL,
      competition TEXT NOT NULL,
      api_football_league_id INTEGER,
      form TEXT,
      played INTEGER,
      wins INTEGER,
      draws INTEGER,
      losses INTEGER,
      goals_for INTEGER,
      goals_against INTEGER,
      goals_for_avg REAL,
      goals_against_avg REAL,
      clean_sheets INTEGER,
      failed_to_score INTEGER,
      biggest_win_home TEXT,
      biggest_win_away TEXT,
      biggest_loss_home TEXT,
      biggest_loss_away TEXT,
      longest_win_streak INTEGER,
      longest_draw_streak INTEGER,
      longest_loss_streak INTEGER,
      penalties_scored INTEGER,
      penalties_missed INTEGER,
      lineups_json TEXT,
      raw_json TEXT,
      source_provider TEXT,
      last_verified_at TEXT,
      UNIQUE(season, competition)
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_key TEXT NOT NULL UNIQUE,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      api_football_player_id INTEGER,
      player_name TEXT NOT NULL,
      date TEXT,
      type TEXT,
      direction TEXT,
      from_team_id INTEGER,
      from_team_name TEXT,
      from_team_logo TEXT,
      to_team_id INTEGER,
      to_team_name TEXT,
      to_team_logo TEXT,
      season TEXT,
      source_provider TEXT,
      last_verified_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
    CREATE INDEX IF NOT EXISTS idx_transfers_season ON transfers(season);
    CREATE INDEX IF NOT EXISTS idx_transfers_player ON transfers(player_id);

    CREATE TABLE IF NOT EXISTS match_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      provider_match_id TEXT NOT NULL,
      api_fixture_id INTEGER,
      timezone TEXT,
      kickoff_timestamp INTEGER,
      status_long TEXT,
      status_short TEXT,
      elapsed INTEGER,
      venue_name TEXT,
      venue_city TEXT,
      league_name TEXT,
      league_country TEXT,
      league_round TEXT,
      home_team_provider_id TEXT,
      home_team_name TEXT,
      home_team_logo TEXT,
      away_team_provider_id TEXT,
      away_team_name TEXT,
      away_team_logo TEXT,
      goals_home INTEGER,
      goals_away INTEGER,
      halftime_home INTEGER,
      halftime_away INTEGER,
      fulltime_home INTEGER,
      fulltime_away INTEGER,
      raw_json TEXT,
      last_verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      provider_match_id TEXT NOT NULL,
      provider_event_id TEXT,
      api_fixture_id INTEGER,
      minute INTEGER,
      extra_minute INTEGER,
      sequence_number INTEGER,
      team_provider_id TEXT,
      team_api_id INTEGER,
      team_name TEXT,
      team_logo TEXT,
      player_provider_id TEXT,
      player_api_id INTEGER,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      player_name TEXT,
      assist_player_provider_id TEXT,
      assist_player_api_id INTEGER,
      assist_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      assist_name TEXT,
      type TEXT,
      detail TEXT,
      comments TEXT,
      scoring_play INTEGER,
      home_score INTEGER,
      away_score INTEGER,
      scoring_team_name TEXT,
      is_own_goal INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id, minute, extra_minute);

    CREATE TABLE IF NOT EXISTS match_lineups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      provider_match_id TEXT NOT NULL,
      api_fixture_id INTEGER,
      provider_team_id TEXT,
      team_api_id INTEGER NOT NULL,
      team_name TEXT,
      team_logo TEXT,
      formation TEXT,
      coach_name TEXT,
      colors_json TEXT,
      start_xi_json TEXT,
      substitutes_json TEXT,
      raw_json TEXT,
      UNIQUE(match_id, team_api_id)
    );

    CREATE TABLE IF NOT EXISTS match_team_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      provider_match_id TEXT NOT NULL,
      api_fixture_id INTEGER,
      provider_team_id TEXT,
      team_api_id INTEGER NOT NULL,
      team_name TEXT,
      team_logo TEXT,
      stats_json TEXT NOT NULL,
      raw_json TEXT,
      UNIQUE(match_id, team_api_id)
    );

    CREATE TABLE IF NOT EXISTS match_player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      provider_match_id TEXT NOT NULL,
      api_fixture_id INTEGER,
      provider_team_id TEXT,
      team_api_id INTEGER,
      team_name TEXT,
      team_logo TEXT,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      provider_player_id TEXT,
      api_football_player_id INTEGER,
      player_name TEXT NOT NULL,
      player_photo TEXT,
      minutes INTEGER,
      shirt_number INTEGER,
      position TEXT,
      rating REAL,
      captain INTEGER,
      substitute INTEGER,
      offsides INTEGER,
      shots_total INTEGER,
      shots_on INTEGER,
      goals INTEGER,
      goals_conceded INTEGER,
      assists INTEGER,
      saves INTEGER,
      passes_total INTEGER,
      passes_key INTEGER,
      pass_accuracy REAL,
      tackles_total INTEGER,
      blocks INTEGER,
      interceptions INTEGER,
      duels_total INTEGER,
      duels_won INTEGER,
      dribbles_attempts INTEGER,
      dribbles_success INTEGER,
      dribbles_past INTEGER,
      fouls_drawn INTEGER,
      fouls_committed INTEGER,
      yellow_cards INTEGER,
      red_cards INTEGER,
      penalty_won INTEGER,
      penalty_committed INTEGER,
      penalty_scored INTEGER,
      penalty_missed INTEGER,
      penalty_saved INTEGER,
      statistics_json TEXT,
      UNIQUE(match_id, api_football_player_id, team_api_id)
    );

    CREATE INDEX IF NOT EXISTS idx_match_player_stats_match ON match_player_stats(match_id, team_api_id);
    CREATE INDEX IF NOT EXISTS idx_match_player_stats_player ON match_player_stats(player_id);

    CREATE TABLE IF NOT EXISTS match_injuries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      source_provider TEXT NOT NULL DEFAULT 'unknown',
      provider_match_id TEXT NOT NULL,
      api_fixture_id INTEGER,
      team_api_id INTEGER,
      team_name TEXT,
      player_api_id INTEGER,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      player_name TEXT NOT NULL,
      type TEXT,
      reason TEXT,
      start_date TEXT,
      end_date TEXT,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_match_injuries_match ON match_injuries(match_id, team_api_id);

    CREATE TABLE IF NOT EXISTS news_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      normalized_title TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT,
      published_at TEXT,
      description TEXT,
      image_url TEXT,
      cached_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);

    CREATE TABLE IF NOT EXISTS sync_state (
      provider TEXT NOT NULL,
      resource TEXT NOT NULL,
      requests_used INTEGER NOT NULL DEFAULT 0,
      estimated_remaining INTEGER,
      last_request TEXT,
      last_successful_sync TEXT,
      last_error TEXT,
      PRIMARY KEY(provider, resource)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      provider TEXT,
      created_at TEXT NOT NULL
    );

    -- Provenance is kept independently from the provider payload so a manual
    -- verification can be reviewed without overwriting the original record.
    CREATE TABLE IF NOT EXISTS source_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      field TEXT,
      source_url TEXT NOT NULL,
      note TEXT,
      author TEXT,
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_source_references_entity ON source_references(entity_type, entity_id, field);

    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      source_url TEXT,
      note TEXT,
      author TEXT,
      backup_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity_type, entity_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS backup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reason TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- One row per controlled import/sync. This is the operational ledger:
    -- payload tables remain the source of data, while this table explains
    -- how and when a payload reached the database.
    CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK(kind IN ('provider_sync','candidate_import','local_import','manual_change','dedupe')),
      source_provider TEXT,
      area TEXT,
      season TEXT,
      competition TEXT,
      candidate_path TEXT,
      manifest_sha256 TEXT,
      status TEXT NOT NULL CHECK(status IN ('planned','running','succeeded','partial','failed','rejected','rolled_back')),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      records_seen INTEGER NOT NULL DEFAULT 0,
      records_created INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_skipped INTEGER NOT NULL DEFAULT 0,
      records_rejected INTEGER NOT NULL DEFAULT 0,
      backup_id INTEGER REFERENCES backup_runs(id),
      audit_run_id INTEGER,
      diff_json TEXT,
      error_text TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_import_runs_status ON import_runs(status, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_import_runs_scope ON import_runs(area, season, competition, started_at DESC);

    CREATE TABLE IF NOT EXISTS audit_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_type TEXT NOT NULL DEFAULT 'full',
      status TEXT NOT NULL CHECK(status IN ('succeeded','failed')),
      generated_at TEXT NOT NULL,
      report_path TEXT,
      report_sha256 TEXT,
      issue_count INTEGER NOT NULL DEFAULT 0,
      blocking_issue_count INTEGER NOT NULL DEFAULT 0,
      table_counts_json TEXT,
      issues_json TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_runs_generated ON audit_runs(generated_at DESC);

    CREATE TABLE IF NOT EXISTS research_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_path TEXT NOT NULL UNIQUE,
      area TEXT NOT NULL,
      season TEXT,
      competition TEXT,
      source_provider TEXT,
      source_url TEXT,
      manifest_sha256 TEXT,
      status TEXT NOT NULL CHECK(status IN ('discovered','candidate','validated','in_review','approved','imported','rejected','superseded')),
      records_total INTEGER,
      records_discarded INTEGER,
      fields_covered_json TEXT,
      validation_status TEXT,
      last_seen_at TEXT NOT NULL,
      imported_at TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_research_candidates_status ON research_candidates(status, last_seen_at DESC);
  `);
  for (const table of ['players', 'transfers', 'match_events', 'match_lineups', 'match_injuries', 'match_player_stats']) {
    const column = table === 'players' ? 'name' : 'player_name';
    if (columnNames(table).has(column)) db.prepare(`UPDATE ${table} SET ${column}=replace(replace(replace(${column}, '&apos;', char(39)), '&#39;', char(39)), '&#x27;', char(39)) WHERE ${column} LIKE '%&apos;%' OR ${column} LIKE '%&#39;%' OR ${column} LIKE '%&#x27;%'`).run();
  }

  // Lightweight migrations from v1/v2 databases.
  ensureColumn('teams', 'api_football_id INTEGER');
  ensureColumn('seasons', 'api_football_league_id INTEGER');
  ensureColumn('seasons', 'api_football_season_year INTEGER');
  ensureColumn('seasons', 'api_football_coverage_json TEXT');
  ensureColumn('seasons', 'stadium TEXT');
  ensureColumn('matches', 'bigballs_match_id TEXT');
  // Kept only so old Big Balls rows can be identified and cleaned safely.
  ensureColumn('matches', 'kickoff_fixture_id INTEGER');
  ensureColumn('matches', "completeness_level TEXT NOT NULL DEFAULT 'BASIC' CHECK(completeness_level IN ('BASIC','STANDARD','DETAILED'))");
  ensureColumn('data_conflicts', 'status TEXT NOT NULL DEFAULT \'open\'');
  ensureColumn('data_conflicts', 'resolved_value TEXT');
  ensureColumn('data_conflicts', 'resolved_at TEXT');

  for (const definition of [
    'api_football_id INTEGER', 'firstname TEXT', 'lastname TEXT', 'birth_place TEXT', 'birth_country TEXT', 'own_goals INTEGER',
    'age INTEGER', 'height TEXT', 'weight TEXT', 'photo_url TEXT', 'injured INTEGER NOT NULL DEFAULT 0'
  ]) ensureColumn('players', definition);

  for (const definition of [
    'api_football_league_id INTEGER', 'shirt_number INTEGER', 'position TEXT', 'rating REAL', 'captain INTEGER',
    'substitutes_in INTEGER', 'substitutes_out INTEGER', 'substitutes_bench INTEGER', 'shots_total INTEGER', 'shots_on INTEGER',
    'goals_conceded INTEGER', 'own_goals INTEGER', 'saves INTEGER', 'passes_total INTEGER', 'passes_key INTEGER', 'pass_accuracy REAL',
    'tackles_total INTEGER', 'blocks INTEGER', 'interceptions INTEGER', 'duels_total INTEGER', 'duels_won INTEGER',
    'dribbles_attempts INTEGER', 'dribbles_success INTEGER', 'fouls_drawn INTEGER', 'fouls_committed INTEGER',
    'yellow_red_cards INTEGER', 'penalty_won INTEGER', 'penalty_committed INTEGER', 'penalty_scored INTEGER',
    'penalty_missed INTEGER', 'penalty_saved INTEGER', 'source_provider TEXT', 'source_url TEXT', 'last_verified_at TEXT'
  ]) ensureColumn('player_seasons', definition);
  ensureColumn('transfers', 'source_url TEXT');

  // Provider-aware match detail columns. These are additive so the patch also
  // works on databases created by the previous API-Football match-detail patch.
  for (const definition of [
    'source_provider TEXT', 'provider_match_id TEXT', 'home_team_provider_id TEXT', 'away_team_provider_id TEXT',
    'deep_stats_synced INTEGER', 'events_synced INTEGER NOT NULL DEFAULT 0', 'lineups_synced INTEGER NOT NULL DEFAULT 0',
    'team_stats_synced INTEGER NOT NULL DEFAULT 0', 'player_stats_synced INTEGER NOT NULL DEFAULT 0',
    'injuries_synced INTEGER NOT NULL DEFAULT 0', 'venue_synced INTEGER NOT NULL DEFAULT 0', 'coaches_synced INTEGER NOT NULL DEFAULT 0'
  ]) ensureColumn('match_details', definition);
  for (const definition of [
    'source_provider TEXT', 'provider_match_id TEXT', 'provider_event_id TEXT', 'sequence_number INTEGER',
    'team_provider_id TEXT', 'player_provider_id TEXT', 'assist_player_provider_id TEXT',
    'scoring_play INTEGER', 'home_score INTEGER', 'away_score INTEGER', 'source_url TEXT',
    'verification_note TEXT', 'verified_by TEXT', 'last_verified_at TEXT'
  ]) ensureColumn('match_events', definition);
  for (const definition of ['scoring_team_name TEXT', 'is_own_goal INTEGER']) ensureColumn('match_events', definition);
  for (const definition of ['own_goals_for INTEGER', 'own_goals_against INTEGER']) ensureColumn('seasons', definition);
  for (const definition of [
    'source_provider TEXT', 'provider_match_id TEXT', 'provider_team_id TEXT', 'raw_json TEXT'
  ]) ensureColumn('match_lineups', definition);
  for (const definition of [
    'source_provider TEXT', 'provider_match_id TEXT', 'provider_team_id TEXT', 'raw_json TEXT'
  ]) ensureColumn('match_team_stats', definition);
  for (const definition of [
    'source_provider TEXT', 'provider_match_id TEXT', 'provider_team_id TEXT', 'provider_player_id TEXT'
  ]) ensureColumn('match_player_stats', definition);

  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_api_football_id ON players(api_football_id) WHERE api_football_id IS NOT NULL`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_api_football_id ON teams(api_football_id) WHERE api_football_id IS NOT NULL`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_bigballs_id ON matches(bigballs_match_id) WHERE bigballs_match_id IS NOT NULL`); } catch {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_kickoff_fixture_id ON matches(kickoff_fixture_id) WHERE kickoff_fixture_id IS NOT NULL`); } catch {}
  db.exec(`INSERT OR IGNORE INTO player_source_ids(player_id,source_provider,source_player_id,source_url,last_verified_at)
    SELECT id, source_provider, source_external_id, source_url, last_verified_at
    FROM players WHERE source_provider IS NOT NULL AND source_external_id IS NOT NULL`);
  // A fixture has one identity regardless of provider or kickoff time formatting.
  // All writers normalize team names before persisting them; this index makes a
  // regression impossible even if a future importer misses the app-level check.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_fixture_identity ON matches(substr(date,1,10), lower(home_team), lower(away_team))`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_data_conflicts_dedupe ON data_conflicts(entity_type, entity_key, field, ifnull(old_value,''), ifnull(new_value,''), ifnull(provider,''))`);

  // One provider encoded an unknown card minute as -5. Keep the evidence and
  // expose it as NULL instead of inventing a minute.
  const invalidEvents = db.prepare(`SELECT id, minute, extra_minute, source_provider FROM match_events WHERE minute < 0 OR extra_minute < 0 OR minute > 130 OR extra_minute > 30`).all() as any[];
  for (const event of invalidEvents) {
    if (event.minute != null && (event.minute < 0 || event.minute > 130)) {
      recordDataConflict('match_event', String(event.id), 'minute', event.minute, null, event.source_provider ?? 'unknown');
      db.prepare(`UPDATE match_events SET minute=NULL WHERE id=?`).run(event.id);
    }
    if (event.extra_minute != null && (event.extra_minute < 0 || event.extra_minute > 30)) {
      recordDataConflict('match_event', String(event.id), 'extra_minute', event.extra_minute, null, event.source_provider ?? 'unknown');
      db.prepare(`UPDATE match_events SET extra_minute=NULL WHERE id=?`).run(event.id);
    }
  }

  // A curator can later verify an event whose provider minute was rejected.
  // Resolve only when the replacement is a valid, evidenced manual value;
  // unresolved records remain visible to the Data Manager.
  db.prepare(`UPDATE data_conflicts
    SET status='resolved', resolved_value=(SELECT CAST(e.minute AS TEXT) FROM match_events e WHERE e.id=CAST(data_conflicts.entity_key AS INTEGER)), resolved_at=?
    WHERE entity_type='match_event' AND field='minute' AND status='open'
      AND EXISTS(SELECT 1 FROM match_events e WHERE e.id=CAST(data_conflicts.entity_key AS INTEGER)
        AND e.source_provider='manual' AND e.minute IS NOT NULL AND e.source_url IS NOT NULL AND e.last_verified_at IS NOT NULL)`).run(nowIso());

  // CHECK constraints are not retrofitted by ALTER TABLE, so triggers protect
  // both the current archive and additive migrations.
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_match_event_insert
    BEFORE INSERT ON match_events
    WHEN NEW.minute < 0 OR NEW.minute > 130 OR NEW.extra_minute < 0 OR NEW.extra_minute > 30
    BEGIN SELECT RAISE(ABORT, 'Minuto evento non valido'); END;
    CREATE TRIGGER IF NOT EXISTS validate_match_event_update
    BEFORE UPDATE OF minute, extra_minute ON match_events
    WHEN NEW.minute < 0 OR NEW.minute > 130 OR NEW.extra_minute < 0 OR NEW.extra_minute > 30
    BEGIN SELECT RAISE(ABORT, 'Minuto evento non valido'); END;
    CREATE TRIGGER IF NOT EXISTS validate_player_season_stats_insert
    BEFORE INSERT ON player_seasons
    WHEN NEW.appearances < 0 OR NEW.starts < 0 OR NEW.minutes < 0 OR NEW.goals < 0 OR NEW.own_goals < 0 OR NEW.assists < 0 OR NEW.yellow_cards < 0 OR NEW.red_cards < 0
    BEGIN SELECT RAISE(ABORT, 'Statistica giocatore non valida'); END;
    CREATE TRIGGER IF NOT EXISTS validate_player_season_stats_update
    BEFORE UPDATE OF appearances, starts, minutes, goals, assists, yellow_cards, red_cards ON player_seasons
    WHEN NEW.appearances < 0 OR NEW.starts < 0 OR NEW.minutes < 0 OR NEW.goals < 0 OR NEW.own_goals < 0 OR NEW.assists < 0 OR NEW.yellow_cards < 0 OR NEW.red_cards < 0
    BEGIN SELECT RAISE(ABORT, 'Statistica giocatore non valida'); END;
    CREATE TRIGGER IF NOT EXISTS validate_match_player_stats_insert
    BEFORE INSERT ON match_player_stats
    WHEN NEW.minutes < 0 OR NEW.goals < 0 OR NEW.assists < 0 OR NEW.yellow_cards < 0 OR NEW.red_cards < 0
    BEGIN SELECT RAISE(ABORT, 'Statistica gara giocatore non valida'); END;
    CREATE TRIGGER IF NOT EXISTS validate_match_player_stats_update
    BEFORE UPDATE OF minutes, goals, assists, yellow_cards, red_cards ON match_player_stats
    WHEN NEW.minutes < 0 OR NEW.goals < 0 OR NEW.assists < 0 OR NEW.yellow_cards < 0 OR NEW.red_cards < 0
    BEGIN SELECT RAISE(ABORT, 'Statistica gara giocatore non valida'); END;
  `);

  // API-Football can publish the same movement twice with dates one day
  // apart. The transfer identity is the movement in a given season, not the
  // provider's publication date. Keep the newest row while migrating old
  // archives before creating the stricter unique index.
  db.exec(`DROP INDEX IF EXISTS idx_transfers_logical_identity`);
  db.exec(`
    DELETE FROM transfers AS unknown_season
    WHERE unknown_season.season IS NULL
      AND EXISTS (
        SELECT 1 FROM transfers AS known_season
        WHERE known_season.id <> unknown_season.id
          AND known_season.season IS NOT NULL
          AND lower(trim(known_season.player_name))=lower(trim(unknown_season.player_name))
          AND lower(trim(ifnull(known_season.from_team_name,'')))=lower(trim(ifnull(unknown_season.from_team_name,'')))
          AND lower(trim(ifnull(known_season.to_team_name,'')))=lower(trim(ifnull(unknown_season.to_team_name,'')))
          AND lower(trim(ifnull(known_season.type,'')))=lower(trim(ifnull(unknown_season.type,'')))
          AND lower(trim(ifnull(known_season.direction,'')))=lower(trim(ifnull(unknown_season.direction,'')))
          AND unknown_season.date IS NOT NULL AND known_season.date IS NOT NULL
          AND abs(julianday(known_season.date)-julianday(unknown_season.date)) <= 3
      )
  `);
  db.exec(`
    DELETE FROM transfers
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY lower(trim(player_name)), lower(trim(ifnull(from_team_name,''))),
            lower(trim(ifnull(to_team_name,''))), lower(trim(ifnull(type,''))),
            lower(trim(ifnull(direction,''))), ifnull(season,'')
          ORDER BY CASE WHEN source_provider='manual' THEN 0 ELSE 1 END,
            date DESC, id DESC
        ) AS duplicate_rank
        FROM transfers
      )
      WHERE duplicate_rank > 1
    )
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_logical_identity ON transfers(
    lower(trim(player_name)), lower(trim(ifnull(from_team_name,''))),
    lower(trim(ifnull(to_team_name,''))), lower(trim(ifnull(type,''))),
    lower(trim(ifnull(direction,''))), ifnull(season,'')
  )`);
  // Backfill the explicit coverage label for archives created before P1.
  db.exec(`
    UPDATE matches SET completeness_level = CASE
      WHEN EXISTS(SELECT 1 FROM match_events e WHERE e.match_id=matches.id)
        OR EXISTS(SELECT 1 FROM match_lineups l WHERE l.match_id=matches.id)
        OR EXISTS(SELECT 1 FROM match_team_stats t WHERE t.match_id=matches.id)
        OR EXISTS(SELECT 1 FROM match_player_stats p WHERE p.match_id=matches.id)
        THEN 'DETAILED'
      WHEN halftime_score IS NOT NULL OR cards IS NOT NULL OR referee IS NOT NULL
        OR shots_home IS NOT NULL OR possession_home IS NOT NULL OR corners_home IS NOT NULL
        THEN 'STANDARD'
      ELSE 'BASIC'
    END
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS set_match_completeness_after_insert
    AFTER INSERT ON matches
    BEGIN
      UPDATE matches SET completeness_level = CASE
        WHEN NEW.halftime_score IS NOT NULL OR NEW.cards IS NOT NULL OR NEW.referee IS NOT NULL
          OR NEW.shots_home IS NOT NULL OR NEW.possession_home IS NOT NULL OR NEW.corners_home IS NOT NULL
          THEN 'STANDARD' ELSE NEW.completeness_level END
      WHERE id=NEW.id AND NEW.completeness_level='BASIC';
    END;
  `);
  // Provider payloads alternate between abbreviated roles (G/D/M/F) and
  // English labels. Persist one taxonomy so a squad cannot be split twice.
  db.exec(`
    UPDATE players SET position = CASE lower(trim(position))
      WHEN 'g' THEN 'Goalkeeper' WHEN 'gk' THEN 'Goalkeeper' WHEN 'goalkeeper' THEN 'Goalkeeper' WHEN 'goal keeper' THEN 'Goalkeeper' WHEN 'keeper' THEN 'Goalkeeper'
      WHEN 'd' THEN 'Defender' WHEN 'defender' THEN 'Defender' WHEN 'defence' THEN 'Defender' WHEN 'defense' THEN 'Defender'
      WHEN 'm' THEN 'Midfielder' WHEN 'midfielder' THEN 'Midfielder' WHEN 'midfield' THEN 'Midfielder'
      WHEN 'f' THEN 'Attacker' WHEN 'fw' THEN 'Attacker' WHEN 'forward' THEN 'Attacker' WHEN 'attacker' THEN 'Attacker' WHEN 'striker' THEN 'Attacker'
      ELSE position END WHERE position IS NOT NULL;
    UPDATE player_seasons SET position = CASE lower(trim(position))
      WHEN 'g' THEN 'Goalkeeper' WHEN 'gk' THEN 'Goalkeeper' WHEN 'goalkeeper' THEN 'Goalkeeper' WHEN 'goal keeper' THEN 'Goalkeeper' WHEN 'keeper' THEN 'Goalkeeper'
      WHEN 'd' THEN 'Defender' WHEN 'defender' THEN 'Defender' WHEN 'defence' THEN 'Defender' WHEN 'defense' THEN 'Defender'
      WHEN 'm' THEN 'Midfielder' WHEN 'midfielder' THEN 'Midfielder' WHEN 'midfield' THEN 'Midfielder'
      WHEN 'f' THEN 'Attacker' WHEN 'fw' THEN 'Attacker' WHEN 'forward' THEN 'Attacker' WHEN 'attacker' THEN 'Attacker' WHEN 'striker' THEN 'Attacker'
      ELSE position END WHERE position IS NOT NULL;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_completed_match_season_insert
    BEFORE INSERT ON matches
    WHEN NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL AND NEW.season IS NOT NULL
      AND CAST(substr(NEW.date,1,4) AS INTEGER) NOT IN (CAST(substr(NEW.season,1,4) AS INTEGER), CAST(substr(NEW.season,1,4) AS INTEGER)+1)
    BEGIN SELECT RAISE(ABORT, 'La data della partita conclusa non è compatibile con la stagione'); END;
    CREATE TRIGGER IF NOT EXISTS validate_completed_match_season_update
    BEFORE UPDATE OF date, season, home_score, away_score ON matches
    WHEN NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL AND NEW.season IS NOT NULL
      AND CAST(substr(NEW.date,1,4) AS INTEGER) NOT IN (CAST(substr(NEW.season,1,4) AS INTEGER), CAST(substr(NEW.season,1,4) AS INTEGER)+1)
    BEGIN SELECT RAISE(ABORT, 'La data della partita conclusa non è compatibile con la stagione'); END;
  `);

  const ensureTeam = db.prepare(`INSERT OR IGNORE INTO teams(canonical_name, short_name, country) VALUES (?, ?, ?)`);
  ensureTeam.run('U.S. Sassuolo Calcio', 'Sassuolo', 'Italy');
  const team = db.prepare(`SELECT id FROM teams WHERE canonical_name = ?`).get('U.S. Sassuolo Calcio') as { id: number };
  const alias = db.prepare(`INSERT OR IGNORE INTO team_aliases(team_id, alias) VALUES (?, ?)`);
  for (const name of ['Sassuolo', 'US Sassuolo', 'U.S. Sassuolo Calcio', 'Sassuolo Calcio']) alias.run(team.id, name);
}

export function normalizeTeamName(name: string) {
  const cleaned = name.trim();
  const row = db.prepare(`
    SELECT t.canonical_name
    FROM team_aliases a JOIN teams t ON t.id = a.team_id
    WHERE lower(a.alias) = lower(?)
  `).get(cleaned) as { canonical_name: string } | undefined;
  // Provider spellings that recur in the local archive. This prevents one
  // club being split in H2H and prevents duplicate fixtures across sources.
  const commonAliases: Record<string, string> = {
    'ac milan': 'Milan',
    'milan': 'Milan',
    'as roma': 'Roma',
    'roma': 'Roma',
    'hellas verona': 'Verona',
    'verona': 'Verona',
    'as cittadella': 'Cittadella',
    'cittadella': 'Cittadella',
    'us lecce': 'Lecce',
    'lecce': 'Lecce',
  };
  return row?.canonical_name ?? commonAliases[cleaned.toLowerCase()] ?? cleaned;
}

export function normalizePlayerPosition(value: unknown): string | null {
  if (value == null || String(value).trim() === '') return null;
  const key=String(value).trim().toLowerCase();
  const roles:Record<string,string>={g:'Goalkeeper',gk:'Goalkeeper',goalkeeper:'Goalkeeper','goal keeper':'Goalkeeper',keeper:'Goalkeeper',d:'Defender',defender:'Defender',defence:'Defender',defense:'Defender',m:'Midfielder',midfielder:'Midfielder',midfield:'Midfielder',f:'Attacker',fw:'Attacker',forward:'Attacker',attacker:'Attacker',striker:'Attacker'};
  return roles[key] ?? String(value).trim();
}

export function getSetting(key: string) {
  return (db.prepare(`SELECT value FROM app_settings WHERE key=?`).get(key) as {value:string}|undefined)?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare(`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).run(key,value,nowIso());
}

export function nowIso() {
  return new Date().toISOString();
}

export function recordSourceReference(input: {
  entityType: string;
  entityId: number;
  field?: string | null;
  sourceUrl: string;
  note?: string | null;
  author?: string | null;
  verifiedAt?: string | null;
}) {
  db.prepare(`INSERT INTO source_references(entity_type,entity_id,field,source_url,note,author,verified_at,created_at)
    VALUES(?,?,?,?,?,?,?,?)`).run(
    input.entityType,
    input.entityId,
    input.field ?? null,
    input.sourceUrl,
    input.note ?? null,
    input.author ?? null,
    input.verifiedAt ?? nowIso(),
    nowIso(),
  );
}

export function recordChange(input: {
  entityType: string;
  entityId?: number | null;
  action: 'create' | 'update' | 'delete' | 'resolve-conflict' | 'undo' | 'rollback';
  before?: unknown;
  after?: unknown;
  sourceUrl?: string | null;
  note?: string | null;
  author?: string | null;
  backupId?: number | null;
}) {
  db.prepare(`INSERT INTO change_log(entity_type,entity_id,action,before_json,after_json,source_url,note,author,backup_id,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    input.entityType,
    input.entityId ?? null,
    input.action,
    input.before === undefined ? null : JSON.stringify(input.before),
    input.after === undefined ? null : JSON.stringify(input.after),
    input.sourceUrl ?? null,
    input.note ?? null,
    input.author ?? null,
    input.backupId ?? null,
    nowIso(),
  );
}

export function createBackupSnapshot(reason: string) {
  const backupsDir = path.resolve('server/db/backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const filename = `sassuolo-${reason.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}-${nowIso().replace(/[:.]/g, '-')}.db`;
  const backupPath = path.join(backupsDir, filename);
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  const result = db.prepare(`INSERT INTO backup_runs(reason,file_path,created_at) VALUES(?,?,?)`)
    .run(reason, backupPath, nowIso());
  return { id: Number(result.lastInsertRowid), filePath: backupPath };
}

export function recordImportRun(input: {
  kind: 'provider_sync' | 'candidate_import' | 'local_import' | 'manual_change' | 'dedupe';
  sourceProvider?: string | null;
  area?: string | null;
  season?: string | null;
  competition?: string | null;
  candidatePath?: string | null;
  manifestSha256?: string | null;
  status: 'planned' | 'running' | 'succeeded' | 'partial' | 'failed' | 'rejected' | 'rolled_back';
  startedAt?: string;
  finishedAt?: string | null;
  recordsSeen?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  recordsRejected?: number;
  backupId?: number | null;
  auditRunId?: number | null;
  diff?: unknown;
  error?: string | null;
  notes?: string | null;
}) {
  const result = db.prepare(`INSERT INTO import_runs(
    kind,source_provider,area,season,competition,candidate_path,manifest_sha256,status,
    started_at,finished_at,records_seen,records_created,records_updated,records_skipped,
    records_rejected,backup_id,audit_run_id,diff_json,error_text,notes
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    input.kind, input.sourceProvider ?? null, input.area ?? null, input.season ?? null,
    input.competition ?? null, input.candidatePath ?? null, input.manifestSha256 ?? null,
    input.status, input.startedAt ?? nowIso(), input.finishedAt ?? null,
    input.recordsSeen ?? 0, input.recordsCreated ?? 0, input.recordsUpdated ?? 0,
    input.recordsSkipped ?? 0, input.recordsRejected ?? 0, input.backupId ?? null,
    input.auditRunId ?? null, input.diff === undefined ? null : JSON.stringify(input.diff),
    input.error ?? null, input.notes ?? null,
  );
  return Number(result.lastInsertRowid);
}

export function recordAuditRun(input: {
  auditType?: string;
  status: 'succeeded' | 'failed';
  generatedAt: string;
  reportPath?: string | null;
  reportSha256?: string | null;
  issueCount?: number;
  blockingIssueCount?: number;
  tableCounts?: unknown;
  issues?: unknown;
  notes?: string | null;
}) {
  const result = db.prepare(`INSERT INTO audit_runs(
    audit_type,status,generated_at,report_path,report_sha256,issue_count,
    blocking_issue_count,table_counts_json,issues_json,notes
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    input.auditType ?? 'full', input.status, input.generatedAt, input.reportPath ?? null,
    input.reportSha256 ?? null, input.issueCount ?? 0, input.blockingIssueCount ?? 0,
    input.tableCounts === undefined ? null : JSON.stringify(input.tableCounts),
    input.issues === undefined ? null : JSON.stringify(input.issues), input.notes ?? null,
  );
  return Number(result.lastInsertRowid);
}

export function recordDataConflict(entityType: string, entityKey: string, field: string, oldValue: unknown, newValue: unknown, provider: string) {
  const oldText = oldValue == null ? null : String(oldValue);
  const newText = newValue == null ? null : String(newValue);
  if (oldText === newText) return;
  db.prepare(`INSERT OR IGNORE INTO data_conflicts(entity_type,entity_key,field,old_value,new_value,provider,created_at) VALUES(?,?,?,?,?,?,?)`)
    .run(entityType, entityKey, field, oldText, newText, provider, nowIso());
}

export function recordFixtureConflicts(existing: any, incoming: { date?: unknown; home_score?: unknown; away_score?: unknown }, provider: string) {
  if (!existing || existing.source_provider === 'manual' || existing.source_provider === provider) return;
  const key = String(existing.id ?? `${existing.date}|${existing.home_team}|${existing.away_team}`);
  const oldDay = existing.date == null ? null : String(existing.date).slice(0, 10);
  const newDay = incoming.date == null ? null : String(incoming.date).slice(0, 10);
  if (oldDay && newDay && oldDay !== newDay) recordDataConflict('match', key, 'date', oldDay, newDay, provider);
  for (const field of ['home_score', 'away_score'] as const) {
    const oldValue = existing[field]; const newValue = incoming[field];
    if (oldValue != null && newValue != null && Number(oldValue) !== Number(newValue)) recordDataConflict('match', key, field, oldValue, newValue, provider);
  }
}
