import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { applyMigrations } from "./apply-migrations.js";
import {
  listAppliedMigrationVersions,
  listMirrorIndexes,
  listMirrorTables,
} from "./schema-inspect.js";

const EXPECTED_TABLES = [
  "appointments",
  "doctors",
  "import_errors",
  "import_runs",
  "medical_summary",
  "patients",
  "procedures",
  "schedule_rooms",
  "schema_migrations",
  "treatments",
  "write_audit_log",
  "write_audit_steps",
  "write_errors",
] as const;

const EXPECTED_INDEXES = [
  "idx_appointments_date",
  "idx_appointments_date_room",
  "idx_appointments_doctor",
  "idx_appointments_patient",
  "idx_appointments_room",
  "idx_import_runs_finished",
  "idx_patients_chart_number",
  "idx_patients_display_name",
  "idx_treatments_date",
  "idx_treatments_doctor",
  "idx_treatments_patient",
  "idx_treatments_procedure_code",
  "idx_write_audit_log_backup",
  "idx_write_audit_log_requested",
  "idx_write_audit_log_workflow",
  "idx_write_audit_steps_operation",
  "idx_write_errors_operation",
] as const;

describe("applyMigrations", () => {
  it("applies all migrations to a temp database and records schema_migrations", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-sqlite-mirror-"));
    const dbPath = join(dir, "mirror.sqlite");

    try {
      const first = applyMigrations(dbPath);
      expect(first.appliedVersions).toEqual([
        "001_initial",
        "002_indexes",
        "003_patients_profile_columns",
        "003_procedures_reference_columns",
        "004_appointments_safe_fields",
        "005_treatments",
        "006_treatments_indexes",
        "007_write_audit",
      ]);
      expect(first.skippedVersions).toEqual([]);

      const second = applyMigrations(dbPath);
      expect(second.appliedVersions).toEqual([]);
      expect(second.skippedVersions).toEqual([
        "001_initial",
        "002_indexes",
        "003_patients_profile_columns",
        "003_procedures_reference_columns",
        "004_appointments_safe_fields",
        "005_treatments",
        "006_treatments_indexes",
        "007_write_audit",
      ]);

      expect(listMirrorTables(dbPath)).toEqual([...EXPECTED_TABLES]);
      expect(listMirrorIndexes(dbPath)).toEqual([...EXPECTED_INDEXES]);
      expect(listAppliedMigrationVersions(dbPath)).toEqual([
        "001_initial",
        "002_indexes",
        "003_patients_profile_columns",
        "003_procedures_reference_columns",
        "004_appointments_safe_fields",
        "005_treatments",
        "006_treatments_indexes",
        "007_write_audit",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
