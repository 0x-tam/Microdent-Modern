import { existsSync } from "node:fs";
import type { MirrorImportRunSummary, MirrorStatusResponse } from "@microdent/contracts";
import type { SqlitePathConfig } from "../config.js";
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

type ImportRunRow = {
  run_id: number;
  finished_at: string;
  status: MirrorImportRunSummary["status"];
  tables_requested: string;
  row_counts: string | null;
  tables_succeeded: string | null;
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

/**
 * Safe mirror metadata for `GET /v1/mirror/status` — no paths, row payloads, or PHI.
 */
export function readMirrorStatus(sqlitePath: SqlitePathConfig): MirrorStatusResponse {
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
      return {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: readImportedTables(db),
        latestImportRuns: readLatestImportRuns(db),
      };
    } finally {
      db.close();
    }
  } catch {
    return emptyMirrorStatus(true);
  }
}
