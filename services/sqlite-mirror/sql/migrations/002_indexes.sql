-- Indexes recommended in docs/phase-2-sqlite-mirror-plan.md §6

CREATE INDEX IF NOT EXISTS idx_patients_display_name ON patients (display_name);

CREATE INDEX IF NOT EXISTS idx_patients_chart_number ON patients (chart_number)
WHERE chart_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments (patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_room ON appointments (room_id);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments (doctor_id);

CREATE INDEX IF NOT EXISTS idx_appointments_date_room ON appointments (appointment_date, room_id);

CREATE INDEX IF NOT EXISTS idx_import_runs_finished ON import_runs (finished_at DESC);
