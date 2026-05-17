import { access, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { sha256File } from "./file-hash.js";
import type { LegacyBackupManifest } from "./run-legacy-backup.js";

export type VerifyLegacyBackupOptions = {
  /** Folder containing `manifest.json` and `files/`. */
  backupFolder: string;
  /** When set, also verify live files under DATA_ROOT match manifest hashes. */
  dataRoot?: string;
};

export type VerifyLegacyBackupResult = {
  ok: true;
  operationId: string;
  workflow: string;
  filesVerified: number;
};

async function readManifest(backupFolder: string): Promise<LegacyBackupManifest> {
  const raw = await readFile(join(backupFolder, "manifest.json"), "utf8");
  return JSON.parse(raw) as LegacyBackupManifest;
}

/**
 * Read-only verification: manifest entries match copied files (and optionally live DATA_ROOT).
 */
export async function verifyLegacyBackup(
  options: VerifyLegacyBackupOptions,
): Promise<VerifyLegacyBackupResult> {
  const manifest = await readManifest(options.backupFolder);
  if (!manifest.operationId || !manifest.workflow || !Array.isArray(manifest.files)) {
    throw new Error("invalid manifest.json");
  }
  if (manifest.files.length === 0) {
    throw new Error("manifest lists no files");
  }

  const filesDir = join(options.backupFolder, "files");
  for (const entry of manifest.files) {
    const copiedPath = join(filesDir, entry.filename);
    await access(copiedPath, fsConstants.R_OK);
    const info = await stat(copiedPath);
    if (info.size !== entry.size) {
      throw new Error(`size mismatch for ${entry.filename} in backup files/`);
    }
    const sha256 = await sha256File(copiedPath);
    if (sha256 !== entry.sha256) {
      throw new Error(`sha256 mismatch for ${entry.filename} in backup files/`);
    }

    if (options.dataRoot) {
      const livePath = join(options.dataRoot, entry.filename);
      await access(livePath, fsConstants.R_OK);
      const liveInfo = await stat(livePath);
      if (liveInfo.size !== entry.size) {
        throw new Error(`size mismatch for ${entry.filename} under DATA_ROOT`);
      }
      const liveSha = await sha256File(livePath);
      if (liveSha !== entry.sha256) {
        throw new Error(`sha256 mismatch for ${entry.filename} under DATA_ROOT`);
      }
    }
  }

  return {
    ok: true,
    operationId: manifest.operationId,
    workflow: manifest.workflow,
    filesVerified: manifest.files.length,
  };
}

export function printLegacyBackupVerifyReport(result: VerifyLegacyBackupResult): void {
  console.log("backup-verify: ok");
  console.log(`operationId: ${result.operationId}`);
  console.log(`workflow: ${result.workflow}`);
  console.log(`filesVerified: ${result.filesVerified}`);
}
