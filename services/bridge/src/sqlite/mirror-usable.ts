import { existsSync } from "node:fs";
import type { SqlitePathConfig, SqlitePathSet } from "../config.js";
import { openDatabaseSync } from "./node-sqlite.js";

/**
 * Returns true when `SQLITE_PATH` is configured, the file exists, opens read-only,
 * and contains the named mirror table (migrations + import applied).
 */
export function isSqliteMirrorUsable(
  sqlitePath: SqlitePathConfig,
  tableName: string,
): sqlitePath is SqlitePathSet {
  if (!sqlitePath.configured) return false;
  const filePath = sqlitePath.path;
  if (!existsSync(filePath)) return false;

  try {
    const db = openDatabaseSync(filePath, { readOnly: true });
    try {
      const row = db
        .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get(tableName) as { ok: number } | undefined;
      return row !== undefined;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
