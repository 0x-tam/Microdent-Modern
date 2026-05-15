-- Phase 2.3: schedule appointment fields aligned with GET /v1/schedule/appointments
ALTER TABLE appointments ADD COLUMN duration_slots INTEGER;
ALTER TABLE appointments ADD COLUMN period_minutes INTEGER;
ALTER TABLE appointments ADD COLUMN proc_class INTEGER;
ALTER TABLE appointments ADD COLUMN vac_id INTEGER;
ALTER TABLE appointments ADD COLUMN recall INTEGER;
ALTER TABLE appointments ADD COLUMN unreason INTEGER;
ALTER TABLE appointments ADD COLUMN missed INTEGER;
ALTER TABLE appointments ADD COLUMN has_comment INTEGER;
