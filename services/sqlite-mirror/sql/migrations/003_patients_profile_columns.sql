-- Phase 2.2: profile fields aligned with bridge patient search/profile DTOs
ALTER TABLE patients ADD COLUMN reverse_name TEXT;
ALTER TABLE patients ADD COLUMN active INTEGER;
ALTER TABLE patients ADD COLUMN doctor_id TEXT;
ALTER TABLE patients ADD COLUMN entry_date TEXT;
ALTER TABLE patients ADD COLUMN last_visit TEXT;
