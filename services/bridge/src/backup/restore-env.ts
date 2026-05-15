import path from "node:path";
import { parseDataRootFromValue } from "../config.js";
import { validateWritableSandbox } from "../write-safety/index.js";
import { assertNotForbiddenLegacyPath } from "./forbidden-path.js";

export type RestoreEnv = {
  backupFolder: string;
  dataRoot: string;
  dataRootRealpath: string;
};

export type RestoreEnvLoadResult =
  | { ok: true; env: RestoreEnv }
  | { ok: false; missing: ("BACKUP_MANIFEST" | "DATA_ROOT")[] };

function parseAbsolutePath(value: string | undefined, label: string): string | null {
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

export function loadRestoreEnvFromProcess(): RestoreEnvLoadResult {
  const missing: ("BACKUP_MANIFEST" | "DATA_ROOT")[] = [];

  let backupFolder: string | null;
  try {
    backupFolder = parseAbsolutePath(process.env.BACKUP_MANIFEST, "BACKUP_MANIFEST");
  } catch {
    throw new Error("BACKUP_MANIFEST must be an absolute path");
  }
  if (!backupFolder) {
    missing.push("BACKUP_MANIFEST");
  }

  let dataRootConfig;
  try {
    dataRootConfig = parseDataRootFromValue(process.env.DATA_ROOT);
  } catch {
    throw new Error("DATA_ROOT must be an absolute path");
  }
  if (!dataRootConfig.configured) {
    missing.push("DATA_ROOT");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const dataRoot = (dataRootConfig as { configured: true; path: string }).path;
  const sandbox = validateWritableSandbox({
    dataRoot,
    writeMode: "dry-run",
    allowLegacyWritesValue: undefined,
  });

  assertNotForbiddenLegacyPath(backupFolder!, "BACKUP_MANIFEST");

  return {
    ok: true,
    env: {
      backupFolder: backupFolder!,
      dataRoot: sandbox.dataRoot,
      dataRootRealpath: sandbox.dataRootReal,
    },
  };
}
