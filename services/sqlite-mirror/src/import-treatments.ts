import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { DBFFile, DELETED } from "dbffile";
import { applyMigrations } from "./apply-migrations.js";
import {
  beginImportRun,
  finishImportRun,
  fingerprintSourceFiles,
  recordImportError,
  type ImportTrigger,
} from "./import-run.js";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";
import {
  buildDoctorLabelLookup,
  buildProcedureLabelLookup,
  mapSafeTreatmentRow,
  type SafeTreatmentMirrorRow,
} from "./treatment-field-map.js";

const OPERTBL_DBF = "OPERTBL.DBF";
const SOURCE_TABLE = "treatments";
const BATCH_SIZE = 500;
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

export type ImportTreatmentsOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: ImportTrigger;
};

export type ImportTreatmentsResult = {
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

function resolveOperTblPath(dataRoot: string): string {
  assertBasenameOnly(OPERTBL_DBF);
  return join(dataRoot, OPERTBL_DBF);
}

function loadProcedureLookup(db: SqliteDatabase): Map<string, string | null> {
  const rows = db
    .prepare("SELECT procedure_code, label FROM procedures WHERE source_deleted = 0 OR source_deleted IS NULL")
    .all() as Array<{ procedure_code: string; label: string }>;
  return buildProcedureLabelLookup(
    rows.map((r) => ({ procedureCode: r.procedure_code, label: r.label })),
  );
}

function loadDoctorLookup(db: SqliteDatabase): Map<string, string> {
  const rows = db
    .prepare(
      "SELECT doctor_id, display_label FROM doctors WHERE source_deleted = 0 OR source_deleted IS NULL",
    )
    .all() as Array<{ doctor_id: string; display_label: string }>;
  return buildDoctorLabelLookup(
    rows.map((r) => ({ doctorId: r.doctor_id, displayLabel: r.display_label })),
  );
}

function insertTreatmentBatch(db: SqliteDatabase, importedAt: string, rows: SafeTreatmentMirrorRow[]): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO treatments (
      patient_id, treatment_id, treatment_date, tooth, procedure_code, procedure_label,
      doctor_id, doctor_label, status, has_description, source_deleted, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const row of rows) {
    stmt.run(
      row.patientId,
      row.treatmentId,
      row.treatmentDate,
      row.tooth,
      row.procedureCode,
      row.procedureLabel,
      row.doctorId,
      row.doctorLabel,
      row.status,
      row.hasDescription ? 1 : 0,
      row.sourceDeleted ? 1 : 0,
      importedAt,
    );
  }
}

/**
 * Imports safe treatment fields from `OPERTBL.DBF` under `dataRoot` into the SQLite mirror.
 * Never stores memos, descriptions, fees, or raw DBF rows. Does not log row payloads.
 */
export async function importTreatments(options: ImportTreatmentsOptions): Promise<ImportTreatmentsResult> {
  const { dataRoot, sqlitePath, trigger = "cli" } = options;

  applyMigrations(sqlitePath);

  const operPath = resolveOperTblPath(dataRoot);
  const fingerprint = fingerprintSourceFiles(dataRoot, [OPERTBL_DBF]);

  const db = openDatabaseSync(sqlitePath);
  try {
    const runId = beginImportRun(db, {
      trigger,
      tablesRequested: [SOURCE_TABLE],
      dataRootFingerprint: fingerprint,
    });

    if (!existsSync(operPath)) {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: OPERTBL_DBF,
        errorCode: "OPERTBL_DBF_NOT_FOUND",
        message: "OPERTBL.DBF not found under data root",
      });
      finishImportRun(db, runId, {
        status: "failed",
        notes: "source file missing",
      });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    let dbf: DBFFile;
    try {
      dbf = await DBFFile.open(operPath, OPEN_OPTIONS);
    } catch {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: OPERTBL_DBF,
        errorCode: "OPERTBL_DBF_OPEN_FAILED",
        message: "could not open OPERTBL.DBF",
      });
      finishImportRun(db, runId, {
        status: "failed",
        notes: "open failed",
      });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    const procedureLookup = loadProcedureLookup(db);
    const doctorLookup = loadDoctorLookup(db);
    const importedAt = new Date().toISOString();
    let rowCount = 0;
    let errorCount = 0;
    let rowIndex = 0;
    let batch: SafeTreatmentMirrorRow[] = [];

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec("DELETE FROM treatments");

      const flush = () => {
        if (batch.length === 0) return;
        insertTreatmentBatch(db, importedAt, batch);
        rowCount += batch.length;
        batch = [];
      };

      try {
        for await (const row of dbf) {
          rowIndex += 1;
          const rec = row as Record<string, unknown>;
          const mapped = mapSafeTreatmentRow(rec, Boolean(row[DELETED]), procedureLookup, doctorLookup);
          if (mapped.kind === "error") {
            errorCount += 1;
            recordImportError(db, runId, {
              sourceTable: SOURCE_TABLE,
              sourceFile: OPERTBL_DBF,
              errorCode: mapped.errorCode,
              message: "row skipped during treatment import",
              rowIndex,
            });
            continue;
          }
          if (mapped.row.treatmentDate === null) {
            errorCount += 1;
            recordImportError(db, runId, {
              sourceTable: SOURCE_TABLE,
              sourceFile: OPERTBL_DBF,
              errorCode: "TREATMENT_INVALID_DATE",
              message: "row skipped: missing or invalid DATE",
              rowIndex,
            });
            continue;
          }
          batch.push(mapped.row);
          if (batch.length >= BATCH_SIZE) flush();
        }
        flush();
      } catch {
        errorCount += 1;
        recordImportError(db, runId, {
          sourceTable: SOURCE_TABLE,
          sourceFile: OPERTBL_DBF,
          errorCode: "OPERTBL_DBF_SCAN_FAILED",
          message: "scan failed while reading OPERTBL.DBF",
        });
        db.exec("ROLLBACK;");
        finishImportRun(db, runId, {
          status: "failed",
          rowCounts: { treatments: rowCount },
          notes: "scan failed",
        });
        return { runId, status: "failed", rowCount, errorCount };
      }

      const status = errorCount > 0 ? "partial" : "success";
      finishImportRun(db, runId, {
        status,
        tablesSucceeded: [SOURCE_TABLE],
        rowCounts: { treatments: rowCount },
      });
      db.exec("COMMIT;");

      return {
        runId,
        status,
        rowCount,
        errorCount,
      };
    } catch {
      db.exec("ROLLBACK;");
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: OPERTBL_DBF,
        errorCode: "TREATMENT_IMPORT_TRANSACTION_FAILED",
        message: "sqlite transaction failed during treatment import",
      });
      finishImportRun(db, runId, {
        status: "failed",
        rowCounts: { treatments: rowCount },
        notes: "transaction failed",
      });
      return { runId, status: "failed", rowCount, errorCount: errorCount + 1 };
    }
  } finally {
    db.close();
  }
}
