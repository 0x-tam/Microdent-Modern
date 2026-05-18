import { existsSync, mkdirSync, statSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";

export type PathValidationCode =
  | "empty"
  | "not_absolute"
  | "missing"
  | "not_directory"
  | "not_file"
  | "mkdir_failed";

export type PathValidationResult =
  | { ok: true; normalizedPath: string }
  | { ok: false; code: PathValidationCode };

/** Normalize operator input; reject empty. */
export function normalizeOperatorPath(value: string): string {
  return normalize(value.trim());
}

function parseAbsolutePath(value: string): PathValidationResult | { normalizedPath: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: "empty" };
  }
  const normalized = normalize(trimmed);
  if (!isAbsolute(normalized)) {
    return { ok: false, code: "not_absolute" };
  }
  return { normalizedPath: normalized };
}

/** `DATA_ROOT` must be an existing directory. */
export function validateDataRootDir(value: string): PathValidationResult {
  const base = parseAbsolutePath(value);
  if ("ok" in base) return base;

  const { normalizedPath } = base;
  if (!existsSync(normalizedPath)) {
    return { ok: false, code: "missing" };
  }
  if (!statSync(normalizedPath).isDirectory()) {
    return { ok: false, code: "not_directory" };
  }
  return { ok: true, normalizedPath };
}

/** `SQLITE_PATH` must be an existing file. */
export function validateSqlitePathFile(value: string): PathValidationResult {
  const base = parseAbsolutePath(value);
  if ("ok" in base) return base;

  const { normalizedPath } = base;
  if (!existsSync(normalizedPath)) {
    return { ok: false, code: "missing" };
  }
  if (!statSync(normalizedPath).isFile()) {
    return { ok: false, code: "not_file" };
  }
  return { ok: true, normalizedPath };
}

/** `BACKUP_DIR` must be a directory (created when missing if allowed). */
export function validateBackupDir(
  value: string,
  options: { createIfMissing?: boolean } = {},
): PathValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: "empty" };
  }

  const base = parseAbsolutePath(value);
  if ("ok" in base) return base;

  const { normalizedPath } = base;
  if (!existsSync(normalizedPath)) {
    if (options.createIfMissing) {
      try {
        mkdirSync(normalizedPath, { recursive: true });
      } catch {
        return { ok: false, code: "mkdir_failed" };
      }
    } else {
      return { ok: false, code: "missing" };
    }
  }
  if (!statSync(normalizedPath).isDirectory()) {
    return { ok: false, code: "not_directory" };
  }
  return { ok: true, normalizedPath };
}
