#!/usr/bin/env node
/**
 * Verify RELEASE-MANIFEST.json hashes for staged pilot package.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyManifestHashes } from "./pilot-release-manifest.mjs";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const stageRoot = join(repoRoot, "dist", "pilot-release", "MicrodentModern");

function fail(message) {
  console.error(`[verify-pilot-manifest] FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(stageRoot)) {
  fail("dist/pilot-release/MicrodentModern/ missing — run pnpm stage:pilot-release first");
}

try {
  const manifest = await verifyManifestHashes(stageRoot);
  console.log(
    `[verify-pilot-manifest] OK — ${manifest.fileCount} files verified (app ${manifest.appVersion}, package ${manifest.packageVersion}, channel ${manifest.releaseChannel}, commit ${manifest.gitCommit})`,
  );
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
