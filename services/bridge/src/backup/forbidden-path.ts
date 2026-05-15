import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { FORBIDDEN_LEGACY_ROOT } from "../write-safety/constants.js";

export function isPathUnderRoot(candidatePath: string, rootPath: string): boolean {
  const rootNorm = path.normalize(resolveRootReal(rootPath));
  const candNorm = path.normalize(path.resolve(candidatePath));
  if (process.platform === "win32") {
    const r = rootNorm.toLowerCase();
    const c = candNorm.toLowerCase();
    return c === r || c.startsWith(r + path.sep);
  }
  return candNorm === rootNorm || candNorm.startsWith(rootNorm + path.sep);
}

function resolveRootReal(rootPath: string): string {
  const normalized = path.normalize(path.resolve(rootPath));
  if (existsSync(normalized)) {
    return realpathSync.native(normalized);
  }
  return normalized;
}

/** Rejects production `Microdent-Legacy` paths (backup source or destination). */
export function assertNotForbiddenLegacyPath(absolutePath: string, label: string): void {
  if (isPathUnderRoot(absolutePath, FORBIDDEN_LEGACY_ROOT)) {
    throw new Error(`${label} must not point at Microdent-Legacy`);
  }
}
