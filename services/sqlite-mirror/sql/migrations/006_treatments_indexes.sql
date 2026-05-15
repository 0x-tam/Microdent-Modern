-- Treatments lookup indexes (docs/phase-2-treatments-sqlite-plan.md §5)
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments (patient_id);

CREATE INDEX IF NOT EXISTS idx_treatments_date ON treatments (treatment_date);

CREATE INDEX IF NOT EXISTS idx_treatments_procedure_code ON treatments (procedure_code)
WHERE procedure_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treatments_doctor ON treatments (doctor_id)
WHERE doctor_id IS NOT NULL;
