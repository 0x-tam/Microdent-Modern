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
