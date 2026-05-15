-- Phase 2.6: safe OPERTBL treatment lines (DTO-aligned; no memos or fees)
CREATE TABLE IF NOT EXISTS treatments (
  patient_id TEXT NOT NULL,
  treatment_id TEXT NOT NULL,
  treatment_date TEXT,
  tooth INTEGER,
  procedure_code TEXT,
  procedure_label TEXT,
  doctor_id TEXT,
  doctor_label TEXT,
  status INTEGER,
  has_description INTEGER NOT NULL,
  source_deleted INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (patient_id, treatment_id)
);
