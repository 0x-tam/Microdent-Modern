-- Phase 2.2: procedure reference fields aligned with GET /v1/reference/procedures
ALTER TABLE procedures ADD COLUMN category_code TEXT;
ALTER TABLE procedures ADD COLUMN class_id INTEGER;
