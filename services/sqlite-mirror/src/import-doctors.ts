import { applyMigrations } from "./apply-migrations.js";
import {
  beginImportRun,
  finishImportRun,
  fingerprintSourceFiles,
  recordImportError,
} from "./import-run.js";
import type { ReferenceDoctorItem } from "@microdent/contracts";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";
import {
  parseDataRootFromValue,
  readReferenceDoctorsFromDbf,
} from "@microdent/bridge/import-source";

const SOURCE_TABLE = "doctors";
const SOURCE_FILE = "DOCTORS.DBF";

export type ImportDoctorsOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: "cli" | "manual" | "scheduled";
};

export type ImportDoctorsResult = {
  runId: number;
  status: "success" | "partial" | "failed";
  rowCount: number;
  errorCount: number;
};

function activeToSqlite(active: boolean | null): number | null {
  if (active === true) return 1;
  if (active === false) return 0;
  return null;
}

function writeDoctors(db: SqliteDatabase, doctors: ReferenceDoctorItem[]): number {
  const importedAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO doctors (
      doctor_id, display_label, active, source_deleted, imported_at
    ) VALUES (?, ?, ?, 0, ?)`,
  );

  db.exec("DELETE FROM doctors;");
  for (const doctor of doctors) {
    insert.run(doctor.doctorId, doctor.displayName, activeToSqlite(doctor.active), importedAt);
  }
  return doctors.length;
}

/**
 * Imports safe doctor reference rows from `DOCTORS.DBF` into the SQLite mirror.
 * Does not log row payloads or private fields.
 */
export async function importDoctors(options: ImportDoctorsOptions): Promise<ImportDoctorsResult> {
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

    const outcome = await readReferenceDoctorsFromDbf(dataRootConfig);

    if (outcome.kind === "missing_table") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "DOCTORS_DBF_NOT_FOUND",
        message: "DOCTORS.DBF not found under data root",
      });
      finishImportRun(db, runId, { status: "failed", notes: "source file missing" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    if (outcome.kind === "read_error") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "DOCTORS_READ_ERROR",
        message: "failed to read DOCTORS.DBF",
      });
      finishImportRun(db, runId, { status: "failed", notes: "read failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    db.exec("BEGIN IMMEDIATE;");
    try {
      const rowCount = writeDoctors(db, outcome.doctors);
      db.exec("COMMIT;");
      finishImportRun(db, runId, {
        status: "success",
        tablesSucceeded: [SOURCE_TABLE],
        rowCounts: { doctors: rowCount },
      });
      return { runId, status: "success", rowCount, errorCount: 0 };
    } catch {
      db.exec("ROLLBACK;");
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILE,
        errorCode: "SQLITE_WRITE_ERROR",
        message: "sqlite transaction failed during doctor import",
      });
      finishImportRun(db, runId, { status: "failed", notes: "transaction failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }
  } finally {
    db.close();
  }
}
