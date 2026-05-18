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
  | { ok: true; normalizedPath: string; warnings?: string[] }
  | { ok: false; code: PathValidationCode };

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:[/\\]/;
const UNC_PATH = /^[/\\]{2}(?![/\\?%*:|"<>])[^/\\]+[/\\]/;

/** True for POSIX absolutes, `C:\...` drive paths, and `\\server\share` UNC roots. */
export function isOperatorAbsolutePath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (isAbsolute(trimmed)) return true;
  if (WINDOWS_DRIVE_PATH.test(trimmed)) return true;
  if (UNC_PATH.test(trimmed)) return true;
  return false;
}

/** Non-blocking hints for operator-entered paths (e.g. UNC). */
export function getOperatorPathWarnings(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.length === 0) return [];
  const warnings: string[] = [];
  if (UNC_PATH.test(trimmed)) {
    warnings.push(
      "UNC network paths can be slow or unreliable; prefer a local drive letter when possible.",
    );
  }
  return warnings;
}

/** Normalize operator input; reject empty. */
export function normalizeOperatorPath(value: string): string {
  const trimmed = value.trim();
  if (WINDOWS_DRIVE_PATH.test(trimmed)) {
    return normalize(trimmed.replace(/\\/g, "/"));
  }
  return normalize(trimmed);
}

function parseAbsolutePath(value: string): PathValidationResult | { normalizedPath: string; warnings?: string[] } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: "empty" };
  }
  const normalized = normalizeOperatorPath(trimmed);
  if (!isOperatorAbsolutePath(trimmed)) {
    return { ok: false, code: "not_absolute" };
  }
  const warnings = getOperatorPathWarnings(trimmed);
  return {
    normalizedPath: normalized,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function success(
  normalizedPath: string,
  warnings?: string[],
): PathValidationResult {
  return {
    ok: true,
    normalizedPath,
    ...(warnings && warnings.length > 0 ? { warnings } : {}),
  };
}

/** `DATA_ROOT` must be an existing directory. */
export function validateDataRootDir(value: string): PathValidationResult {
  const base = parseAbsolutePath(value);
  if ("ok" in base) return base;

  const { normalizedPath, warnings } = base;
  if (!existsSync(normalizedPath)) {
    return { ok: false, code: "missing" };
  }
  if (!statSync(normalizedPath).isDirectory()) {
    return { ok: false, code: "not_directory" };
  }
  return success(normalizedPath, warnings);
}

/** `SQLITE_PATH` must be an existing file. */
export function validateSqlitePathFile(value: string): PathValidationResult {
  const base = parseAbsolutePath(value);
  if ("ok" in base) return base;

  const { normalizedPath, warnings } = base;
  if (!existsSync(normalizedPath)) {
    return { ok: false, code: "missing" };
  }
  if (!statSync(normalizedPath).isFile()) {
    return { ok: false, code: "not_file" };
  }
  return success(normalizedPath, warnings);
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

  const { normalizedPath, warnings } = base;
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
  return success(normalizedPath, warnings);
}
