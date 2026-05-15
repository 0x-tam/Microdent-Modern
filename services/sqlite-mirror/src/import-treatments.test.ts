import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importDoctors } from "./import-doctors.js";
import { importProcedures } from "./import-procedures.js";
import { importTreatments } from "./import-treatments.js";
import { openDatabaseSync } from "./node-sqlite.js";

const opertblFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "OPNUM", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "TOOTHNB", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PROCNB", type: "C" as const, size: 12 },
  { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "DESC", type: "C" as const, size: 30 },
  { name: "FEE", type: "N" as const, size: 13, decimalPlaces: 4 },
];

const procchrtFields = [
  { name: "PROCNB", type: "C" as const, size: 6 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "CHART", type: "L" as const, size: 1 },
];

const doctorFields = [
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "NAME", type: "C" as const, size: 30 },
  { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
];

const SECRET_DESC = "SYNTHETIC_TREATMENT_DESC_TOKEN";
const SECRET_PROCEDURE = "SYNTHETIC_PATIENT_SPECIFIC_PROCEDURE_TEXT";
const SECRET_FEE = 12345.67;

async function writeSyntheticTreatmentFixture(dir: string, extraRows: Record<string, unknown>[] = []): Promise<void> {
  const operPath = join(dir, "OPERTBL.DBF");
  const oper = await DBFFile.create(operPath, opertblFields, {});
  await oper.appendRecords([
    {
      ID: 501,
      OPNUM: 100,
      TOOTHNB: 14,
      PROCEDURE: SECRET_PROCEDURE,
      DATE: new Date(Date.UTC(2024, 5, 1)),
      STATUS: 2,
      PROCNB: "SYN01",
      DOCT: 3,
      DESC: SECRET_DESC,
      FEE: SECRET_FEE,
    },
    {
      ID: 501,
      OPNUM: 99,
      TOOTHNB: 0,
      PROCEDURE: "",
      DATE: new Date(Date.UTC(2023, 0, 15)),
      STATUS: 1,
      PROCNB: "SYN01",
      DOCT: 3,
      DESC: "",
      FEE: 0,
    },
    {
      ID: 502,
      OPNUM: 50,
      TOOTHNB: 3,
      PROCEDURE: "Other patient line",
      DATE: new Date(Date.UTC(2024, 0, 1)),
      STATUS: 0,
      PROCNB: "OTHER",
      DOCT: 0,
      DESC: "",
      FEE: 0,
    },
    ...extraRows,
  ]);

  const procPath = join(dir, "PROCCHRT.DBF");
  const proc = await DBFFile.create(procPath, procchrtFields, {});
  await proc.appendRecords([{ PROCNB: "SYN01", PROCEDURE: "Synthetic dictionary label", CHART: true }]);

  const docPath = join(dir, "DOCTORS.DBF");
  const doc = await DBFFile.create(docPath, doctorFields, {});
  await doc.appendRecords([{ DOCTOR_NB: 3, NAME: "Synthetic Provider Three", SCHEDULE: 1 }]);
}

function readMirrorDump(sqlitePath: string): string {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const treatments = db.prepare("SELECT * FROM treatments ORDER BY patient_id, treatment_id").all();
    const runs = db.prepare("SELECT * FROM import_runs").all();
    const errors = db.prepare("SELECT * FROM import_errors").all();
    return JSON.stringify({ treatments, runs, errors });
  } finally {
    db.close();
  }
}

describe("importTreatments", () => {
  it("imports safe treatment fields from a synthetic OPERTBL.DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-treatment-import-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticTreatmentFixture(dir);
      await importProcedures({ dataRoot: dir, sqlitePath });
      await importDoctors({ dataRoot: dir, sqlitePath });

      const result = await importTreatments({ dataRoot: dir, sqlitePath });

      expect(result.status).toBe("success");
      expect(result.rowCount).toBe(3);
      expect(result.errorCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const withDesc = db
          .prepare(
            `SELECT patient_id, treatment_id, treatment_date, tooth, procedure_code, procedure_label,
              doctor_id, doctor_label, status, has_description, source_deleted
             FROM treatments WHERE patient_id = ? AND treatment_id = ?`,
          )
          .get("501", "100") as Record<string, unknown>;

        expect(withDesc.patient_id).toBe("501");
        expect(withDesc.treatment_id).toBe("100");
        expect(withDesc.treatment_date).toBe("2024-06-01");
        expect(withDesc.tooth).toBe(14);
        expect(withDesc.procedure_code).toBe("SYN01");
        expect(withDesc.procedure_label).toBe("Synthetic dictionary label");
        expect(withDesc.doctor_id).toBe("3");
        expect(withDesc.doctor_label).toBe("Synthetic Provider Three");
        expect(withDesc.status).toBe(2);
        expect(withDesc.has_description).toBe(1);
        expect(withDesc.source_deleted).toBe(0);

        const noTooth = db
          .prepare("SELECT tooth, has_description FROM treatments WHERE treatment_id = ?")
          .get("99") as Record<string, unknown>;
        expect(noTooth.tooth).toBeNull();
        expect(noTooth.has_description).toBe(0);

        const run = db
          .prepare("SELECT status, tables_succeeded, row_counts FROM import_runs WHERE run_id = ?")
          .get(result.runId) as Record<string, unknown>;
        expect(run.status).toBe("success");
        expect(JSON.parse(String(run.tables_succeeded))).toEqual(["treatments"]);
        expect(JSON.parse(String(run.row_counts))).toEqual({ treatments: 3 });
      } finally {
        db.close();
      }

      const dump = readMirrorDump(sqlitePath);
      expect(dump).not.toContain(SECRET_DESC);
      expect(dump).not.toContain(SECRET_PROCEDURE);
      expect(dump).not.toContain(String(SECRET_FEE));
      expect(dump).not.toContain("FEE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records partial runs when rows fail validation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-treatment-import-partial-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticTreatmentFixture(dir, [
        {
          ID: 0,
          OPNUM: 77,
          TOOTHNB: 0,
          PROCEDURE: "",
          DATE: new Date(Date.UTC(2024, 2, 1)),
          STATUS: 0,
          PROCNB: "",
          DOCT: 0,
          DESC: "",
          FEE: 0,
        },
      ]);
      await importProcedures({ dataRoot: dir, sqlitePath });
      await importDoctors({ dataRoot: dir, sqlitePath });

      const result = await importTreatments({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("partial");
      expect(result.rowCount).toBe(3);
      expect(result.errorCount).toBe(1);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("TREATMENT_PATIENT_ID_INVALID");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records a failed run when OPERTBL.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-treatment-import-missing-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importTreatments({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.rowCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const count = db.prepare("SELECT COUNT(*) AS c FROM treatments").get() as { c: number };
        expect(count.c).toBe(0);
        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("OPERTBL_DBF_NOT_FOUND");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
