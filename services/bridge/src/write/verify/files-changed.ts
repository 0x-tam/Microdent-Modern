import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, constants as fsConstants, stat } from "node:fs/promises";
import { parseDataRootFromValue, type DataRootSet } from "../../config.js";
import { resolveBackupMembers } from "../../backup/workflow-groups.js";
import { resolvePathWithinDataRoot } from "../../safety/path-sandbox.js";
import { PostWriteVerificationError } from "./post-write-error.js";

export type FileFingerprint = {
  size: number;
  sha256: string;
};

export type SnapshotWorkflowFileFingerprintsInput = {
  dataRoot: string | DataRootSet;
  workflow: string;
};

export type VerifyOnlyExpectedFilesChangedInput = {
  dataRoot: string | DataRootSet;
  workflow: string;
  /** Fingerprints captured before the write (see {@link snapshotWorkflowFileFingerprints}). */
  baseline: ReadonlyMap<string, FileFingerprint>;
  /** Basenames that may differ from baseline (e.g. `SCHEDULE.DBF` for status-only updates). */
  expectedChangedFiles: readonly string[];
};

function resolveDataRoot(dataRoot: string | DataRootSet): DataRootSet {
  if (typeof dataRoot !== "string") {
    if (!dataRoot.configured) {
      throw new PostWriteVerificationError("DATA_ROOT_NOT_CONFIGURED", "dataRoot is not configured");
    }
    return dataRoot;
  }
  const parsed = parseDataRootFromValue(dataRoot);
  if (!parsed.configured) {
    throw new PostWriteVerificationError("DATA_ROOT_NOT_CONFIGURED", "dataRoot must be a non-empty absolute path");
  }
  return parsed;
}

async function sha256File(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function fingerprintFile(absPath: string): Promise<FileFingerprint> {
  const info = await stat(absPath);
  const sha256 = await sha256File(absPath);
  return { size: info.size, sha256 };
}

function fingerprintsEqual(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.size === b.size && a.sha256 === b.sha256;
}

/**
 * SHA-256 fingerprints for each workflow backup member present under `dataRoot`.
 */
export async function snapshotWorkflowFileFingerprints(
  input: SnapshotWorkflowFileFingerprintsInput,
): Promise<Map<string, FileFingerprint>> {
  const root = resolveDataRoot(input.dataRoot);
  const members = resolveBackupMembers(input.workflow);
  const out = new Map<string, FileFingerprint>();

  for (const member of members) {
    let abs: string;
    try {
      abs = resolvePathWithinDataRoot(root.realPath, member.fileName);
    } catch {
      if (member.required) {
        throw new PostWriteVerificationError(
          "WORKFLOW_FILE_MISSING",
          `required workflow file missing: ${member.fileName}`,
        );
      }
      continue;
    }
    try {
      await access(abs, fsConstants.R_OK);
    } catch {
      if (member.required) {
        throw new PostWriteVerificationError(
          "WORKFLOW_FILE_MISSING",
          `required workflow file missing: ${member.fileName}`,
        );
      }
      continue;
    }
    out.set(member.fileName, await fingerprintFile(abs));
  }

  return out;
}

/**
 * Ensures only basenames listed in `expectedChangedFiles` differ from `baseline`.
 * Other workflow files must be byte-identical to the pre-write snapshot.
 */
export async function verifyOnlyExpectedFilesChanged(
  input: VerifyOnlyExpectedFilesChangedInput,
): Promise<void> {
  const root = resolveDataRoot(input.dataRoot);
  const members = resolveBackupMembers(input.workflow);
  const allowedChanged = new Set(input.expectedChangedFiles);

  for (const member of members) {
    const baseline = input.baseline.get(member.fileName);
    if (baseline === undefined) {
      if (member.required) {
        throw new PostWriteVerificationError(
          "BASELINE_FILE_MISSING",
          `baseline fingerprint missing for ${member.fileName}`,
        );
      }
      continue;
    }

    let abs: string;
    try {
      abs = resolvePathWithinDataRoot(root.realPath, member.fileName);
    } catch {
      throw new PostWriteVerificationError(
        "WORKFLOW_FILE_MISSING",
        `workflow file missing after write: ${member.fileName}`,
      );
    }

    let current: FileFingerprint;
    try {
      await access(abs, fsConstants.R_OK);
      current = await fingerprintFile(abs);
    } catch {
      throw new PostWriteVerificationError(
        "WORKFLOW_FILE_MISSING",
        `workflow file missing after write: ${member.fileName}`,
      );
    }

    const changed = !fingerprintsEqual(baseline, current);
    if (changed && !allowedChanged.has(member.fileName)) {
      throw new PostWriteVerificationError(
        "UNEXPECTED_FILE_CHANGED",
        `file changed but was not expected to: ${member.fileName}`,
      );
    }
  }
}
