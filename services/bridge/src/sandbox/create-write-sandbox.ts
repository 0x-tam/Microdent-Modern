import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path, { basename } from "node:path";
import {
  assertNotForbiddenLegacyCopyPath,
  assertNotForbiddenLegacyPath,
} from "../backup/forbidden-path.js";
import { WRITE_SANDBOX_MARKER } from "../write-safety/constants.js";

export const SANDBOX_DISPOSABLE_WARNING =
  "DISPOSABLE COPY ONLY — safe to delete; never use for production or read-only reference.";

export type CreateWriteSandboxCounts = {
  files: number;
  directories: number;
};

export type CreateWriteSandboxResult = {
  sourceDataRoot: string;
  sourceDataRootRealpath: string;
  sandboxRoot: string;
  sandboxRootRealpath: string;
  sandboxDataRoot: string;
  sandboxDataRootRealpath: string;
  backupsDir: string;
  markerPath: string;
  createdAt: string;
  counts: CreateWriteSandboxCounts;
};

export type CreateWriteSandboxOptions = {
  sourceDataRoot: string;
  sandboxRoot: string;
};

function resolveOnDisk(absolutePath: string): string {
  const normalized = path.normalize(absolutePath);
  if (existsSync(normalized)) {
    return realpathSync.native(normalized);
  }
  return path.resolve(normalized);
}

function assertAbsolutePath(value: string, label: string): string {
  const trimmed = value.trim();
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be an absolute path`);
  }
  return path.normalize(trimmed);
}

function assertCreateSandboxPaths(sourceDataRoot: string, sandboxRoot: string): {
  sourceDataRootRealpath: string;
  sandboxRootRealpath: string;
  sandboxDataRoot: string;
} {
  const sourceAbs = assertAbsolutePath(sourceDataRoot, "SOURCE_DATA_ROOT");
  const sandboxAbs = assertAbsolutePath(sandboxRoot, "SANDBOX_ROOT");
  const sandboxDataRoot = path.join(sandboxAbs, "DATA");

  const sourceReal = resolveOnDisk(sourceAbs);
  const sandboxReal = resolveOnDisk(sandboxAbs);

  assertNotForbiddenLegacyPath(sourceReal, "SOURCE_DATA_ROOT");
  assertNotForbiddenLegacyPath(sandboxReal, "SANDBOX_ROOT");
  assertNotForbiddenLegacyCopyPath(sandboxReal, "SANDBOX_ROOT");

  return {
    sourceDataRootRealpath: sourceReal,
    sandboxRootRealpath: sandboxReal,
    sandboxDataRoot,
  };
}

async function assertSourceDirectory(sourceDataRoot: string): Promise<void> {
  let info;
  try {
    info = await stat(sourceDataRoot);
  } catch {
    throw new Error("SOURCE_DATA_ROOT does not exist or is not readable");
  }
  if (!info.isDirectory()) {
    throw new Error("SOURCE_DATA_ROOT must be a directory");
  }
}

async function countTree(root: string): Promise<CreateWriteSandboxCounts> {
  let files = 0;
  let directories = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        directories += 1;
        await walk(full);
      } else if (entry.isFile()) {
        files += 1;
      }
    }
  }

  await walk(root);
  return { files, directories };
}

export async function createWriteSandbox(
  options: CreateWriteSandboxOptions,
): Promise<CreateWriteSandboxResult> {
  const { sourceDataRootRealpath, sandboxRootRealpath, sandboxDataRoot } =
    assertCreateSandboxPaths(options.sourceDataRoot, options.sandboxRoot);

  await assertSourceDirectory(sourceDataRootRealpath);

  const backupsDir = path.join(sandboxRootRealpath, "backups");
  await mkdir(backupsDir, { recursive: true });

  if (existsSync(sandboxDataRoot)) {
    await rm(sandboxDataRoot, { recursive: true, force: true });
  }
  await mkdir(sandboxDataRoot, { recursive: true });

  const counts = await countTree(sourceDataRootRealpath);
  await cp(sourceDataRootRealpath, sandboxDataRoot, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });

  const sandboxDataRootRealpath = resolveOnDisk(sandboxDataRoot);
  const createdAt = new Date().toISOString();
  const markerPath = path.join(sandboxDataRootRealpath, WRITE_SANDBOX_MARKER);
  const marker = {
    schemaVersion: 1,
    disposable: true,
    createdAt,
    sourceDataRootRealpath,
    sandboxDataRootRealpath,
    warning: SANDBOX_DISPOSABLE_WARNING,
  };
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");

  return {
    sourceDataRoot: path.normalize(options.sourceDataRoot.trim()),
    sourceDataRootRealpath,
    sandboxRoot: path.normalize(options.sandboxRoot.trim()),
    sandboxRootRealpath,
    sandboxDataRoot,
    sandboxDataRootRealpath,
    backupsDir,
    markerPath,
    createdAt,
    counts,
  };
}

export function printCreateWriteSandboxReport(result: CreateWriteSandboxResult): void {
  console.log("create-sandbox: ok");
  console.log(`sourceEntries: ${result.counts.files} files, ${result.counts.directories} directories`);
  console.log(`sandboxDataRoot: ${basename(result.sandboxDataRootRealpath)}`);
  console.log(`backupsDir: ${basename(result.backupsDir)}`);
  console.log(`marker: ${WRITE_SANDBOX_MARKER}`);
  console.log(`createdAt: ${result.createdAt}`);
}
