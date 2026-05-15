import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LegacyBackupManifest } from "../../backup/run-legacy-backup.js";
import { PostWriteVerificationError } from "./post-write-error.js";

export type VerifyBackupManifestExistsInput = {
  backupDir: string;
  operationId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseManifest(raw: string): LegacyBackupManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.operationId !== "string") return null;
  if (typeof parsed.workflow !== "string") return null;
  if (typeof parsed.createdAt !== "string") return null;
  if (typeof parsed.dataRootRealpath !== "string") return null;
  if (!Array.isArray(parsed.files)) return null;
  const files: LegacyBackupManifest["files"] = [];
  for (const entry of parsed.files) {
    if (!isRecord(entry)) return null;
    if (typeof entry.filename !== "string") return null;
    if (typeof entry.size !== "number" || !Number.isFinite(entry.size)) return null;
    if (typeof entry.sha256 !== "string") return null;
    files.push({ filename: entry.filename, size: entry.size, sha256: entry.sha256 });
  }
  return {
    operationId: parsed.operationId,
    workflow: parsed.workflow,
    createdAt: parsed.createdAt,
    dataRootRealpath: parsed.dataRootRealpath,
    files,
  };
}

/**
 * Locates a backup folder under `backupDir` whose `manifest.json` matches `operationId`.
 */
export async function verifyBackupManifestExists(input: VerifyBackupManifestExistsInput): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(input.backupDir);
  } catch {
    throw new PostWriteVerificationError(
      "BACKUP_DIR_UNREADABLE",
      "backupDir is missing or not readable",
    );
  }

  for (const name of entries) {
    const manifestPath = join(input.backupDir, name, "manifest.json");
    let raw: string;
    try {
      raw = await readFile(manifestPath, "utf8");
    } catch {
      continue;
    }
    const manifest = parseManifest(raw);
    if (manifest?.operationId === input.operationId) {
      return;
    }
  }

  throw new PostWriteVerificationError(
    "BACKUP_MANIFEST_NOT_FOUND",
    `backup manifest not found for operationId=${input.operationId}`,
  );
}
