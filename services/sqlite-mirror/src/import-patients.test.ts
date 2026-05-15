import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
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

const SECRET_STREET = "SYNTHETIC_IMPORT_STREET_TOKEN";
const SECRET_EMAIL = "synthetic.import.email@invalid.test";
const SECRET_PHONE_FULL = "15559998877";
const SECRET_NOTE = "SYNTHETIC_IMPORT_MEMO_TOKEN";

async function writeSyntheticPatientFixture(dir: string): Promise<void> {
  const path = join(dir, "PATIENT.DBF");
  const dbf = await DBFFile.create(path, patientFields, {});
  const entry = new Date(Date.UTC(2020, 2, 10));
  const lastV = new Date(Date.UTC(2025, 0, 5));
  await dbf.appendRecords([
    {
      ID: 501,
      CASENB: "IMP-501",
      NAME: "Synthetic Import Alpha",
      REV_NAME: "Alpha, Synthetic I.",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: `(${SECRET_PHONE_FULL.slice(1, 4)}) ${SECRET_PHONE_FULL.slice(4, 7)}-${SECRET_PHONE_FULL.slice(7)}`,
      MOBILE: "",
      ACTIVE: true,
      DOCTOR_NB: 3,
      ENTRY_DATE: entry,
      LASTVISIT: lastV,
      STREET: SECRET_STREET,
      EMAIL: SECRET_EMAIL,
      QUICKNOTE: SECRET_NOTE,
    },
  ]);
}

function readMirrorDump(sqlitePath: string): string {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const patients = db.prepare("SELECT * FROM patients").all();
    const runs = db.prepare("SELECT * FROM import_runs").all();
    const errors = db.prepare("SELECT * FROM import_errors").all();
    return JSON.stringify({ patients, runs, errors });
  } finally {
    db.close();
  }
}

describe("importPatients", () => {
  it("imports safe patient fields from a synthetic PATIENT.DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-patient-import-"));
    const dataRoot = dir;
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticPatientFixture(dataRoot);
      const result = await importPatients({ dataRoot, sqlitePath });

      expect(result.status).toBe("success");
      expect(result.patientsImported).toBe(1);
      expect(result.errorCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const row = db
          .prepare(
            `SELECT patient_id, chart_number, display_name, reverse_name, phone_mask,
              active, doctor_id, entry_date, last_visit, search_blob, source_deleted
             FROM patients WHERE patient_id = ?`,
          )
          .get("501") as Record<string, unknown>;

        expect(row.patient_id).toBe("501");
        expect(row.chart_number).toBe("IMP-501");
        expect(row.display_name).toBe("Synthetic Import Alpha");
        expect(row.reverse_name).toBe("Alpha, Synthetic I.");
        expect(row.phone_mask).toBe("…8877");
        expect(row.active).toBe(1);
        expect(row.doctor_id).toBe("3");
        expect(row.entry_date).toBe("2020-03-10");
        expect(row.last_visit).toBe("2025-01-05");
        expect(row.search_blob).toContain("synthetic import alpha");
        expect(row.search_blob).toContain("imp-501");
        expect(row.source_deleted).toBe(0);

        const run = db
          .prepare("SELECT status, tables_succeeded, row_counts FROM import_runs WHERE run_id = ?")
          .get(result.runId) as Record<string, unknown>;
        expect(run.status).toBe("success");
        expect(JSON.parse(String(run.tables_succeeded))).toEqual(["patient"]);
        expect(JSON.parse(String(run.row_counts))).toEqual({ patients: 1 });

        const errorCount = db
          .prepare("SELECT COUNT(*) AS c FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { c: number };
        expect(errorCount.c).toBe(0);
      } finally {
        db.close();
      }

      const dump = readMirrorDump(sqlitePath);
      expect(dump).not.toContain(SECRET_STREET);
      expect(dump).not.toContain(SECRET_EMAIL);
      expect(dump).not.toContain(SECRET_NOTE);
      expect(dump).not.toContain(SECRET_PHONE_FULL);
      expect(dump).not.toContain("555999");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records a failed run when PATIENT.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-patient-import-missing-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importPatients({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.patientsImported).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const count = db.prepare("SELECT COUNT(*) AS c FROM patients").get() as { c: number };
        expect(count.c).toBe(0);
        const run = db
          .prepare("SELECT status FROM import_runs WHERE run_id = ?")
          .get(result.runId) as { status: string };
        expect(run.status).toBe("failed");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
