CREATE TABLE IF NOT EXISTS submission_metadata_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'creator')),
  actor_user_id TEXT,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS submission_metadata_events_submission_idx
ON submission_metadata_events(submission_id, created_at DESC);
