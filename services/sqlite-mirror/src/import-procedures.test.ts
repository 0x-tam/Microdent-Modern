import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importProcedures } from "./import-procedures.js";
import { openDatabaseSync } from "./node-sqlite.js";

const procchrtFields = [
  { name: "PROCNB", type: "C" as const, size: 6 },
  { name: "PROCEDURE", type: "C" as const, size: 50 },
  { name: "CHART", type: "L" as const, size: 1 },
  { name: "QTYPRIC", type: "L" as const, size: 1 },
  { name: "PRICE1", type: "N" as const, size: 13, decimalPlaces: 4 },
  { name: "PRICE2", type: "N" as const, size: 13, decimalPlaces: 4 },
  { name: "PER_PROF", type: "N" as const, size: 5, decimalPlaces: 2 },
  { name: "CLASS", type: "C" as const, size: 50 },
  { name: "GROUP", type: "C" as const, size: 20 },
  { name: "CATAGORY", type: "C" as const, size: 3 },
  { name: "CLASS_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "TRANS_CODE", type: "N" as const, size: 3, decimalPlaces: 0 },
];

const SECRET_PRICE = 999.99;
const SECRET_GROUP = "SYN_GROUP_A";

async function writeSyntheticProcchrtDbf(dir: string): Promise<void> {
  const path = join(dir, "PROCCHRT.DBF");
  const dbf = await DBFFile.create(path, procchrtFields, {});
  await dbf.appendRecords([
    {
      PROCNB: "SYN01",
      PROCEDURE: "Synthetic exam label A",
      CHART: true,
      QTYPRIC: false,
      PRICE1: SECRET_PRICE,
      PRICE2: 888.88,
      PER_PROF: 12.5,
      CLASS: "Synthetic preventive",
      GROUP: SECRET_GROUP,
      CATAGORY: "PRE",
      CLASS_ID: 101,
      TRANS_CODE: 7,
    },
    {
      PROCNB: "SYN02",
      PROCEDURE: "",
      CHART: false,
      QTYPRIC: true,
      PRICE1: 1234.56,
      PRICE2: 0,
      PER_PROF: 0,
      CLASS: "",
      GROUP: "SYN_GROUP_B",
      CATAGORY: "",
      CLASS_ID: 0,
      TRANS_CODE: 0,
    },
  ]);
}

function readMirrorDump(sqlitePath: string): string {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const procedures = db.prepare("SELECT * FROM procedures").all();
    const runs = db.prepare("SELECT * FROM import_runs").all();
    const errors = db.prepare("SELECT * FROM import_errors").all();
    return JSON.stringify({ procedures, runs, errors });
  } finally {
    db.close();
  }
}

describe("importProcedures", () => {
  it("imports safe procedure fields from a synthetic PROCCHRT.DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-procedure-import-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticProcchrtDbf(dir);
      const result = await importProcedures({ dataRoot: dir, sqlitePath });

      expect(result.status).toBe("success");
      expect(result.rowCount).toBe(2);
      expect(result.errorCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const a = db
          .prepare(
            `SELECT procedure_code, label, procedure_class, category_code, class_id, chart_flag
             FROM procedures WHERE procedure_code = ?`,
          )
          .get("SYN01") as Record<string, unknown>;
        expect(a).toEqual({
          procedure_code: "SYN01",
          label: "Synthetic exam label A",
          procedure_class: "Synthetic preventive",
          category_code: "PRE",
          class_id: 101,
          chart_flag: 1,
        });

        const b = db
          .prepare(
            `SELECT procedure_code, label, procedure_class, category_code, class_id, chart_flag
             FROM procedures WHERE procedure_code = ?`,
          )
          .get("SYN02") as Record<string, unknown>;
        expect(b).toEqual({
          procedure_code: "SYN02",
          label: "SYN02",
          procedure_class: null,
          category_code: null,
          class_id: null,
          chart_flag: 0,
        });

        const run = db
          .prepare("SELECT status, row_counts FROM import_runs WHERE run_id = ?")
          .get(result.runId) as Record<string, unknown>;
        expect(run.status).toBe("success");
        expect(JSON.parse(String(run.row_counts))).toEqual({ procedures: 2 });
      } finally {
        db.close();
      }

      const dump = readMirrorDump(sqlitePath);
      expect(dump).not.toMatch(/PRICE/i);
      expect(dump).not.toMatch(/PER_PROF/i);
      expect(dump).not.toMatch(/QTYPRIC/i);
      expect(dump).not.toMatch(/TRANS_CODE/i);
      expect(dump).not.toContain(String(SECRET_PRICE));
      expect(dump).not.toContain(SECRET_GROUP);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records a failed run when PROCCHRT.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-procedure-import-missing-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importProcedures({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.rowCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const count = db.prepare("SELECT COUNT(*) AS c FROM procedures").get() as { c: number };
        expect(count.c).toBe(0);
        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("PROCCHRT_DBF_NOT_FOUND");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
