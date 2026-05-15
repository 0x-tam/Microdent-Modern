import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importDoctors } from "./import-doctors.js";
import { openDatabaseSync } from "./node-sqlite.js";

const doctorFields = [
  { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "NAME", type: "C" as const, size: 30 },
  { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
  { name: "PHONE", type: "C" as const, size: 19 },
  { name: "ADDRESS", type: "C" as const, size: 50 },
  { name: "FED_TAXID", type: "C" as const, size: 12 },
];

const SECRET_PHONE = "555-000-1001";
const SECRET_ADDRESS = "100 Synthetic Clinic Way";
const SECRET_TAXID = "00-1111111";

function markDbfRecordDeleted(dbfPath: string, recordIndex: number): void {
  const buf = readFileSync(dbfPath);
  const hlen = buf.readUInt16LE(8);
  const rlen = buf.readUInt16LE(10);
  const offset = hlen + recordIndex * rlen;
  buf[offset] = 0x2a;
  writeFileSync(dbfPath, buf);
}

async function writeSyntheticDoctorsDbf(dir: string): Promise<void> {
  const path = join(dir, "DOCTORS.DBF");
  const dbf = await DBFFile.create(path, doctorFields, {});
  await dbf.appendRecords([
    {
      DOCTOR_NB: 101,
      NAME: "Synthetic Provider Alpha",
      SCHEDULE: 1,
      PHONE: SECRET_PHONE,
      ADDRESS: SECRET_ADDRESS,
      FED_TAXID: SECRET_TAXID,
    },
    {
      DOCTOR_NB: 102,
      NAME: "",
      SCHEDULE: 0,
      PHONE: "555-000-1002",
      ADDRESS: "200 Hidden Address Row",
      FED_TAXID: "00-2222222",
    },
    {
      DOCTOR_NB: 103,
      NAME: "Synthetic Provider Deleted",
      SCHEDULE: 1,
      PHONE: "555-000-1003",
      ADDRESS: "300 Should Not Appear",
      FED_TAXID: "00-3333333",
    },
  ]);
  markDbfRecordDeleted(path, 2);
}

function readMirrorDump(sqlitePath: string): string {
  const db = openDatabaseSync(sqlitePath, { readOnly: true });
  try {
    const doctors = db.prepare("SELECT * FROM doctors").all();
    const runs = db.prepare("SELECT * FROM import_runs").all();
    const errors = db.prepare("SELECT * FROM import_errors").all();
    return JSON.stringify({ doctors, runs, errors });
  } finally {
    db.close();
  }
}

describe("importDoctors", () => {
  it("imports safe doctor fields from a synthetic DOCTORS.DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-doctor-import-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticDoctorsDbf(dir);
      const result = await importDoctors({ dataRoot: dir, sqlitePath });

      expect(result.status).toBe("success");
      expect(result.rowCount).toBe(2);
      expect(result.errorCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const rows = db
          .prepare(
            "SELECT doctor_id, display_label, active, source_deleted FROM doctors ORDER BY doctor_id",
          )
          .all() as Array<Record<string, unknown>>;

        expect(rows).toEqual([
          { doctor_id: "101", display_label: "Synthetic Provider Alpha", active: 1, source_deleted: 0 },
          { doctor_id: "102", display_label: "Doctor 102", active: 0, source_deleted: 0 },
        ]);

        const run = db
          .prepare("SELECT status, tables_succeeded, row_counts FROM import_runs WHERE run_id = ?")
          .get(result.runId) as Record<string, unknown>;
        expect(run.status).toBe("success");
        expect(JSON.parse(String(run.tables_succeeded))).toEqual(["doctors"]);
        expect(JSON.parse(String(run.row_counts))).toEqual({ doctors: 2 });
      } finally {
        db.close();
      }

      const dump = readMirrorDump(sqlitePath);
      expect(dump).not.toContain(SECRET_PHONE);
      expect(dump).not.toContain(SECRET_ADDRESS);
      expect(dump).not.toContain(SECRET_TAXID);
      expect(dump).not.toContain("FED_TAXID");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records a failed run when DOCTORS.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-doctor-import-missing-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importDoctors({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.rowCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const count = db.prepare("SELECT COUNT(*) AS c FROM doctors").get() as { c: number };
        expect(count.c).toBe(0);
        const run = db
          .prepare("SELECT status FROM import_runs WHERE run_id = ?")
          .get(result.runId) as { status: string };
        expect(run.status).toBe("failed");
        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("DOCTORS_DBF_NOT_FOUND");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
