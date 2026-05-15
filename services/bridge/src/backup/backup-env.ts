import path from "node:path";
import { parseDataRootFromValue } from "../config.js";
import { assertNotForbiddenLegacyPath } from "./forbidden-path.js";
import { listSupportedBackupWorkflows, resolveBackupMembers } from "./workflow-groups.js";

export type BackupEnv = {
  dataRoot: string;
  dataRootRealpath: string;
  backupDir: string;
  workflow: string;
};

export type BackupEnvLoadResult =
  | { ok: true; env: BackupEnv }
  | { ok: false; missing: ("DATA_ROOT" | "BACKUP_DIR" | "WORKFLOW")[] };

function parseAbsoluteDir(value: string | undefined, label: string): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be an absolute path`);
  }
  return path.normalize(trimmed);
}

export function loadBackupEnvFromProcess(): BackupEnvLoadResult {
  const missing: ("DATA_ROOT" | "BACKUP_DIR" | "WORKFLOW")[] = [];

  let dataRootConfig;
  try {
    dataRootConfig = parseDataRootFromValue(process.env.DATA_ROOT);
  } catch {
    throw new Error("DATA_ROOT must be an absolute path");
  }
  if (!dataRootConfig.configured) {
    missing.push("DATA_ROOT");
  }

  let backupDir: string | null;
  try {
    backupDir = parseAbsoluteDir(process.env.BACKUP_DIR, "BACKUP_DIR");
  } catch {
    throw new Error("BACKUP_DIR must be an absolute path");
  }
  if (!backupDir) {
    missing.push("BACKUP_DIR");
  }

  const workflow = process.env.WORKFLOW?.trim() ?? "";
  if (!workflow) {
    missing.push("WORKFLOW");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const dataRoot = (dataRootConfig as { configured: true; path: string }).path;
  const dataRootRealpath = (dataRootConfig as { configured: true; realPath: string }).realPath;

  assertNotForbiddenLegacyPath(dataRootRealpath, "DATA_ROOT");
  assertNotForbiddenLegacyPath(backupDir!, "BACKUP_DIR");

  resolveBackupMembers(workflow);

  return {
    ok: true,
    env: {
      dataRoot,
      dataRootRealpath,
      backupDir: backupDir!,
      workflow,
    },
  };
}

export function formatSupportedWorkflows(): string {
  return listSupportedBackupWorkflows().join(", ");
}
