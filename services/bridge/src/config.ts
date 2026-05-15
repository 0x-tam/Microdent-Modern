import { WriteModeSchema, type WriteMode } from "@microdent/contracts";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { validateWritableSandbox } from "./write-safety/validate-writable-sandbox.js";

export type { WriteMode };

export type DataRootUnset = { configured: false };
export type DataRootSet = {
  configured: true;
  /** Normalized absolute path from env (may differ from realPath on disk). */
  path: string;
  /** Directory realpath used for sandbox prefix checks (`realpathSync` when the path exists). */
  realPath: string;
};

export type DataRootConfig = DataRootUnset | DataRootSet;

export type SqlitePathUnset = { configured: false };
export type SqlitePathSet = {
  configured: true;
  /** Normalized absolute path from env. */
  path: string;
};

export type SqlitePathConfig = SqlitePathUnset | SqlitePathSet;

export type BackupDirUnset = { configured: false };
export type BackupDirSet = { configured: true; path: string };
export type BackupDirConfig = BackupDirUnset | BackupDirSet;

export type BridgeConfig = {
  listen: { host: string; port: number };
  dataRoot: DataRootConfig;
  sqlitePath: SqlitePathConfig;
  backupDir: BackupDirConfig;
  writeMode: WriteMode;
};

/** Partial bridge config for tests and `createBridgeApp` overrides. */
export type BridgeConfigInput = {
  listen: { host: string; port: number };
  dataRoot: DataRootConfig;
  sqlitePath?: SqlitePathConfig;
  backupDir?: BackupDirConfig;
  writeMode?: WriteMode;
};

export function normalizeBridgeConfig(input: BridgeConfigInput): BridgeConfig {
  return {
    listen: input.listen,
    dataRoot: input.dataRoot,
    sqlitePath: input.sqlitePath ?? { configured: false },
    backupDir: input.backupDir ?? parseBackupDirFromValue(undefined),
    writeMode: input.writeMode ?? parseWriteModeFromValue(undefined),
  };
}

/**
 * Parse `WRITE_MODE` from a string value (use `process.env.WRITE_MODE` in production).
 * Missing, empty, or unknown values resolve to `disabled` (fail closed).
 */
export function parseWriteModeFromValue(value: string | undefined): WriteMode {
  if (value === undefined) {
    return "disabled";
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") {
    return "disabled";
  }
  const parsed = WriteModeSchema.safeParse(trimmed);
  if (!parsed.success) {
    return "disabled";
  }
  return parsed.data;
}

export function loadWriteModeFromEnv(): WriteMode {
  return parseWriteModeFromValue(process.env.WRITE_MODE);
}

/**
 * True when `WRITE_MODE=enabled` and `BACKUP_DIR` is configured (sandbox + allow flag checked per request).
 */
export function writesPermitted(config: BridgeConfig): boolean {
  return config.writeMode === "enabled" && config.backupDir.configured && config.dataRoot.configured;
}

/** True when DATA_ROOT passes the disposable sandbox marker guard and writes are not disabled. */
export function isWritableSandboxReady(config: BridgeConfig): boolean {
  if (!config.dataRoot.configured || config.writeMode === "disabled") {
    return false;
  }
  try {
    validateWritableSandbox({
      dataRoot: config.dataRoot.path,
      writeMode: config.writeMode,
      allowLegacyWritesValue: process.env.ALLOW_LEGACY_WRITES,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse `DATA_ROOT` from a string value (use `process.env.DATA_ROOT` in production).
 * Empty / whitespace means not configured. When set, the path must be absolute.
 */
export function parseDataRootFromValue(value: string | undefined): DataRootConfig {
  if (value === undefined) {
    return { configured: false };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { configured: false };
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`DATA_ROOT must be an absolute path, got: ${JSON.stringify(trimmed)}`);
  }
  const normalized = path.normalize(trimmed);
  let realPath: string;
  if (existsSync(normalized)) {
    realPath = realpathSync.native(normalized);
  } else {
    realPath = path.resolve(normalized);
  }
  return { configured: true, path: normalized, realPath };
}

export function loadDataRootFromEnv(): DataRootConfig {
  return parseDataRootFromValue(process.env.DATA_ROOT);
}

export function loadListenOptions(): { host: string; port: number } {
  const host = process.env.BRIDGE_HOST ?? "127.0.0.1";
  const raw = process.env.BRIDGE_PORT ?? "17890";
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid BRIDGE_PORT: ${raw}`);
  }
  return { host, port };
}

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

/**
 * Parse `BACKUP_DIR` from a string value (use `process.env.BACKUP_DIR` in production).
 * Empty / whitespace means not configured. When set, the path must be absolute.
 */
export function parseBackupDirFromValue(value: string | undefined): BackupDirConfig {
  if (value === undefined) {
    return { configured: false };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { configured: false };
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`BACKUP_DIR must be an absolute path, got: ${JSON.stringify(trimmed)}`);
  }
  return { configured: true, path: path.normalize(trimmed) };
}

export function loadBackupDirFromEnv(): BackupDirConfig {
  return parseBackupDirFromValue(process.env.BACKUP_DIR);
}

export function loadBridgeConfig(): BridgeConfig {
  return {
    listen: loadListenOptions(),
    dataRoot: loadDataRootFromEnv(),
    sqlitePath: loadSqlitePathFromEnv(),
    backupDir: loadBackupDirFromEnv(),
    writeMode: loadWriteModeFromEnv(),
  };
}
