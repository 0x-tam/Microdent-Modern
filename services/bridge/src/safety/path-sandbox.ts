import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export class PathSandboxError extends Error {
  readonly code = "PATH_SANDBOX";

  constructor(message: string) {
    super(message);
    this.name = "PathSandboxError";
  }
}

function assertNoNul(input: string): void {
  if (input.includes("\0")) {
    throw new PathSandboxError("path contains NUL byte");
  }
}

function splitLogicalSegments(logicalRelativePath: string): string[] {
  return logicalRelativePath.split(/[/\\]+/).filter((s) => s.length > 0);
}

function isInsideRoot(rootReal: string, candidateReal: string): boolean {
  const rootNorm = path.normalize(rootReal);
  const candNorm = path.normalize(candidateReal);
  if (process.platform === "win32") {
    const r = rootNorm.toLowerCase();
    const c = candNorm.toLowerCase();
    return c === r || c.startsWith(r + path.sep);
  }
  return candNorm === rootNorm || candNorm.startsWith(rootNorm + path.sep);
}

/** Canonical sandbox root: realpath when the directory exists, otherwise resolved absolute path. */
function resolveSandboxRoot(dataRootReal: string): string {
  const resolvedBase = path.normalize(path.resolve(dataRootReal));
  if (existsSync(resolvedBase)) {
    return realpathSync.native(resolvedBase);
  }
  return resolvedBase;
}

/**
 * Resolve a logical path that must be relative to `dataRootReal` (use `DataRootSet.realPath`).
 * Rejects absolute logical paths, `..` segments, and symlink targets that escape the root
 * when the resolved path exists on disk.
 */
export function resolvePathWithinDataRoot(dataRootReal: string, logicalRelativePath: string): string {
  assertNoNul(logicalRelativePath);
  if (logicalRelativePath.trim() === "") {
    throw new PathSandboxError("logical path must not be empty");
  }
  if (path.isAbsolute(logicalRelativePath)) {
    throw new PathSandboxError("absolute logical paths are not allowed");
  }

  const segments = splitLogicalSegments(logicalRelativePath);
  for (const seg of segments) {
    if (seg === "..") {
      throw new PathSandboxError('path traversal segment ".." is not allowed');
    }
    if (seg === ".") {
      throw new PathSandboxError('path segment "." is not allowed');
    }
  }

  const rootReal = resolveSandboxRoot(dataRootReal);
  const joined = path.join(rootReal, ...segments);
  const normalizedJoined = path.normalize(joined);

  const rel = path.relative(rootReal, normalizedJoined);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathSandboxError("resolved path escapes DATA_ROOT");
  }

  if (existsSync(normalizedJoined)) {
    let candidateReal: string;
    try {
      candidateReal = realpathSync.native(normalizedJoined);
    } catch {
      throw new PathSandboxError("unable to resolve real path for candidate");
    }
    if (!isInsideRoot(rootReal, candidateReal)) {
      throw new PathSandboxError("path leaves DATA_ROOT via symlink or junction");
    }
    return candidateReal;
  }

  return normalizedJoined;
}
