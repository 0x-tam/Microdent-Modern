import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve install root from desktop `dist/` directory.
 * Packaged pilot: `MicrodentModern/app/dist` → `MicrodentModern/`.
 * Dev checkout: `apps/desktop/dist` → repo root.
 */
export function resolveInstallRoot(fromDistDir: string): string {
  const packagedRoot = join(fromDistDir, "..", "..");
  if (existsSync(join(packagedRoot, "bridge", "server.js"))) {
    return packagedRoot;
  }
  return join(fromDistDir, "..", "..", "..");
}

/** Bridge entry — packaged `bridge/server.js` or dev `services/bridge/dist/server.js`. */
export function resolveBridgeEntry(installRoot: string): string {
  const packaged = join(installRoot, "bridge", "server.js");
  if (existsSync(packaged)) {
    return packaged;
  }
  return join(installRoot, "services", "bridge", "dist", "server.js");
}

/** Web UI index — packaged `web/index.html` or dev `apps/web/dist/index.html`. */
export function resolveWebDistIndex(installRoot: string): string {
  const packaged = join(installRoot, "web", "index.html");
  if (existsSync(packaged)) {
    return packaged;
  }
  return join(installRoot, "apps", "web", "dist", "index.html");
}

/** SQLite mirror package entry — packaged `sqlite-mirror/index.js` or dev dist. */
export function resolveSqliteMirrorIndex(installRoot: string): string {
  const packaged = join(installRoot, "sqlite-mirror", "index.js");
  if (existsSync(packaged)) {
    return packaged;
  }
  return join(installRoot, "services", "sqlite-mirror", "dist", "index.js");
}

/** Desktop JSON import CLI — packaged `sqlite-mirror/cli/...` or dev dist. */
export function resolveSqliteMirrorJsonCli(installRoot: string): string {
  const packaged = join(installRoot, "sqlite-mirror", "cli", "mirror-import-json.js");
  if (existsSync(packaged)) {
    return packaged;
  }
  return join(installRoot, "services", "sqlite-mirror", "dist", "cli", "mirror-import-json.js");
}

/** Packaged Node runtime used for imports that require Node >=22.5 (`node:sqlite`). */
export function resolvePackagedNodeBinary(
  installRoot: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const candidates =
    platform === "win32"
      ? [join(installRoot, "node", "node.exe")]
      : [join(installRoot, "node", "bin", "node"), join(installRoot, "node", "node")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/** Import Node preference: explicit override, env override, packaged runtime, dev fallback. */
export function resolveImportNodeBinary(options: {
  installRoot: string;
  explicitNodeBinary?: string;
  envNodeBinary?: string;
  fallbackNodeBinary?: string;
  platform?: NodeJS.Platform;
}): string {
  if (options.explicitNodeBinary?.trim()) return options.explicitNodeBinary;
  if (options.envNodeBinary?.trim()) return options.envNodeBinary;
  return (
    resolvePackagedNodeBinary(options.installRoot, options.platform) ??
    options.fallbackNodeBinary ??
    process.execPath
  );
}
