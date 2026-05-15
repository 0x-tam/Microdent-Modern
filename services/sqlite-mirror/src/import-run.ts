import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDatabase } from "./node-sqlite.js";

export type ImportTrigger = "cli" | "manual" | "scheduled";
export type ImportRunStatus = "running" | "success" | "partial" | "failed";

export function fingerprintSourceFiles(
  dataRootPath: string,
  basenames: readonly string[],
): string {
  const parts = basenames.map((name) => {
    const abs = join(dataRootPath, name);
    try {
      const st = statSync(abs);
      return `${name}:${st.size}:${st.mtimeMs}`;
    } catch {
      return `${name}:missing`;
    }
  });
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 32);
}

export function beginImportRun(
  db: SqliteDatabase,
  opts: {
    trigger: ImportTrigger;
    tablesRequested: string[];
    dataRootFingerprint?: string | null;
  },
): number {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO import_runs (
        started_at, status, "trigger", data_root_fingerprint, tables_requested
      ) VALUES (?, 'running', ?, ?, ?)`,
    )
    .run(
      startedAt,
      opts.trigger,
      opts.dataRootFingerprint ?? null,
      JSON.stringify(opts.tablesRequested),
    );
  return Number(result.lastInsertRowid);
}

export function recordImportError(
  db: SqliteDatabase,
  runId: number,
  opts: {
    sourceTable: string;
    sourceFile: string;
    errorCode: string;
    message: string;
    rowIndex?: number | null;
  },
): void {
  db.prepare(
    `INSERT INTO import_errors (
      run_id, source_table, source_file, error_code, message, row_index, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    opts.sourceTable,
    opts.sourceFile,
    opts.errorCode,
    opts.message,
    opts.rowIndex ?? null,
    new Date().toISOString(),
  );
}

export function finishImportRun(
  db: SqliteDatabase,
  runId: number,
  opts: {
    status: ImportRunStatus;
    tablesSucceeded?: string[];
    rowCounts?: Record<string, number>;
    notes?: string | null;
  },
): void {
  db.prepare(
    `UPDATE import_runs SET
      finished_at = ?,
      status = ?,
      tables_succeeded = ?,
      row_counts = ?,
      notes = ?
    WHERE run_id = ?`,
  ).run(
    new Date().toISOString(),
    opts.status,
    opts.tablesSucceeded !== undefined ? JSON.stringify(opts.tablesSucceeded) : null,
    opts.rowCounts !== undefined ? JSON.stringify(opts.rowCounts) : null,
    opts.notes ?? null,
    runId,
  );
}
