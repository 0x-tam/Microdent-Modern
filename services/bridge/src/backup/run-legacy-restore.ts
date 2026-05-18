import {
  access,
  constants as fsConstants,
  copyFile,
  readFile,
  stat,
} from "node:fs/promises";
import { basename, join } from "node:path";
import { parseDataRootFromValue, type DataRootSet } from "../config.js";
import { resolvePathWithinDataRoot } from "../safety/path-sandbox.js";
import { validateWritableSandbox } from "../write-safety/index.js";
import { sha256File } from "./file-hash.js";
import {
  type LegacyBackupFileEntry,
  type LegacyBackupManifest,
} from "./run-legacy-backup.js";

export type LegacyRestoreFileResult = {
  filename: string;
  status: "restored";
  size: number;
  sha256: string;
};

export type LegacyRestoreResult = {
  operationId: string;
  workflow: string;
  backupFolder: string;
  dataRootRealpath: string;
  files: LegacyRestoreFileResult[];
};

export type RunLegacyRestoreOptions = {
  /** Timestamped backup folder containing `manifest.json` and `files/`. */
  backupFolder: string;
  dataRoot: string;
};

type VerifiedBackupFile = {
  entry: LegacyBackupFileEntry;
  sourceAbs: string;
  destAbs: string;
};

function resolveDataRootSet(dataRoot: string): DataRootSet {
  const config = parseDataRootFromValue(dataRoot);
  if (!config.configured) {
    throw new Error("dataRoot must be a non-empty absolute path");
  }
  return config;
}

function parseManifest(raw: string): LegacyBackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("manifest.json is not valid JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("manifest.json must be a JSON object");
  }

  const record = parsed as Record<string, unknown>;
  const operationId = record.operationId;
  const workflow = record.workflow;
  const files = record.files;

  if (typeof operationId !== "string" || operationId.trim() === "") {
    throw new Error("manifest.json missing operationId");
  }
  if (typeof workflow !== "string" || workflow.trim() === "") {
    throw new Error("manifest.json missing workflow");
  }
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("manifest.json files array is empty");
  }

  const entries: LegacyBackupFileEntry[] = [];
  for (const item of files) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("manifest.json files entries must be objects");
    }
    const file = item as Record<string, unknown>;
    const filename = file.filename;
    const size = file.size;
    const sha256 = file.sha256;
    if (typeof filename !== "string" || filename.trim() === "") {
      throw new Error("manifest.json file entry missing filename");
    }
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
      throw new Error(`manifest.json invalid size for ${filename}`);
    }
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(sha256)) {
      throw new Error(`manifest.json invalid sha256 for ${filename}`);
    }
    entries.push({ filename, size, sha256: sha256.toLowerCase() });
  }

  return {
    operationId,
    workflow,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    dataRootRealpath:
      typeof record.dataRootRealpath === "string" ? record.dataRootRealpath : "",
    files: entries,
  };
}

async function verifyBackupSource(
  backupFolder: string,
  entry: LegacyBackupFileEntry,
): Promise<string> {
  const sourceAbs = join(backupFolder, "files", entry.filename);
  try {
    await access(sourceAbs, fsConstants.R_OK);
  } catch {
    throw new Error(`backup file missing: ${entry.filename}`);
  }

  const info = await stat(sourceAbs);
  if (!info.isFile()) {
    throw new Error(`backup path is not a file: ${entry.filename}`);
  }
  if (info.size !== entry.size) {
    throw new Error(`backup size mismatch for ${entry.filename}`);
  }

  const sha256 = await sha256File(sourceAbs);
  if (sha256 !== entry.sha256) {
    throw new Error(`backup sha256 mismatch for ${entry.filename}`);
  }

  return sourceAbs;
}

async function verifyAllBackupSources(
  backupFolder: string,
  manifest: LegacyBackupManifest,
  dataRoot: DataRootSet,
): Promise<VerifiedBackupFile[]> {
  const verified: VerifiedBackupFile[] = [];
  for (const entry of manifest.files) {
    const sourceAbs = await verifyBackupSource(backupFolder, entry);
    const destAbs = resolvePathWithinDataRoot(dataRoot.realPath, entry.filename);
    verified.push({ entry, sourceAbs, destAbs });
  }
  return verified;
}

async function copyAndVerifyRestored(verified: VerifiedBackupFile): Promise<LegacyRestoreFileResult> {
  const { entry, sourceAbs, destAbs } = verified;
  await copyFile(sourceAbs, destAbs);

  const info = await stat(destAbs);
  if (info.size !== entry.size) {
    throw new Error(`restored size mismatch for ${entry.filename}`);
  }

  const sha256 = await sha256File(destAbs);
  if (sha256 !== entry.sha256) {
    throw new Error(`restored sha256 mismatch for ${entry.filename}`);
  }

  return {
    filename: entry.filename,
    status: "restored",
    size: entry.size,
    sha256,
  };
}

/**
 * Restores every file listed in a legacy backup manifest into a disposable write sandbox.
 * Preflights all backup sources before copying; never restores a partial file group.
 */
export async function runLegacyRestore(options: RunLegacyRestoreOptions): Promise<LegacyRestoreResult> {
  const dataRoot = resolveDataRootSet(options.dataRoot);
  const sandbox = validateWritableSandbox({
    dataRoot: dataRoot.path,
    writeMode: "dry-run",
    allowLegacyWritesValue: undefined,
  });

  const manifestPath = join(options.backupFolder, "manifest.json");
  let manifestRaw: string;
  try {
    manifestRaw = await readFile(manifestPath, "utf8");
  } catch {
    throw new Error("manifest.json not found under BACKUP_MANIFEST");
  }

  const manifest = parseManifest(manifestRaw);
  const verified = await verifyAllBackupSources(options.backupFolder, manifest, dataRoot);

  const restored: LegacyRestoreFileResult[] = [];
  for (const item of verified) {
    restored.push(await copyAndVerifyRestored(item));
  }

  return {
    operationId: manifest.operationId,
    workflow: manifest.workflow,
    backupFolder: options.backupFolder,
    dataRootRealpath: sandbox.dataRootReal,
    files: restored,
  };
}

/** Prints operation metadata and file basenames only — never full backup/data paths or row payloads. */
export function printLegacyRestoreReport(result: LegacyRestoreResult): void {
  console.log("restore: complete");
  console.log(`operationId: ${result.operationId}`);
  console.log(`workflow: ${result.workflow}`);
  console.log(`backupFolder: ${basename(result.backupFolder)}`);
  console.log(`dataRoot: ${basename(result.dataRootRealpath)}`);
  console.log(`files: ${result.files.length}`);
  for (const file of result.files) {
    console.log(`  ${file.filename} status=${file.status} size=${file.size} sha256=${file.sha256}`);
  }
}
