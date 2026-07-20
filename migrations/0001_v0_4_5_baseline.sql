CREATE TABLE IF NOT EXISTS pet_submissions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT 'unspecified',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'unpublished', 'rejected')),
  file_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS pet_published_slug_unique ON pet_submissions(slug) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS pet_status_updated_idx ON pet_submissions(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS pet_submissions_owner_idx ON pet_submissions(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  pet_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'published', 'rejected', 'unpublished')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS moderation_events_created_idx ON moderation_events(created_at DESC);

CREATE TABLE IF NOT EXISTS submission_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email_verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);

CREATE TABLE IF NOT EXISTS email_login_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS email_login_codes_lookup_idx ON email_login_codes(email, created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_unique ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_prefix_unique ON user_api_keys(prefix);
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_hash_unique ON user_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS user_api_keys_user_idx ON user_api_keys(user_id);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_notifications (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('published', 'rejected', 'unpublished')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  request_id TEXT,
  next_attempt_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS review_notifications_retry_idx ON review_notifications(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS review_notifications_submission_idx ON review_notifications(submission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS maintenance_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  backup_key TEXT,
  deleted_records INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS maintenance_runs_started_idx ON maintenance_runs(started_at DESC);
