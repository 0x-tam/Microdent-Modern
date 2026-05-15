-- Phase 3.a: PHI-free write audit tables (no row payloads)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS write_audit_log (
  operation_id TEXT NOT NULL PRIMARY KEY,
  requested_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'requested', 'validated', 'backup_created', 'dry_run_generated',
    'write_started', 'write_finished', 'failed', 'restored', 'cancelled'
  )),
  workflow_type TEXT NOT NULL,
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('dry_run', 'real_write')),
  actor_type TEXT CHECK (actor_type IN ('user', 'session', 'service', 'cli', 'unknown')),
  actor_id TEXT,
  target_tables TEXT NOT NULL,
  target_record_ids TEXT NOT NULL,
  backup_id TEXT,
  terminal_status TEXT CHECK (terminal_status IN (
    'success', 'partial', 'failed', 'restored', 'cancelled'
  )),
  record_count INTEGER,
  client_request_id TEXT,
  feature_flags TEXT,
  data_root_fingerprint TEXT,
  bridge_version TEXT,
  app_version TEXT
);

CREATE TABLE IF NOT EXISTS write_audit_steps (
  step_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES write_audit_log (operation_id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN (
    'requested', 'validated', 'backup_created', 'dry_run_generated',
    'write_started', 'write_finished', 'failed', 'restored'
  )),
  created_at TEXT NOT NULL,
  duration_ms INTEGER,
  detail_code TEXT,
  detail_json TEXT
);

CREATE TABLE IF NOT EXISTS write_errors (
  error_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES write_audit_log (operation_id) ON DELETE CASCADE,
  step_id INTEGER REFERENCES write_audit_steps (step_id) ON DELETE SET NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  target_table TEXT,
  target_record_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_write_audit_log_requested
  ON write_audit_log (requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_write_audit_log_workflow
  ON write_audit_log (workflow_type, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_write_audit_log_backup
  ON write_audit_log (backup_id)
  WHERE backup_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_write_audit_steps_operation
  ON write_audit_steps (operation_id, step_id);

CREATE INDEX IF NOT EXISTS idx_write_errors_operation
  ON write_errors (operation_id);
