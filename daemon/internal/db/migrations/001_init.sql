CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('shell', 'http')),
  schedule TEXT NOT NULL,
  timezone TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  payload_json TEXT NOT NULL,
  timeout_sec INTEGER NOT NULL DEFAULT 300 CHECK(timeout_sec > 0),
  retry_max INTEGER NOT NULL DEFAULT 0 CHECK(retry_max >= 0),
  retry_backoff_sec INTEGER NOT NULL DEFAULT 10 CHECK(retry_backoff_sec >= 0),
  overlap_policy TEXT NOT NULL DEFAULT 'skip' CHECK(overlap_policy IN ('skip', 'allow')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'queued',
    'running',
    'success',
    'failed',
    'cancelled',
    'timed_out',
    'skipped_overlap'
  )),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK(attempt >= 0),
  exit_code INTEGER,
  error_msg TEXT,
  output_path TEXT,
  output_tail TEXT,
  duration_ms INTEGER CHECK(duration_ms >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_started_desc
  ON job_runs(job_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_runs_status_started_desc
  ON job_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_enabled
  ON jobs(enabled);

CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON events(created_at DESC);
