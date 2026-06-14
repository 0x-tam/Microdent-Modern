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
import type { MedicalSummaryMirrorRecord } from "@microdent/bridge/import-source";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";
import {
  parseDataRootFromValue,
  readAllMedicalSummariesFromDbf,
} from "@microdent/bridge/import-source";

const SOURCE_TABLE = "medical_summary";
const SOURCE_FILE = "MEDICAL.DBF";

export type ImportMedicalSummaryOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: ImportTrigger;
};

export type ImportMedicalSummaryResult = {
  runId: number;
  status: "success" | "partial" | "failed";
  rowCount: number;
  errorCount: number;
};

function boolToSqlite(v: boolean): number {
  return v ? 1 : 0;
}

function writeMedicalSummaries(db: SqliteDatabase, summaries: MedicalSummaryMirrorRecord[]): number {
  const importedAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO medical_summary (
      patient_id, has_medical_record, has_sensitive_medical_details,
      last_updated, last_dental_visit, flagged_condition_count,
      conditions_json, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("DELETE FROM medical_summary;");
  for (const summary of summaries) {
    insert.run(
      summary.patientId,
      boolToSqlite(summary.hasMedicalRecord),
      boolToSqlite(summary.hasSensitiveMedicalDetails),
      summary.lastUpdated,
      summary.lastDentalVisit,
      summary.flaggedConditionCount,
      JSON.stringify(summary.conditions),
      importedAt,
    );
  }
  return summaries.length;
}

/**
 * Imports conservative medical summary fields from `MEDICAL.DBF` into the SQLite mirror.
 * Matches `GET /v1/patients/:patientId/medical-summary` allowlist only — no free text or raw rows.
 */
export async function importMedicalSummary(
  options: ImportMedicalSummaryOptions,
): Promise<ImportMedicalSummaryResult> {
  const { dataRoot, sqlitePath, trigger = "cli" } = options;

  applyMigrations(sqlitePath);

  const dataRootConfig = parseDataRootFromValue(dataRoot);
  const fingerprint = fingerprintSourceFiles(dataRoot, [SOURCE_FILE]);

  const db = openDatabaseSync(sqlitePath);
  try {
    const runId = beginImportRun(db, {
      trigger,
      tablesRequested: [SOURCE_TABLE],
      dataRootFingerprint: fingerprint,
    });
    recordSourceFileSnapshots(db, runId, snapshotSourceFiles(dataRoot, SOURCE_TABLE, [SOURCE_FILE]));

    if (!dataRootConfig.configured) {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "DATA_ROOT_INVALID",
        message: "dataRoot must be a non-empty absolute path",
      });
      finishImportRun(db, runId, { status: "failed", notes: "invalid data root" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    const outcome = await readAllMedicalSummariesFromDbf(dataRootConfig);

    if (outcome.kind === "missing_table") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "MEDICAL_DBF_NOT_FOUND",
        message: "MEDICAL.DBF not found under data root",
      });
      finishImportRun(db, runId, { status: "failed", notes: "source file missing" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    if (outcome.kind === "read_error") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "MEDICAL_READ_ERROR",
        message: "failed to read MEDICAL.DBF",
      });
      finishImportRun(db, runId, { status: "failed", notes: "read failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    let errorCount = 0;
    for (const { rowIndex } of outcome.invalidPatientIdRows) {
      errorCount += 1;
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "INVALID_PATIENT_ID",
        message: "row skipped: missing or invalid PATIENT_ID",
        rowIndex,
      });
    }

    db.exec("BEGIN IMMEDIATE;");
    try {
      const rowCount = writeMedicalSummaries(db, outcome.summaries);
      db.exec("COMMIT;");
      const status = errorCount > 0 ? "partial" : "success";
      finishImportRun(db, runId, {
        status,
        tablesSucceeded: [SOURCE_TABLE],
        rowCounts: { medical_summary: rowCount },
      });
      return { runId, status, rowCount, errorCount };
    } catch {
      db.exec("ROLLBACK;");
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "SQLITE_WRITE_ERROR",
        message: "sqlite transaction failed during medical summary import",
      });
      finishImportRun(db, runId, { status: "failed", notes: "transaction failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: errorCount + 1 };
    }
  } finally {
    db.close();
  }
}
