import { existsSync } from "node:fs";
import type { WriteAuditRecentEntry, WriteAuditRecentResponse } from "@microdent/contracts";
import type { SqlitePathConfig } from "../config.js";
import { openDatabaseSync } from "./node-sqlite.js";

const DEFAULT_LIMIT = 50;

type WriteAuditRow = {
  operation_id: string;
  workflow_type: string;
  terminal_status: WriteAuditRecentEntry["terminalStatus"];
  requested_at: string;
  finished_at: string | null;
};

function emptyWriteAuditRecent(sqliteConfigured: boolean): WriteAuditRecentResponse {
  return {
    sqliteConfigured,
    sqliteUsable: false,
    entries: [],
  };
}

function hasWriteAuditTable(db: ReturnType<typeof openDatabaseSync>): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'write_audit_log'`)
    .get() as { ok: number } | undefined;
  return row !== undefined;
}

function readRecentEntries(db: ReturnType<typeof openDatabaseSync>): WriteAuditRecentEntry[] {
  const rows = db
    .prepare(
      `SELECT operation_id, workflow_type, terminal_status, requested_at, finished_at
       FROM write_audit_log
       ORDER BY requested_at DESC
       LIMIT ?`,
    )
    .all(DEFAULT_LIMIT) as WriteAuditRow[];

  return rows.map((row) => ({
    operationId: row.operation_id,
    workflow: row.workflow_type,
    terminalStatus: row.terminal_status,
    requestedAt: row.requested_at,
    finishedAt: row.finished_at,
  }));
}

/**
 * Safe write-audit metadata for `GET /v1/meta/write-audit-recent` — no paths, payloads, or PHI.
 */
export function readWriteAuditRecent(sqlitePath: SqlitePathConfig): WriteAuditRecentResponse {
  if (!sqlitePath.configured) {
    return emptyWriteAuditRecent(false);
  }

  const filePath = sqlitePath.path;
  if (!existsSync(filePath)) {
    return emptyWriteAuditRecent(true);
  }

  try {
    const db = openDatabaseSync(filePath, { readOnly: true });
    try {
      if (!hasWriteAuditTable(db)) {
        return emptyWriteAuditRecent(true);
      }
      return {
        sqliteConfigured: true,
        sqliteUsable: true,
        entries: readRecentEntries(db),
      };
    } finally {
      db.close();
    }
  } catch {
    return emptyWriteAuditRecent(true);
  }
}
