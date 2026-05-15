import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importMedicalSummary } from "./import-medical-summary.js";
import { openDatabaseSync } from "./node-sqlite.js";

const medicalFields = [
  { name: "HOSPITAL", type: "L" as const, size: 1 },
  { name: "PHYSICIAN", type: "L" as const, size: 1 },
  { name: "MEDICINE", type: "L" as const, size: 1 },
  { name: "PATIENT_ID", type: "N" as const, size: 6, decimalPlaces: 0 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "LAST_DENTA", type: "D" as const, size: 8 },
  { name: "PROBLEM", type: "C" as const, size: 40 },
  { name: "ILL", type: "L" as const, size: 1 },
  { name: "REACTION", type: "L" as const, size: 1 },
  { name: "BLEEDING", type: "L" as const, size: 1 },
  { name: "ALLERGIC", type: "L" as const, size: 1 },
  { name: "ALLERGY_TO", type: "C" as const, size: 15 },
  { name: "HEART_TRBL", type: "L" as const, size: 1 },
  { name: "CONG_HEART", type: "L" as const, size: 1 },
  { name: "HEART_MRM", type: "L" as const, size: 1 },
  { name: "HIGH_PRESS", type: "L" as const, size: 1 },
  { name: "LOW_PRESS", type: "L" as const, size: 1 },
  { name: "ANEMIA", type: "L" as const, size: 1 },
  { name: "RH_FEVER", type: "L" as const, size: 1 },
  { name: "JAUNDICE", type: "L" as const, size: 1 },
  { name: "ASTHMA", type: "L" as const, size: 1 },
  { name: "COUGH", type: "L" as const, size: 1 },
  { name: "KIDNEYS", type: "L" as const, size: 1 },
  { name: "MED1", type: "L" as const, size: 1 },
  { name: "DIABETS", type: "L" as const, size: 1 },
  { name: "TUBERCUL", type: "L" as const, size: 1 },
  { name: "HEPATISIS", type: "L" as const, size: 1 },
  { name: "ARTHRITIS", type: "L" as const, size: 1 },
  { name: "STROKE", type: "L" as const, size: 1 },
  { name: "EPILEPSEY", type: "L" as const, size: 1 },
  { name: "PSYCHIATRI", type: "L" as const, size: 1 },
  { name: "SINUS_TRBL", type: "L" as const, size: 1 },
  { name: "PREGNANT", type: "L" as const, size: 1 },
  { name: "ULCERS", type: "L" as const, size: 1 },
  { name: "AIDS", type: "L" as const, size: 1 },
  { name: "MED2", type: "L" as const, size: 1 },
];

const SECRET_PROBLEM = "SYNTHETIC_IMPORT_MEDICAL_PROBLEM_TOKEN";
const SECRET_ALLERGY = "SYNTHETIC_IMPORT_ALLERGY_TEXT_TOKEN";

function blankLogicalRow(patientId: number, overrides: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = {
    HOSPITAL: false,
    PHYSICIAN: false,
    MEDICINE: false,
    PATIENT_ID: patientId,
    DATE: new Date(Date.UTC(2023, 2, 10)),
    LAST_DENTA: new Date(Date.UTC(2022, 11, 1)),
    PROBLEM: "",
    ILL: false,
    REACTION: false,
    BLEEDING: false,
    ALLERGIC: false,
    ALLERGY_TO: "",
    HEART_TRBL: false,
    CONG_HEART: false,
    HEART_MRM: false,
    HIGH_PRESS: false,
    LOW_PRESS: false,
    ANEMIA: false,
    RH_FEVER: false,
    JAUNDICE: false,
    ASTHMA: false,
    COUGH: false,
    KIDNEYS: false,
    MED1: false,
    DIABETS: false,
    TUBERCUL: false,
    HEPATISIS: false,
    ARTHRITIS: false,
    STROKE: false,
    EPILEPSEY: false,
    PSYCHIATRI: false,
    SINUS_TRBL: false,
    PREGNANT: false,
    ULCERS: false,
    AIDS: false,
    MED2: false,
  };
  return { ...base, ...overrides };
}

async function writeSyntheticMedicalFixture(dir: string): Promise<void> {
  const path = join(dir, "MEDICAL.DBF");
  const dbf = await DBFFile.create(path, medicalFields, {});
  await dbf.appendRecords([
    blankLogicalRow(777, {
      DIABETS: true,
      ALLERGIC: true,
      PROBLEM: SECRET_PROBLEM,
      ALLERGY_TO: SECRET_ALLERGY,
    }),
    blankLogicalRow(778, {
      DATE: new Date(Date.UTC(2024, 0, 1)),
      DIABETS: false,
    }),
    blankLogicalRow(777, {
      DATE: new Date(Date.UTC(2021, 0, 1)),
      DIABETS: false,
      ALLERGIC: false,
    }),
  ]);
}

function readMirrorDump(sqlitePath: string): string {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const medical = db.prepare("SELECT * FROM medical_summary").all();
    const runs = db.prepare("SELECT * FROM import_runs").all();
    const errors = db.prepare("SELECT * FROM import_errors").all();
    return JSON.stringify({ medical, runs, errors });
  } finally {
    db.close();
  }
}

describe("importMedicalSummary", () => {
  it("imports conservative summary fields from synthetic MEDICAL.DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-medical-import-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticMedicalFixture(dir);
      const result = await importMedicalSummary({ dataRoot: dir, sqlitePath });

      expect(result.status).toBe("success");
      expect(result.rowCount).toBe(2);
      expect(result.errorCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const row = db
          .prepare(
            `SELECT patient_id, has_medical_record, has_sensitive_medical_details,
              last_updated, last_dental_visit, flagged_condition_count, conditions_json
             FROM medical_summary WHERE patient_id = ?`,
          )
          .get("777") as Record<string, unknown>;

        expect(row.patient_id).toBe("777");
        expect(row.has_medical_record).toBe(1);
        expect(row.has_sensitive_medical_details).toBe(1);
        expect(row.last_updated).toBe("2023-03-10");
        expect(row.last_dental_visit).toBe("2022-12-01");
        expect(row.flagged_condition_count).toBe(2);

        const conditions = JSON.parse(String(row.conditions_json)) as {
          diabetes?: boolean | null;
          allergic?: boolean | null;
        };
        expect(conditions.diabetes).toBe(true);
        expect(conditions.allergic).toBe(true);

        const run = db
          .prepare("SELECT status, tables_succeeded, row_counts FROM import_runs WHERE run_id = ?")
          .get(result.runId) as Record<string, unknown>;
        expect(run.status).toBe("success");
        expect(JSON.parse(String(run.tables_succeeded))).toEqual(["medical_summary"]);
        expect(JSON.parse(String(run.row_counts))).toEqual({ medical_summary: 2 });
      } finally {
        db.close();
      }

      const dump = readMirrorDump(sqlitePath);
      expect(dump).not.toContain(SECRET_PROBLEM);
      expect(dump).not.toContain(SECRET_ALLERGY);
      expect(dump).not.toContain("PROBLEM");
      expect(dump).not.toContain("ALLERGY_TO");
      expect(dump).not.toContain("NOTES");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records failed run when MEDICAL.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-medical-import-miss-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importMedicalSummary({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.rowCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const count = db.prepare("SELECT COUNT(*) AS c FROM medical_summary").get() as { c: number };
        expect(count.c).toBe(0);
        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("MEDICAL_DBF_NOT_FOUND");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
