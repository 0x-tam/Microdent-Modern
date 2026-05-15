import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { DBFFile, DELETED } from "dbffile";
import { applyMigrations } from "./apply-migrations.js";
import { mapSafeAppointmentRow } from "./appointment-field-map.js";
import {
  beginImportRun,
  finishImportRun,
  fingerprintSourceFiles,
  recordImportError,
  type ImportTrigger,
} from "./import-run.js";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";

const SCHEDULE_DBF = "SCHEDULE.DBF";
const SOURCE_TABLE = "appointments";
const BATCH_SIZE = 500;
const SCHEDULE_OPEN_OPTIONS = {
  encoding: "win1252" as const,
  readMode: "loose" as const,
  includeDeletedRecords: true,
};

export type ImportAppointmentsOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: ImportTrigger;
};

export type ImportAppointmentsResult = {
  runId: number;
  status: "success" | "partial" | "failed";
  rowCount: number;
  errorCount: number;
};

function assertBasenameOnly(fileName: string): void {
  if (fileName !== basename(fileName) || fileName.includes("..")) {
    throw new Error("invalid DBF file name");
  }
}

function resolveScheduleDbfPath(dataRoot: string): string {
  assertBasenameOnly(SCHEDULE_DBF);
  return join(dataRoot, SCHEDULE_DBF);
}

function boolToSqlite(value: boolean): number {
  return value ? 1 : 0;
}

function insertAppointmentBatch(
  db: SqliteDatabase,
  importedAt: string,
  rows: NonNullable<ReturnType<typeof mapSafeAppointmentRow>>[],
): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO appointments (
      appointment_id,
      appointment_date,
      start_time,
      end_time,
      patient_id,
      doctor_id,
      room_id,
      status_code,
      duration_slots,
      period_minutes,
      proc_class,
      vac_id,
      recall,
      unreason,
      missed,
      has_comment,
      source_deleted,
      imported_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const row of rows) {
    stmt.run(
      row.appointmentId,
      row.date,
      row.time,
      row.patientId === "0" ? null : row.patientId,
      row.docId === 0 ? null : String(row.docId),
      String(row.room),
      String(row.status),
      row.durationSlots,
      row.periodMinutes,
      row.procClass,
      row.vacId,
      row.recall,
      row.unreason,
      boolToSqlite(row.missed),
      boolToSqlite(row.hasComment),
      row.sourceDeleted ? 1 : 0,
      importedAt,
    );
  }
}

/**
 * Imports safe appointment fields from `SCHEDULE.DBF` under `dataRoot` into the SQLite mirror.
 * Never stores PAT_NAME, TELEPHONE, COMMENT text, CASENUM, or raw DBF rows.
 */
export async function importAppointments(
  options: ImportAppointmentsOptions,
): Promise<ImportAppointmentsResult> {
  const { dataRoot, sqlitePath, trigger = "cli" } = options;

  applyMigrations(sqlitePath);

  const schedulePath = resolveScheduleDbfPath(dataRoot);
  const fingerprint = fingerprintSourceFiles(dataRoot, [SCHEDULE_DBF]);

  const db = openDatabaseSync(sqlitePath);
  try {
    const runId = beginImportRun(db, {
      trigger,
      tablesRequested: [SOURCE_TABLE],
      dataRootFingerprint: fingerprint,
    });

    if (!existsSync(schedulePath)) {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SCHEDULE_DBF,
        errorCode: "SCHEDULE_DBF_NOT_FOUND",
        message: "SCHEDULE.DBF not found under data root",
      });
      finishImportRun(db, runId, { status: "failed", notes: "source file missing" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    let dbf: DBFFile;
    try {
      dbf = await DBFFile.open(schedulePath, SCHEDULE_OPEN_OPTIONS);
    } catch {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SCHEDULE_DBF,
        errorCode: "SCHEDULE_DBF_OPEN_FAILED",
        message: "could not open SCHEDULE.DBF",
      });
      finishImportRun(db, runId, { status: "failed", notes: "open failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    const importedAt = new Date().toISOString();
    let rowCount = 0;
    let errorCount = 0;
    let rowIndex = 0;
    let batch: NonNullable<ReturnType<typeof mapSafeAppointmentRow>>[] = [];

    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec("DELETE FROM appointments");

      const flush = () => {
        if (batch.length === 0) return;
        insertAppointmentBatch(db, importedAt, batch);
        rowCount += batch.length;
        batch = [];
      };

      try {
        for await (const row of dbf) {
          rowIndex += 1;
          const rec = row as Record<string, unknown>;
          const sourceDeleted = Boolean(row[DELETED]);
          const mapped = mapSafeAppointmentRow(rec, sourceDeleted);
          if (!mapped) {
            errorCount += 1;
            recordImportError(db, runId, {
              sourceTable: SOURCE_TABLE,
              sourceFile: SCHEDULE_DBF,
              errorCode: "INVALID_APPOINTMENT_ROW",
              message: "row skipped: missing or invalid ID or DATE",
              rowIndex,
            });
            continue;
          }
          batch.push(mapped);
          if (batch.length >= BATCH_SIZE) flush();
        }
        flush();
      } catch {
        errorCount += 1;
        recordImportError(db, runId, {
          sourceTable: SOURCE_TABLE,
          sourceFile: SCHEDULE_DBF,
          errorCode: "SCHEDULE_DBF_SCAN_FAILED",
          message: "scan failed while reading SCHEDULE.DBF",
        });
        db.exec("ROLLBACK;");
        finishImportRun(db, runId, {
          status: "failed",
          rowCounts: { appointments: rowCount },
          notes: "scan failed",
        });
        return { runId, status: "failed", rowCount, errorCount };
      }

      const status = errorCount > 0 ? "partial" : "success";
      finishImportRun(db, runId, {
        status,
        tablesSucceeded: [SOURCE_TABLE],
        rowCounts: { appointments: rowCount },
      });
      db.exec("COMMIT;");

      return { runId, status, rowCount, errorCount };
    } catch {
      db.exec("ROLLBACK;");
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SCHEDULE_DBF,
        errorCode: "APPOINTMENT_IMPORT_TRANSACTION_FAILED",
        message: "sqlite transaction failed during appointment import",
      });
      finishImportRun(db, runId, {
        status: "failed",
        rowCounts: { appointments: rowCount },
        notes: "transaction failed",
      });
      return { runId, status: "failed", rowCount, errorCount: errorCount + 1 };
    }
  } finally {
    db.close();
  }
}
