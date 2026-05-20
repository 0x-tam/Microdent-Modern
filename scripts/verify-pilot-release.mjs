#!/usr/bin/env node
/**
 * Verify staged pilot release layout (post stage-pilot-release).
 * PHI-safe: no path contents logged.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertConfigTemplateSafe,
  FORBIDDEN_SUPERVISOR_PATTERNS,
  REQUIRED_STAGED_LAYOUT,
  scanStagedArtifacts,
} from "./pilot-release-artifact-rules.mjs";
import { verifyManifestHashes } from "./pilot-release-manifest.mjs";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const stageRoot = join(repoRoot, "dist", "pilot-release", "MicrodentModern");

function fail(message) {
  console.error(`[verify-pilot-release] FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(stageRoot)) {
  fail("dist/pilot-release/MicrodentModern/ missing — run pnpm stage:pilot-release first");
}

for (const rel of REQUIRED_STAGED_LAYOUT) {
  if (!existsSync(join(stageRoot, rel))) {
    fail(`missing staged artifact: ${rel}`);
  }
}

try {
  scanStagedArtifacts(stageRoot);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

const supervisor = readFileSync(join(stageRoot, "app/dist/bridge-supervisor.js"), "utf8");
const runtimeInstallRoot = readFileSync(join(stageRoot, "app/dist/runtime-install-root.js"), "utf8");
const supervisorBundle = `${supervisor}\n${runtimeInstallRoot}`;
if (!/server\.js/.test(supervisorBundle)) {
  fail("staged desktop runtime must reference bridge server.js");
}
if (!/spawn\([^,]+,\s*\[this\.bridgeEntry\]/.test(supervisor)) {
  fail("staged bridge-supervisor must spawn with bridgeEntry argv only");
}
for (const pattern of FORBIDDEN_SUPERVISOR_PATTERNS) {
  if (pattern.test(supervisor)) {
    fail(`staged bridge-supervisor contains forbidden pattern: ${pattern}`);
  }
}

const exampleConfig = readFileSync(join(stageRoot, "config-templates/config.example.json"), "utf8");
try {
  assertConfigTemplateSafe(exampleConfig, "config-templates/config.example.json");
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

const pathsExample = readFileSync(join(stageRoot, "config-templates/paths.example.env"), "utf8");
try {
  assertConfigTemplateSafe(pathsExample, "config-templates/paths.example.env");
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

try {
  await verifyManifestHashes(stageRoot);
} catch (err) {
  fail(`manifest verification failed: ${err instanceof Error ? err.message : String(err)}`);
}

console.log(
  "[verify-pilot-release] MicrodentModern layout, supervisor invariants, manifest hashes, and sensitive-artifact guards OK",
);
