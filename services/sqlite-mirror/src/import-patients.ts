import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { DBFFile, DELETED } from "dbffile";
import { applyMigrations } from "./apply-migrations.js";
import {
  beginImportRun,
  finishImportRun,
  fingerprintSourceFiles,
  recordImportError,
  recordSourceFileSnapshots,
  snapshotSourceFiles,
  type ImportTrigger,
} from "./import-run.js";
import { mapSafePatientRow } from "./patient-field-map.js";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";

const PATIENT_DBF = "PATIENT.DBF";
const SOURCE_TABLE = "patient";
const MIRROR_TABLE = "patients";
const BATCH_SIZE = 500;
const PATIENT_OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

export type ImportPatientsOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: ImportTrigger;
};

export type ImportPatientsResult = {
  runId: number;
  status: "success" | "partial" | "failed";
  patientsImported: number;
  errorCount: number;
};

function assertBasenameOnly(fileName: string): void {
  if (fileName !== basename(fileName) || fileName.includes("..")) {
    throw new Error("invalid DBF file name");
  }
}

function resolvePatientDbfPath(dataRoot: string): string {
  assertBasenameOnly(PATIENT_DBF);
  return join(dataRoot, PATIENT_DBF);
}

function activeToSqlite(active: boolean | null): number | null {
  if (active === null) return null;
  return active ? 1 : 0;
}

function deriveSafeSqliteSubcode(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN";
  const codeMatch = error.message.match(/\b(SQLITE_[A-Z0-9_]+)\b/);
  if (codeMatch) return codeMatch[1];
  if (/foreign key/i.test(error.message)) return "SQLITE_CONSTRAINT";
  if (/constraint/i.test(error.message)) return "SQLITE_CONSTRAINT";
  return "SQLITE_ERROR";
}

function insertPatientBatch(db: SqliteDatabase, importedAt: string, rows: ReturnType<typeof mapSafePatientRow>[]): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO patients (
      patient_id, chart_number, display_name, reverse_name, phone_mask,
      active, doctor_id, entry_date, last_visit, search_blob,
      source_deleted, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const row of rows) {
    if (!row) continue;
    stmt.run(
      row.patientId,
      row.chartNumber,
      row.displayName,
      row.reverseName,
      row.phoneMask,
      activeToSqlite(row.active),
      row.doctorId,
      row.entryDate,
      row.lastVisit,
      row.searchBlob,
      row.sourceDeleted ? 1 : 0,
      importedAt,
    );
  }
}

/**
 * Imports safe patient fields from `PATIENT.DBF` under `dataRoot` into the SQLite mirror.
 * Never stores full phones, addresses, memos, or raw DBF rows. Does not log row payloads.
 */
export async function importPatients(options: ImportPatientsOptions): Promise<ImportPatientsResult> {
  const { dataRoot, sqlitePath, trigger = "cli" } = options;

  applyMigrations(sqlitePath);

  const patientPath = resolvePatientDbfPath(dataRoot);
  const fingerprint = fingerprintSourceFiles(dataRoot, [PATIENT_DBF]);

  const db = openDatabaseSync(sqlitePath);
  try {
    const runId = beginImportRun(db, {
      trigger,
      tablesRequested: [SOURCE_TABLE],
      dataRootFingerprint: fingerprint,
    });
    recordSourceFileSnapshots(db, runId, snapshotSourceFiles(dataRoot, MIRROR_TABLE, [PATIENT_DBF]));

    if (!existsSync(patientPath)) {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: PATIENT_DBF,
        errorCode: "PATIENT_DBF_NOT_FOUND",
        message: "PATIENT.DBF not found under data root",
      });
      finishImportRun(db, runId, {
        status: "failed",
        notes: "source file missing",
      });
      return { runId, status: "failed", patientsImported: 0, errorCount: 1 };
    }

    let dbf: DBFFile;
    try {
      dbf = await DBFFile.open(patientPath, PATIENT_OPEN_OPTIONS);
    } catch {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: PATIENT_DBF,
        errorCode: "PATIENT_DBF_OPEN_FAILED",
        message: "could not open PATIENT.DBF",
      });
      finishImportRun(db, runId, {
        status: "failed",
        notes: "open failed",
      });
      return { runId, status: "failed", patientsImported: 0, errorCount: 1 };
    }

    const importedAt = new Date().toISOString();
    let patientsImported = 0;
    let errorCount = 0;
    let rowIndex = 0;
    let batch: NonNullable<ReturnType<typeof mapSafePatientRow>>[] = [];

    db.exec("PRAGMA foreign_keys = OFF;");
    try {
      db.exec("BEGIN IMMEDIATE;");
      try {
        db.exec("DELETE FROM patients");

        const flush = () => {
          if (batch.length === 0) return;
          insertPatientBatch(db, importedAt, batch);
          patientsImported += batch.length;
          batch = [];
        };

        try {
          for await (const row of dbf) {
            rowIndex += 1;
            const rec = row as Record<string, unknown>;
            const mapped = mapSafePatientRow(rec, Boolean(row[DELETED]));
            if (!mapped) {
              errorCount += 1;
              recordImportError(db, runId, {
                sourceTable: SOURCE_TABLE,
                sourceFile: PATIENT_DBF,
                errorCode: "INVALID_PATIENT_ID",
                message: "row skipped: missing or invalid ID",
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
            sourceFile: PATIENT_DBF,
            errorCode: "PATIENT_DBF_SCAN_FAILED",
            message: "scan failed while reading PATIENT.DBF",
          });
          db.exec("ROLLBACK;");
          finishImportRun(db, runId, {
            status: "failed",
            rowCounts: { patients: patientsImported },
            notes: "scan failed",
          });
          return { runId, status: "failed", patientsImported, errorCount };
        }

        const status = errorCount > 0 ? "partial" : "success";
        finishImportRun(db, runId, {
          status,
          tablesSucceeded: [SOURCE_TABLE],
          rowCounts: { patients: patientsImported },
        });
        db.exec("COMMIT;");

        return {
          runId,
          status,
          patientsImported,
          errorCount,
        };
      } catch (error) {
        db.exec("ROLLBACK;");
        const subcode = deriveSafeSqliteSubcode(error);
        recordImportError(db, runId, {
          sourceTable: SOURCE_TABLE,
          sourceFile: PATIENT_DBF,
          errorCode: "PATIENT_IMPORT_TRANSACTION_FAILED",
          message: `sqlite transaction failed during patient import (${subcode})`,
        });
        finishImportRun(db, runId, {
          status: "failed",
          rowCounts: { patients: patientsImported },
          notes: "transaction failed",
        });
        return { runId, status: "failed", patientsImported, errorCount: errorCount + 1 };
      }
    } finally {
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } finally {
    db.close();
  }
}
