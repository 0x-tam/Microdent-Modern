import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importAppointments } from "./import-appointments.js";
import { openDatabaseSync } from "./node-sqlite.js";

const scheduleFields = [
  { name: "ID", type: "N" as const, size: 12, decimalPlaces: 0 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "TIME", type: "C" as const, size: 8 },
  { name: "DURATION", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "COMMENT", type: "C" as const, size: 40 },
  { name: "PAT_NAME", type: "C" as const, size: 41 },
  { name: "TELEPHONE", type: "C" as const, size: 20 },
  { name: "CASENUM", type: "C" as const, size: 15 },
  { name: "PERIOD", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "STATUS", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "DOC_ID", type: "N" as const, size: 5, decimalPlaces: 0 },
  { name: "PAT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "PROC_CLASS", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "VAC_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "RECALL", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "UNREASON", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "MISSED", type: "L" as const, size: 1 },
];

const BLOCKED_NAME = "SYNTHETIC_SCHEDULE_PAT_NAME";
const BLOCKED_PHONE = "555-0199-SECRET";
const BLOCKED_COMMENT = "SYNTHETIC_SCHEDULE_COMMENT_BODY";
const BLOCKED_CASENUM = "SYNTHETIC_CASE_TOKEN_WW";

async function writeSyntheticScheduleDbf(dir: string): Promise<void> {
  const path = join(dir, "SCHEDULE.DBF");
  const dbf = await DBFFile.create(path, scheduleFields, {});
  const d1 = new Date(Date.UTC(2026, 4, 20));
  await dbf.appendRecords([
    {
      ID: 2001,
      DATE: d1,
      TIME: "09:00",
      DURATION: 2,
      ROOM: 1,
      COMMENT: BLOCKED_COMMENT,
      PAT_NAME: BLOCKED_NAME,
      TELEPHONE: BLOCKED_PHONE,
      CASENUM: BLOCKED_CASENUM,
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 7,
      PAT_ID: 50001,
      PROC_CLASS: 3,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 2002,
      DATE: d1,
      TIME: "10:00",
      DURATION: 1,
      ROOM: 2,
      COMMENT: "",
      PAT_NAME: BLOCKED_NAME,
      TELEPHONE: BLOCKED_PHONE,
      CASENUM: BLOCKED_CASENUM,
      PERIOD: 0,
      STATUS: 2,
      DOC_ID: 0,
      PAT_ID: 0,
      PROC_CLASS: 0,
      VAC_ID: 1,
      RECALL: 2,
      UNREASON: 3,
      MISSED: true,
    },
    {
      ID: 2099,
      DATE: null,
      TIME: "13:00",
      DURATION: 1,
      ROOM: 1,
      COMMENT: "",
      PAT_NAME: "",
      TELEPHONE: "",
      CASENUM: "",
      PERIOD: 30,
      STATUS: 0,
      DOC_ID: 0,
      PAT_ID: 0,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
  ]);
}

describe("importAppointments", () => {
  it("imports safe schedule fields and omits blocked columns", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-appt-import-"));
    const sqlitePath = join(dir, "mirror.sqlite");
    const schedulePath = join(dir, "SCHEDULE.DBF");

    const dbf = await DBFFile.create(schedulePath, scheduleFields, {});
    await dbf.appendRecords([
      {
        ID: 9001,
        DATE: new Date(Date.UTC(2024, 5, 12)),
        TIME: "09:30",
        DURATION: 2,
        ROOM: 3,
        COMMENT: BLOCKED_COMMENT,
        PAT_NAME: BLOCKED_NAME,
        TELEPHONE: BLOCKED_PHONE,
        CASENUM: BLOCKED_CASENUM,
        PERIOD: 15,
        STATUS: 1,
        DOC_ID: 7,
        PAT_ID: 501,
        PROC_CLASS: 2,
        VAC_ID: 0,
        RECALL: 0,
        UNREASON: 0,
        MISSED: false,
      },
    ]);

    const result = await importAppointments({ dataRoot: dir, sqlitePath });
    expect(result.status).toBe("success");
    expect(result.rowCount).toBe(1);

    const db = openDatabaseSync(sqlitePath);
    try {
      const row = db
        .prepare(
          `SELECT appointment_id, appointment_date, start_time, patient_id,
                  has_comment, duration_slots, period_minutes, proc_class
           FROM appointments WHERE appointment_id = ?`,
        )
        .get("9001") as Record<string, unknown>;
      expect(row).toEqual({
        appointment_id: "9001",
        appointment_date: "2024-06-12",
        start_time: "09:30",
        patient_id: "501",
        has_comment: 1,
        duration_slots: 2,
        period_minutes: 15,
        proc_class: 2,
      });
    } finally {
      db.close();
    }

    const dump = readFileSync(sqlitePath);
    expect(dump.includes(Buffer.from(BLOCKED_NAME))).toBe(false);
    expect(dump.includes(Buffer.from(BLOCKED_PHONE))).toBe(false);
    expect(dump.includes(Buffer.from(BLOCKED_COMMENT))).toBe(false);
    expect(dump.includes(Buffer.from(BLOCKED_CASENUM))).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("records partial runs for invalid rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-appt-import-partial-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticScheduleDbf(dir);
      const result = await importAppointments({ dataRoot: dir, sqlitePath });

      expect(result.status).toBe("partial");
      expect(result.rowCount).toBe(2);
      expect(result.errorCount).toBe(1);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const ids = db
          .prepare("SELECT appointment_id FROM appointments ORDER BY appointment_id")
          .all() as Array<{ appointment_id: string }>;
        expect(ids.map((r) => r.appointment_id)).toEqual(["2001", "2002"]);

        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("INVALID_APPOINTMENT_ROW");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records a failed run when SCHEDULE.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-appt-import-missing-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importAppointments({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.rowCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const err = db
          .prepare("SELECT error_code FROM import_errors WHERE run_id = ?")
          .get(result.runId) as { error_code: string };
        expect(err.error_code).toBe("SCHEDULE_DBF_NOT_FOUND");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
