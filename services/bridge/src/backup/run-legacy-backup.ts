import { randomBytes } from "node:crypto";
import {
  access,
  constants as fsConstants,
  copyFile,
  mkdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import { parseDataRootFromValue, type DataRootSet } from "../config.js";
import { resolvePathWithinDataRoot } from "../safety/path-sandbox.js";
import {
  assertNotForbiddenLegacyCopyPath,
  assertNotForbiddenLegacyPath,
} from "./forbidden-path.js";
import { sha256File } from "./file-hash.js";
import { resolveBackupMembers, type BackupMember } from "./workflow-groups.js";

export type LegacyBackupFileEntry = {
  filename: string;
  size: number;
  sha256: string;
};

export type LegacyBackupManifest = {
  operationId: string;
  workflow: string;
  createdAt: string;
  dataRootRealpath: string;
  files: LegacyBackupFileEntry[];
};

export type LegacyBackupResult = {
  operationId: string;
  backupFolder: string;
  manifest: LegacyBackupManifest;
};

export type RunLegacyBackupOptions = {
  dataRoot: string;
  backupDir: string;
  workflow: string;
};

function formatUtcTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function resolveDataRootSet(dataRoot: string): DataRootSet {
  const config = parseDataRootFromValue(dataRoot);
  if (!config.configured) {
    throw new Error("dataRoot must be a non-empty absolute path");
  }
  return config;
}

async function copyFileToDir(sourceAbs: string, destDir: string, fileName: string): Promise<string> {
  const destAbs = join(destDir, fileName);
  await copyFile(sourceAbs, destAbs);
  return destAbs;
}

type ResolvedMember = {
  member: BackupMember;
  sourceAbs: string;
};

async function resolveExistingMembers(
  dataRoot: DataRootSet,
  members: readonly BackupMember[],
): Promise<ResolvedMember[]> {
  const resolved: ResolvedMember[] = [];
  for (const member of members) {
    let sourceAbs: string;
    try {
      sourceAbs = resolvePathWithinDataRoot(dataRoot.realPath, member.fileName);
    } catch {
      if (member.required) {
        throw new Error(`required file missing under DATA_ROOT: ${member.fileName}`);
      }
      continue;
    }
    try {
      await access(sourceAbs, fsConstants.R_OK);
    } catch {
      if (member.required) {
        throw new Error(`required file missing under DATA_ROOT: ${member.fileName}`);
      }
      continue;
    }
    const info = await stat(sourceAbs);
    if (!info.isFile()) {
      throw new Error(`expected file under DATA_ROOT: ${member.fileName}`);
    }
    resolved.push({ member, sourceAbs });
  }
  return resolved;
}

/**
 * File-level backup of a workflow table group from `DATA_ROOT` into `BACKUP_DIR`.
 * Copies sidecars only; never reads DBF rows or mutates source files.
 */
export async function runLegacyBackup(options: RunLegacyBackupOptions): Promise<LegacyBackupResult> {
  const dataRoot = resolveDataRootSet(options.dataRoot);
  assertNotForbiddenLegacyPath(dataRoot.realPath, "DATA_ROOT");
  assertNotForbiddenLegacyCopyPath(dataRoot.realPath, "DATA_ROOT");
  assertNotForbiddenLegacyPath(options.backupDir, "BACKUP_DIR");
  assertNotForbiddenLegacyCopyPath(options.backupDir, "BACKUP_DIR");

  const members = resolveBackupMembers(options.workflow);
  const existing = await resolveExistingMembers(dataRoot, members);
  if (existing.length === 0) {
    throw new Error("no backup files found for workflow");
  }

  const createdAt = new Date();
  const operationId = randomBytes(16).toString("hex");
  const shortOpId = randomBytes(4).toString("hex");
  const folderName = `${formatUtcTimestamp(createdAt)}__${options.workflow}__${shortOpId}`;
  const backupFolder = join(options.backupDir, folderName);
  const filesDir = join(backupFolder, "files");

  await mkdir(filesDir, { recursive: true });

  const manifestFiles: LegacyBackupFileEntry[] = [];
  for (const { member, sourceAbs } of existing) {
    const destAbs = await copyFileToDir(sourceAbs, filesDir, member.fileName);
    const info = await stat(destAbs);
    const sha256 = await sha256File(destAbs);
    manifestFiles.push({
      filename: member.fileName,
      size: info.size,
      sha256,
    });
  }

  const manifest: LegacyBackupManifest = {
    operationId,
    workflow: options.workflow,
    createdAt: createdAt.toISOString(),
    dataRootRealpath: dataRoot.realPath,
    files: manifestFiles,
  };

  await writeFile(join(backupFolder, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { operationId, backupFolder, manifest };
}

/** Prints operation metadata and file basenames only — never full backup paths or row payloads. */
export function printLegacyBackupReport(result: LegacyBackupResult): void {
  console.log("backup: created");
  console.log(`operationId: ${result.operationId}`);
  console.log(`workflow: ${result.manifest.workflow}`);
  console.log(`backupFolder: ${basename(result.backupFolder)}`);
  console.log(`files: ${result.manifest.files.length}`);
  for (const file of result.manifest.files) {
    console.log(`  ${file.filename} size=${file.size} sha256=${file.sha256}`);
  }
}
