import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDatabase } from "./node-sqlite.js";

export type ImportTrigger = "cli" | "manual" | "scheduled";
export type ImportRunStatus = "running" | "success" | "partial" | "failed";
export type SourceFileState = "present" | "missing" | "unreadable";

export type SourceFileSnapshot = {
  tableName: string;
  sourceFile: string;
  fileState: SourceFileState;
  sizeBytes: number | null;
  mtimeMs: number | null;
};

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

export function snapshotSourceFiles(
  dataRootPath: string,
  tableName: string,
  basenames: readonly string[],
): SourceFileSnapshot[] {
  return basenames.map((sourceFile) => {
    try {
      const st = statSync(join(dataRootPath, sourceFile));
      return {
        tableName,
        sourceFile,
        fileState: "present",
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
      };
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      return {
        tableName,
        sourceFile,
        fileState: code === "ENOENT" ? "missing" : "unreadable",
        sizeBytes: null,
        mtimeMs: null,
      };
    }
  });
}

export function recordSourceFileSnapshots(
  db: SqliteDatabase,
  runId: number,
  snapshots: readonly SourceFileSnapshot[],
): void {
  if (snapshots.length === 0) return;
  const capturedAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO import_source_file_snapshots (
      run_id, table_name, source_file, file_state, size_bytes, mtime_ms, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const snapshot of snapshots) {
    insert.run(
      runId,
      snapshot.tableName,
      snapshot.sourceFile,
      snapshot.fileState,
      snapshot.sizeBytes,
      snapshot.mtimeMs,
      capturedAt,
    );
  }
}

export function latestSourceSnapshotMatches(
  db: SqliteDatabase,
  currentSnapshots: readonly SourceFileSnapshot[],
): boolean {
  if (currentSnapshots.length === 0) return false;
  const latest = db.prepare(
    `SELECT file_state, size_bytes, mtime_ms
     FROM import_source_file_snapshots
     WHERE table_name = ? AND source_file = ?
     ORDER BY snapshot_id DESC
     LIMIT 1`,
  );
  for (const current of currentSnapshots) {
    const previous = latest.get(current.tableName, current.sourceFile) as
      | { file_state: SourceFileState; size_bytes: number | null; mtime_ms: number | null }
      | undefined;
    if (previous === undefined) return false;
    if (previous.file_state !== current.fileState) return false;
    if ((previous.size_bytes ?? null) !== current.sizeBytes) return false;
    if ((previous.mtime_ms ?? null) !== current.mtimeMs) return false;
  }
  return true;
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
