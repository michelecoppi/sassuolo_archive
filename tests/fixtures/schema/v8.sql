PRAGMA foreign_keys=OFF;
DROP INDEX IF EXISTS idx_player_match_conflicts_queue;
ALTER TABLE player_match_conflicts DROP COLUMN decision_json;
ALTER TABLE player_match_conflicts DROP COLUMN backup_id;
ALTER TABLE player_match_conflicts DROP COLUMN resolved_at;
ALTER TABLE player_match_conflicts DROP COLUMN resolution_note;
ALTER TABLE player_match_conflicts DROP COLUMN reviewer;
ALTER TABLE player_match_conflicts DROP COLUMN resolved_player_id;
ALTER TABLE player_match_conflicts DROP COLUMN resolution_action;
DELETE FROM schema_migrations WHERE version>8;
PRAGMA user_version=8;
INSERT INTO players(name,position,source_provider,last_verified_at)
VALUES('Giocatore fixture schema 8','Midfielder','qa-fixture','2026-08-13T00:00:00.000Z');
PRAGMA foreign_keys=ON;
