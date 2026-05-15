import type { ReferenceProcedureItem } from "@microdent/contracts";
import { applyMigrations } from "./apply-migrations.js";
import {
  beginImportRun,
  finishImportRun,
  fingerprintSourceFiles,
  recordImportError,
} from "./import-run.js";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";
import {
  parseDataRootFromValue,
  readReferenceProcedures,
} from "@microdent/bridge/import-source";

const SOURCE_TABLE = "procedures";
const SOURCE_FILE = "PROCCHRT.DBF";

export type ImportProceduresOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: "cli" | "manual" | "scheduled";
};

export type ImportProceduresResult = {
  runId: number;
  status: "success" | "partial" | "failed";
  rowCount: number;
  errorCount: number;
};

function chartFlagToSqlite(chartRelevant: boolean): number {
  return chartRelevant ? 1 : 0;
}

function procedureLabel(displayName: string | null, procedureCode: string): string {
  if (displayName !== null && displayName.length > 0) return displayName;
  return procedureCode;
}

function writeProcedures(db: SqliteDatabase, procedures: ReferenceProcedureItem[]): number {
  const importedAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO procedures (
      procedure_code,
      label,
      procedure_class,
      category_code,
      class_id,
      chart_flag,
      source_deleted,
      imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  );

  db.exec("DELETE FROM procedures;");
  for (const proc of procedures) {
    insert.run(
      proc.procedureCode,
      procedureLabel(proc.displayName, proc.procedureCode),
      proc.category,
      proc.categoryCode,
      proc.classId,
      chartFlagToSqlite(proc.chartRelevant),
      importedAt,
    );
  }
  return procedures.length;
}

/**
 * Imports safe procedure dictionary rows from `PROCCHRT.DBF` into the SQLite mirror.
 * Does not import prices, fees, or raw DBF rows.
 */
export async function importProcedures(
  options: ImportProceduresOptions,
): Promise<ImportProceduresResult> {
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

    const outcome = await readReferenceProcedures(dataRootConfig);

    if (outcome.kind === "missing_procchrt") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "PROCCHRT_DBF_NOT_FOUND",
        message: "PROCCHRT.DBF not found under data root",
      });
      finishImportRun(db, runId, { status: "failed", notes: "source file missing" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    if (outcome.kind === "read_error") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "PROCCHRT_READ_ERROR",
        message: "failed to read PROCCHRT.DBF",
      });
      finishImportRun(db, runId, { status: "failed", notes: "read failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    db.exec("BEGIN IMMEDIATE;");
    try {
      const rowCount = writeProcedures(db, outcome.procedures);
      db.exec("COMMIT;");
      finishImportRun(db, runId, {
        status: "success",
        tablesSucceeded: [SOURCE_TABLE],
        rowCounts: { procedures: rowCount },
      });
      return { runId, status: "success", rowCount, errorCount: 0 };
    } catch {
      db.exec("ROLLBACK;");
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "SQLITE_WRITE_ERROR",
        message: "sqlite transaction failed during procedure import",
      });
      finishImportRun(db, runId, { status: "failed", notes: "transaction failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }
  } finally {
    db.close();
  }
}
