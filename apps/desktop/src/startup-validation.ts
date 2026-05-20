import { existsSync } from "node:fs";
import type { DesktopConfig } from "./config.js";
import {
  maskOperatorPath,
  validateBackupDir,
  validateDataRootDir,
  validateSqlitePathFile,
  type PathValidationCode,
} from "./path-validation.js";

const WRITE_MODES = new Set<NonNullable<DesktopConfig["writeMode"]>>([
  "disabled",
  "dry-run",
  "enabled",
]);

function pathFieldLabel(code: PathValidationCode): string {
  switch (code) {
    case "empty":
      return "path is empty";
    case "not_absolute":
      return "path must be absolute";
    case "missing":
      return "path not found on disk";
    case "not_directory":
      return "expected a directory";
    case "not_file":
      return "expected a file";
    case "mkdir_failed":
      return "could not create directory";
    default:
      return code;
  }
}

/** Non-fatal startup hints (shown in logs only; masked paths). */
export function collectDesktopStartupWarnings(config: DesktopConfig): string[] {
  const warnings: string[] = [];
  const mode = config.writeMode ?? "disabled";
  if (mode !== "disabled" && !config.backupDir?.trim()) {
    warnings.push(
      "BACKUP_DIR is not set; sandbox commits require a backup folder when write mode is not disabled",
    );
  }
  return warnings;
}

/** Validate operator config before spawning the bridge (masked paths only in errors). */
export function validateDesktopStartupConfig(config: DesktopConfig): void {
  const mode = config.writeMode ?? "disabled";
  if (!WRITE_MODES.has(mode)) {
    throw new Error(
      "invalid writeMode in desktop config (allowed: disabled, dry-run, enabled)",
    );
  }

  if (!config.dataRoot?.trim()) {
    throw new Error("DATA_ROOT is required in desktop config (run setup or edit config.json)");
  }
  if (!config.sqlitePath?.trim()) {
    throw new Error("SQLITE_PATH is required in desktop config (run setup or edit config.json)");
  }

  if (config.dataRoot?.trim()) {
    const result = validateDataRootDir(config.dataRoot);
    if (!result.ok) {
      throw new Error(
        `DATA_ROOT ${pathFieldLabel(result.code)} (${maskOperatorPath(config.dataRoot)})`,
      );
    }
  }

  if (config.sqlitePath?.trim()) {
    const result = validateSqlitePathFile(config.sqlitePath);
    if (!result.ok) {
      throw new Error(
        `SQLITE_PATH ${pathFieldLabel(result.code)} (${maskOperatorPath(config.sqlitePath)})`,
      );
    }
  }

  if (config.backupDir?.trim()) {
    const result = validateBackupDir(config.backupDir);
    if (!result.ok) {
      throw new Error(
        `BACKUP_DIR ${pathFieldLabel(result.code)} (${maskOperatorPath(config.backupDir)})`,
      );
    }
  }
}

export function validateBridgeDistExists(bridgeEntry: string): void {
  if (!existsSync(bridgeEntry)) {
    throw new Error("bridge dist missing; run pnpm --filter @microdent/bridge run build");
  }
}
