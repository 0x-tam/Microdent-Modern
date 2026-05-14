import type { DataRootConfig, DataRootSet } from "../config.js";
import { PathSandboxError, resolvePathWithinDataRoot } from "./path-sandbox.js";
import { openFileReadOnly } from "./read-only-file.js";

/**
 * Resolve `logicalRelativePath` under `DATA_ROOT` and open it read-only.
 * Throws if `DATA_ROOT` is not configured. Does not expose contents to HTTP callers.
 */
export async function openReadOnlyUnderDataRoot(
  dataRoot: DataRootConfig,
  logicalRelativePath: string,
): Promise<Awaited<ReturnType<typeof openFileReadOnly>>> {
  if (!dataRoot.configured) {
    throw new PathSandboxError("DATA_ROOT is not configured");
  }
  return openReadOnlyUnderConfiguredRoot(dataRoot, logicalRelativePath);
}

export async function openReadOnlyUnderConfiguredRoot(
  dataRoot: DataRootSet,
  logicalRelativePath: string,
): Promise<Awaited<ReturnType<typeof openFileReadOnly>>> {
  const resolved = resolvePathWithinDataRoot(dataRoot.realPath, logicalRelativePath);
  return openFileReadOnly(resolved);
}
