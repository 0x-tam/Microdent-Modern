import path from "node:path";
import type { DataRootSet } from "../config.js";
import { PathSandboxError, resolvePathWithinDataRoot } from "../safety/index.js";

/** Registry `fileName` must be a single path segment (no traversal). */
export function resolveRegisteredDbfPath(dataRoot: DataRootSet, fileName: string): string {
  if (fileName !== path.basename(fileName)) {
    throw new PathSandboxError("DBF file name must be a basename");
  }
  if (fileName.includes("..")) {
    throw new PathSandboxError("invalid DBF file name");
  }
  return resolvePathWithinDataRoot(dataRoot.realPath, fileName);
}
