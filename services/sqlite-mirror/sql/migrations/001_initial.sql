-- Phase 2.1: mirror schema (no data import)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT NOT NULL PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_runs (
  run_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  "trigger" TEXT NOT NULL CHECK ("trigger" IN ('cli', 'manual', 'scheduled')),
  data_root_fingerprint TEXT,
  tables_requested TEXT NOT NULL,
  tables_succeeded TEXT,
  row_counts TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS import_errors (
  error_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES import_runs (run_id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_file TEXT NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  row_index INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id TEXT NOT NULL PRIMARY KEY,
  chart_number TEXT,
  display_name TEXT NOT NULL,
  phone_mask TEXT,
  search_blob TEXT NOT NULL,
  source_deleted INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id TEXT NOT NULL PRIMARY KEY,
  display_label TEXT NOT NULL,
  active INTEGER,
  source_deleted INTEGER,
  imported_at TEXT
);

CREATE TABLE IF NOT EXISTS procedures (
  procedure_code TEXT NOT NULL PRIMARY KEY,
  label TEXT NOT NULL,
  procedure_class TEXT,
  chart_flag INTEGER,
  source_deleted INTEGER,
  imported_at TEXT
);

CREATE TABLE IF NOT EXISTS schedule_rooms (
  room_id TEXT NOT NULL PRIMARY KEY,
  label TEXT NOT NULL,
  imported_at TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id TEXT NOT NULL PRIMARY KEY,
  appointment_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  patient_id TEXT REFERENCES patients (patient_id),
  doctor_id TEXT,
  room_id TEXT,
  status_code TEXT,
  source_row_hash TEXT,
  source_deleted INTEGER,
  imported_at TEXT
);

CREATE TABLE IF NOT EXISTS medical_summary (
  patient_id TEXT NOT NULL PRIMARY KEY,
  has_medical_record INTEGER NOT NULL,
  has_sensitive_medical_details INTEGER NOT NULL,
  last_updated TEXT,
  last_dental_visit TEXT,
  flagged_condition_count INTEGER NOT NULL,
  conditions_json TEXT,
  imported_at TEXT
);
