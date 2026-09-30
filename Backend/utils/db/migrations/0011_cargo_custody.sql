ALTER TABLE cargo_events
  ADD COLUMN from_custodian TEXT DEFAULT '';

ALTER TABLE cargo_events
  ADD COLUMN to_custodian TEXT DEFAULT '';

ALTER TABLE cargo_events
  ADD COLUMN custody_action TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_cargo_events_custody
  ON cargo_events(cargo_id, created_at DESC, id DESC);
