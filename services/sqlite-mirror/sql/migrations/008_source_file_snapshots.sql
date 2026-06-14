-- Source-file snapshots for PHI-safe local-copy freshness checks.
-- Stores basenames and file metadata only; never paths or row payloads.
CREATE TABLE IF NOT EXISTS import_source_file_snapshots (
  snapshot_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES import_runs (run_id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  source_file TEXT NOT NULL,
  file_state TEXT NOT NULL CHECK (file_state IN ('present', 'missing', 'unreadable')),
  size_bytes INTEGER,
  mtime_ms REAL,
  captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_source_file_snapshots_table_file
  ON import_source_file_snapshots (table_name, source_file, snapshot_id DESC);
