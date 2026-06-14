import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  MirrorImportRunSummary,
  MirrorSourceFileStatus,
  MirrorSourceTableStatus,
  MirrorStatusResponse,
} from "@microdent/contracts";
import type { DataRootConfig, SqlitePathConfig } from "../config.js";
import { openDatabaseSync } from "./node-sqlite.js";

/** Domain mirror tables that may appear in `importedTables` (allowlist for SQL). */
const DOMAIN_TABLE_NAMES = [
  "appointments",
  "doctors",
  "medical_summary",
  "patients",
  "procedures",
  "schedule_rooms",
  "treatments",
] as const;

const DOMAIN_TABLE_SET = new Set<string>(DOMAIN_TABLE_NAMES);

const SOURCE_FILES_BY_TABLE: Record<(typeof DOMAIN_TABLE_NAMES)[number], readonly string[]> = {
  appointments: ["SCHEDULE.DBF"],
  doctors: ["DOCTORS.DBF"],
  medical_summary: ["MEDICAL.DBF"],
  patients: ["PATIENT.DBF"],
  procedures: ["PROCCHRT.DBF"],
  schedule_rooms: ["SC_ROOM.DBF", "DICSCHED.DBF"],
  treatments: ["OPERTBL.DBF"],
};

type ImportRunRow = {
  run_id: number;
  finished_at: string;
  status: MirrorImportRunSummary["status"];
  tables_requested: string;
  row_counts: string | null;
  tables_succeeded: string | null;
};

type SnapshotRow = {
  table_name: string;
  source_file: string;
  file_state: "present" | "missing" | "unreadable";
  size_bytes: number | null;
  mtime_ms: number | null;
  captured_at: string;
};

function emptyMirrorStatus(sqliteConfigured: boolean): MirrorStatusResponse {
  return {
    sqliteConfigured,
    sqliteUsable: false,
    importedTables: [],
    latestImportRuns: [],
  };
}

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (raw === null || raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore malformed audit JSON */
  }
  return {};
}

function parseJsonStringArray(raw: string | null): string[] {
  if (raw === null || raw.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore malformed audit JSON */
  }
  return [];
}

function tableNamesFromRun(run: ImportRunRow): string[] {
  const fromCounts = Object.keys(parseJsonObject(run.row_counts));
  const fromSucceeded = parseJsonStringArray(run.tables_succeeded);
  const fromRequested = parseJsonStringArray(run.tables_requested);
  const names = new Set<string>([...fromCounts, ...fromSucceeded, ...fromRequested]);
  return [...names].filter((n) => DOMAIN_TABLE_SET.has(n));
}

function readImportedTables(db: ReturnType<typeof openDatabaseSync>): string[] {
  const imported: string[] = [];
  for (const tableName of DOMAIN_TABLE_NAMES) {
    const exists = db
      .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(tableName) as { ok: number } | undefined;
    if (exists === undefined) continue;
    const countRow = db.prepare(`SELECT COUNT(*) AS c FROM "${tableName}"`).get() as { c: number };
    if (Number(countRow.c) > 0) imported.push(tableName);
  }
  return imported.sort();
}

function readLatestImportRuns(db: ReturnType<typeof openDatabaseSync>): MirrorImportRunSummary[] {
  const runs = db
    .prepare(
      `SELECT run_id, finished_at, status, tables_requested, row_counts, tables_succeeded
       FROM import_runs
       WHERE finished_at IS NOT NULL
       ORDER BY finished_at DESC
       LIMIT 500`,
    )
    .all() as ImportRunRow[];

  const errorCountStmt = db.prepare(
    `SELECT COUNT(*) AS c FROM import_errors WHERE run_id = ?`,
  );
  const latestByTable = new Map<string, MirrorImportRunSummary>();

  for (const run of runs) {
    const rowCounts = parseJsonObject(run.row_counts);
    for (const tableName of tableNamesFromRun(run)) {
      if (latestByTable.has(tableName)) continue;
      const rawCount = rowCounts[tableName];
      const rowCount =
        typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount >= 0
          ? Math.trunc(rawCount)
          : 0;
      const errorRow = errorCountStmt.get(run.run_id) as { c: number };
      latestByTable.set(tableName, {
        tableName,
        status: run.status,
        rowCount,
        errorCount: Number(errorRow.c) || 0,
        finishedAt: run.finished_at,
      });
    }
  }

  return [...latestByTable.values()].sort((a, b) => a.tableName.localeCompare(b.tableName));
}

function hasAppliedMigrations(db: ReturnType<typeof openDatabaseSync>): boolean {
  const table = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'`)
    .get() as { ok: number } | undefined;
  if (table === undefined) return false;
  const row = db.prepare(`SELECT COUNT(*) AS c FROM schema_migrations`).get() as { c: number };
  return Number(row.c) > 0;
}

function hasTable(db: ReturnType<typeof openDatabaseSync>, tableName: string): boolean {
  const table = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tableName) as { ok: number } | undefined;
  return table !== undefined;
}

function readCurrentSourceFile(
  dataRoot: DataRootConfig,
  sourceFile: string,
): Pick<MirrorSourceFileStatus, "currentSizeBytes" | "currentMtimeMs" | "status"> {
  if (!dataRoot.configured) {
    return { status: "unknown", currentSizeBytes: null, currentMtimeMs: null };
  }
  try {
    const st = statSync(join(dataRoot.path, sourceFile));
    return {
      status: "unchanged",
      currentSizeBytes: st.size,
      currentMtimeMs: st.mtimeMs,
    };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return {
      status: code === "ENOENT" ? "missing" : "unreadable",
      currentSizeBytes: null,
      currentMtimeMs: null,
    };
  }
}

function deriveFileStatus(
  snapshot: SnapshotRow,
  current: Pick<MirrorSourceFileStatus, "currentSizeBytes" | "currentMtimeMs" | "status">,
): MirrorSourceFileStatus["status"] {
  if (current.status === "unknown" || current.status === "missing" || current.status === "unreadable") {
    return current.status;
  }
  if (snapshot.file_state !== "present") return "changed";
  if (snapshot.size_bytes !== current.currentSizeBytes) return "changed";
  if (snapshot.mtime_ms !== current.currentMtimeMs) return "changed";
  return "unchanged";
}

function deriveTableStatus(sourceFiles: MirrorSourceFileStatus[]): MirrorSourceTableStatus["status"] {
  if (sourceFiles.some((file) => file.status === "unreadable")) return "unreadable";
  if (sourceFiles.some((file) => file.status === "missing")) return "missing";
  if (sourceFiles.some((file) => file.status === "changed")) return "changed";
  if (sourceFiles.some((file) => file.status === "unknown")) return "unknown";
  return "unchanged";
}

function readSourceFileStatuses(
  db: ReturnType<typeof openDatabaseSync>,
  dataRoot: DataRootConfig | undefined,
): MirrorSourceTableStatus[] {
  if (dataRoot === undefined || !hasTable(db, "import_source_file_snapshots")) return [];
  const latest = db.prepare(
    `SELECT table_name, source_file, file_state, size_bytes, mtime_ms, captured_at
     FROM import_source_file_snapshots
     WHERE table_name = ? AND source_file = ?
     ORDER BY snapshot_id DESC
     LIMIT 1`,
  );
  const checkedAt = new Date().toISOString();
  const statuses: MirrorSourceTableStatus[] = [];

  for (const tableName of DOMAIN_TABLE_NAMES) {
    const sourceFiles: MirrorSourceFileStatus[] = [];
    for (const sourceFile of SOURCE_FILES_BY_TABLE[tableName]) {
      const snapshot = latest.get(tableName, sourceFile) as SnapshotRow | undefined;
      if (snapshot === undefined) continue;
      const current = readCurrentSourceFile(dataRoot, sourceFile);
      sourceFiles.push({
        sourceFile,
        status: deriveFileStatus(snapshot, current),
        importedSizeBytes: snapshot.size_bytes,
        importedMtimeMs: snapshot.mtime_ms,
        currentSizeBytes: current.currentSizeBytes,
        currentMtimeMs: current.currentMtimeMs,
      });
    }
    if (sourceFiles.length > 0) {
      statuses.push({
        tableName,
        status: deriveTableStatus(sourceFiles),
        checkedAt,
        sourceFiles,
      });
    }
  }

  return statuses;
}

/**
 * Safe mirror metadata for `GET /v1/mirror/status` — no paths, row payloads, or PHI.
 */
export function readMirrorStatus(
  sqlitePath: SqlitePathConfig,
  dataRoot?: DataRootConfig,
): MirrorStatusResponse {
  if (!sqlitePath.configured) {
    return emptyMirrorStatus(false);
  }

  const filePath = sqlitePath.path;
  if (!existsSync(filePath)) {
    return emptyMirrorStatus(true);
  }

  try {
    const db = openDatabaseSync(filePath, { readOnly: true });
    try {
      if (!hasAppliedMigrations(db)) {
        return emptyMirrorStatus(true);
      }
      const sourceFileStatuses = readSourceFileStatuses(db, dataRoot);
      return {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: readImportedTables(db),
        latestImportRuns: readLatestImportRuns(db),
        sourceChangedSinceImport: sourceFileStatuses.some((table) =>
          ["changed", "missing", "unreadable"].includes(table.status),
        ),
        sourceFileStatuses,
      };
    } finally {
      db.close();
    }
  } catch {
    return emptyMirrorStatus(true);
  }
}
