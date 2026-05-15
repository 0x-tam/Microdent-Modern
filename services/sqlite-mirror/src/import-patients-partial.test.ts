import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importPatients } from "./import-patients.js";
import { openDatabaseSync } from "./node-sqlite.js";

const minimalFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "CASENB", type: "C" as const, size: 15 },
  { name: "NAME", type: "C" as const, size: 51 },
  { name: "REV_NAME", type: "C" as const, size: 51 },
  { name: "FIRST_NAME", type: "C" as const, size: 25 },
  { name: "LAST_NAME", type: "C" as const, size: 25 },
  { name: "HOME_PHONE", type: "C" as const, size: 19 },
  { name: "MOBILE", type: "C" as const, size: 19 },
];

describe("importPatients partial runs", () => {
  it("records import_errors for rows with invalid ids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-patient-import-partial-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const path = join(dir, "PATIENT.DBF");
      const dbf = await DBFFile.create(path, minimalFields, {});
      await dbf.appendRecords([
        { ID: 1, CASENB: "OK", NAME: "Valid Row", REV_NAME: "", FIRST_NAME: "", LAST_NAME: "", HOME_PHONE: "", MOBILE: "" },
        { ID: null, CASENB: "BAD", NAME: "Bad Row", REV_NAME: "", FIRST_NAME: "", LAST_NAME: "", HOME_PHONE: "", MOBILE: "" },
      ]);

      const result = await importPatients({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("partial");
      expect(result.patientsImported).toBe(1);
      expect(result.errorCount).toBe(1);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const errors = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .all(result.runId) as Array<{ error_code: string }>;
        expect(errors[0]?.error_code).toBe("INVALID_PATIENT_ID");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
