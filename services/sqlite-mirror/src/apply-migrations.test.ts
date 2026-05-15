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
] as const;

describe("applyMigrations", () => {
  it("applies all migrations to a temp database and records schema_migrations", () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-sqlite-mirror-"));
    const dbPath = join(dir, "mirror.sqlite");

    try {
      const first = applyMigrations(dbPath);
      expect(first.appliedVersions).toEqual(["001_initial", "002_indexes"]);
      expect(first.skippedVersions).toEqual([]);

      const second = applyMigrations(dbPath);
      expect(second.appliedVersions).toEqual([]);
      expect(second.skippedVersions).toEqual(["001_initial", "002_indexes"]);

      expect(listMirrorTables(dbPath)).toEqual([...EXPECTED_TABLES]);
      expect(listMirrorIndexes(dbPath)).toEqual([...EXPECTED_INDEXES]);
      expect(listAppliedMigrationVersions(dbPath)).toEqual([
        "001_initial",
        "002_indexes",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
