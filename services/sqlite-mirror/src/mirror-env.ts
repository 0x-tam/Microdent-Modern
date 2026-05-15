import path from "node:path";
import { parseDataRootFromValue, type DataRootConfig } from "@microdent/bridge/import-source";

export type SqlitePathConfig =
  | { configured: false }
  | { configured: true; path: string };

export type MirrorEnv = {
  dataRoot: string;
  sqlitePath: string;
};

/**
 * Parse `SQLITE_PATH` from a string value (use `process.env.SQLITE_PATH` in production).
 * Empty / whitespace means not configured. When set, the path must be absolute.
 */
export function parseSqlitePathFromValue(value: string | undefined): SqlitePathConfig {
  if (value === undefined) {
    return { configured: false };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { configured: false };
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`SQLITE_PATH must be an absolute path, got: ${JSON.stringify(trimmed)}`);
  }
  return { configured: true, path: path.normalize(trimmed) };
}

export function loadSqlitePathFromEnv(): SqlitePathConfig {
  return parseSqlitePathFromValue(process.env.SQLITE_PATH);
}

export type MirrorEnvLoadResult =
  | { ok: true; env: MirrorEnv }
  | { ok: false; missing: ("DATA_ROOT" | "SQLITE_PATH")[] };

/**
 * Loads mirror import env from `process.env`. Throws when a set path is relative.
 */
export function loadMirrorEnvFromProcess(): MirrorEnvLoadResult {
  const missing: ("DATA_ROOT" | "SQLITE_PATH")[] = [];

  let dataRootConfig: DataRootConfig;
  try {
    dataRootConfig = parseDataRootFromValue(process.env.DATA_ROOT);
  } catch {
    throw new Error("DATA_ROOT must be an absolute path");
  }
  if (!dataRootConfig.configured) {
    missing.push("DATA_ROOT");
  }

  let sqliteConfig: SqlitePathConfig;
  try {
    sqliteConfig = loadSqlitePathFromEnv();
  } catch {
    throw new Error("SQLITE_PATH must be an absolute path");
  }
  if (!sqliteConfig.configured) {
    missing.push("SQLITE_PATH");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    env: {
      dataRoot: (dataRootConfig as { configured: true; path: string }).path,
      sqlitePath: (sqliteConfig as { configured: true; path: string }).path,
    },
  };
}
