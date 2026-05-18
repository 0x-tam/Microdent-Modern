import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { applyMigrations } from "./apply-migrations.js";
import { importPatients } from "./import-patients.js";
import { openDatabaseSync } from "./node-sqlite.js";

const patientFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "CASENB", type: "C" as const, size: 15 },
  { name: "NAME", type: "C" as const, size: 51 },
  { name: "REV_NAME", type: "C" as const, size: 51 },
  { name: "FIRST_NAME", type: "C" as const, size: 25 },
  { name: "LAST_NAME", type: "C" as const, size: 25 },
  { name: "HOME_PHONE", type: "C" as const, size: 19 },
  { name: "MOBILE", type: "C" as const, size: 19 },
  { name: "ACTIVE", type: "L" as const, size: 1 },
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "ENTRY_DATE", type: "D" as const, size: 8 },
  { name: "LASTVISIT", type: "D" as const, size: 8 },
  { name: "STREET", type: "C" as const, size: 30 },
  { name: "EMAIL", type: "C" as const, size: 50 },
  { name: "QUICKNOTE", type: "C" as const, size: 40 },
];

async function writeSyntheticPatientFixture(dir: string): Promise<void> {
  const path = join(dir, "PATIENT.DBF");
  const dbf = await DBFFile.create(path, patientFields, {});
  const entry = new Date(Date.UTC(2020, 2, 10));
  const lastV = new Date(Date.UTC(2025, 0, 5));
  await dbf.appendRecords([
    {
      ID: 601,
      CASENB: "FK-601",
      NAME: "FK Reimport Patient",
      REV_NAME: "Patient, FK Reimport",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: "",
      MOBILE: "",
      ACTIVE: true,
      DOCTOR_NB: 1,
      ENTRY_DATE: entry,
      LASTVISIT: lastV,
      STREET: "",
      EMAIL: "",
      QUICKNOTE: "",
    },
  ]);
}

function seedPatientWithAppointmentFk(sqlitePath: string): void {
  applyMigrations(sqlitePath);
  const db = openDatabaseSync(sqlitePath);
  try {
    const importedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO patients (
        patient_id, chart_number, display_name, reverse_name, phone_mask,
        active, doctor_id, entry_date, last_visit, search_blob,
        source_deleted, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "601",
      "STALE-601",
      "Stale Patient",
      "Patient, Stale",
      null,
      1,
      "1",
      "2020-01-01",
      "2024-01-01",
      "stale patient",
      0,
      importedAt,
    );
    db.prepare(
      `INSERT INTO appointments (
        appointment_id, appointment_date, start_time, patient_id,
        doctor_id, room_id, status_code, source_deleted, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("9001", "2026-05-20", "09:00", "601", "1", "1", "1", 0, importedAt);
  } finally {
    db.close();
  }
}

describe("importPatients FK re-import", () => {
  it("re-imports patients when appointments still reference patient rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-patient-fk-reimport-"));
    const dataRoot = dir;
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticPatientFixture(dataRoot);
      seedPatientWithAppointmentFk(sqlitePath);

      const result = await importPatients({ dataRoot, sqlitePath });

      expect(result.status).toBe("success");
      expect(result.patientsImported).toBeGreaterThan(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const patient = db
          .prepare("SELECT display_name FROM patients WHERE patient_id = ?")
          .get("601") as { display_name: string };
        expect(patient.display_name).toBe("FK Reimport Patient");

        const appt = db
          .prepare("SELECT patient_id FROM appointments WHERE appointment_id = ?")
          .get("9001") as { patient_id: string };
        expect(appt.patient_id).toBe("601");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
