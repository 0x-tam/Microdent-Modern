#!/usr/bin/env node
/**
 * Desktop release smoke — dist artifacts, config defaults, supervisor entrypoint.
 * PHI-safe: no operator paths or config file contents logged.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  FORBIDDEN_SUPERVISOR_PATTERNS,
  REQUIRED_STAGED_LAYOUT,
} from "../../../scripts/pilot-release-artifact-rules.mjs";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopRoot, "..", "..");

const REQUIRED_DIST = [
  "dist/main.js",
  "dist/app-preload.cjs",
  "dist/bridge-supervisor.js",
  "dist/config.js",
  "dist/startup-validation.js",
  "dist/startup-failure.js",
  "dist/setup/setup.html",
  "dist/setup/setup-preload.cjs",
  "dist/setup/setup-window.js",
  "dist/runtime-install-root.js",
];

const STAGE_ROOT = join(repoRoot, "dist", "pilot-release", "MicrodentModern");

const FORBIDDEN_CONFIG_PATHS = [
  /Microdent-Legacy/i,
  /\/Users\//,
  /\/home\//i,
  /Microdent-Modern/i,
];

const DEV_BRIDGE_ENTRY_PATTERN =
  /resolveBridgeEntry\(options\.repoRoot\)|join\(options\.repoRoot,\s*"services",\s*"bridge",\s*"dist",\s*"server\.js"\)/;
const DEV_WEB_DIST_PATTERN =
  /resolveWebDistIndex\(options\.repoRoot\)|join\(options\.repoRoot,\s*"apps",\s*"web",\s*"dist",\s*"index\.html"\)/;
const PACKAGED_BRIDGE_ENTRY_PATTERN =
  /resolveBridgeEntry\(options\.repoRoot\)|join\(options\.repoRoot,\s*"bridge",\s*"server\.js"\)/;
const PACKAGED_WEB_DIST_PATTERN =
  /resolveWebDistIndex\(options\.repoRoot\)|join\(options\.repoRoot,\s*"web",\s*"index\.html"\)/;

function fail(message) {
  console.error(`[release-smoke] FAIL: ${message}`);
  process.exit(1);
}

function assertSupervisorSpawnArgv(supervisorSrc, label) {
  if (!/spawn\([^,]+,\s*\[this\.bridgeEntry\]/.test(supervisorSrc)) {
    fail(`${label} must spawn with bridgeEntry argv only`);
  }
  for (const pattern of FORBIDDEN_SUPERVISOR_PATTERNS) {
    if (pattern.test(supervisorSrc)) {
      fail(`${label} contains forbidden pattern: ${pattern}`);
    }
  }
}

function assertSupervisorResolvesInstallRoot(supervisorSrc, label, { packaged }) {
  if (packaged) {
    if (!PACKAGED_BRIDGE_ENTRY_PATTERN.test(supervisorSrc)) {
      fail(`${label} must resolve bridge entry from package root (bridge/server.js)`);
    }
    if (!PACKAGED_WEB_DIST_PATTERN.test(supervisorSrc)) {
      fail(`${label} must resolve web dist from package root (web/index.html)`);
    }
  } else if (!DEV_BRIDGE_ENTRY_PATTERN.test(supervisorSrc)) {
    fail(`${label} must resolve bridge entry from install root`);
  } else if (!DEV_WEB_DIST_PATTERN.test(supervisorSrc)) {
    fail(`${label} must resolve web dist from install root`);
  }
}

function assertConfigTemplateSafe(content, label) {
  for (const pattern of FORBIDDEN_CONFIG_PATHS) {
    if (pattern.test(content)) {
      fail(`${label} contains forbidden path reference: ${pattern}`);
    }
  }
}

function assertSpawnEnvNoLegacyAck(supervisorSrc, label) {
  if (/env\.ALLOW_LEGACY_WRITES\s*=/.test(supervisorSrc)) {
    fail(`${label} must not set ALLOW_LEGACY_WRITES in spawn env`);
  }
  if (!/delete env\.ALLOW_LEGACY_WRITES/.test(supervisorSrc)) {
    fail(`${label} must delete ALLOW_LEGACY_WRITES from bridge spawn env`);
  }
}

for (const rel of REQUIRED_DIST) {
  if (!existsSync(join(desktopRoot, rel))) {
    fail(`missing dist artifact: ${rel}`);
  }
}

const webDistIndex = join(repoRoot, "apps", "web", "dist", "index.html");
if (!existsSync(webDistIndex)) {
  fail("web dist missing — run pnpm build:web before release-smoke");
}

const bridgeServerDist = join(repoRoot, "services", "bridge", "dist", "server.js");
if (!existsSync(bridgeServerDist)) {
  fail("bridge dist missing — run pnpm --filter @microdent/bridge run build");
}

const supervisorDist = readFileSync(join(desktopRoot, "dist/bridge-supervisor.js"), "utf8");
assertSupervisorResolvesInstallRoot(supervisorDist, "bridge-supervisor dist", { packaged: false });
assertSupervisorSpawnArgv(supervisorDist, "bridge-supervisor dist");
assertSpawnEnvNoLegacyAck(supervisorDist, "bridge-supervisor dist");

const { defaultDesktopConfig, desktopConfigNeedsSetup } = await import(
  pathToFileURL(join(desktopRoot, "dist/config.js")).href
);

const defaults = defaultDesktopConfig();
if (defaults.writeMode !== "disabled") {
  fail("defaultDesktopConfig().writeMode must be disabled");
}
if (!desktopConfigNeedsSetup(defaults)) {
  fail("defaultDesktopConfig() must require first-run setup (missing paths)");
}
if ("dataRoot" in defaults || "sqlitePath" in defaults) {
  fail("defaults must not ship hardcoded path fields");
}

if (process.env.PILOT_STAGED_RELEASE === "1") {
  if (!existsSync(STAGE_ROOT)) {
    fail("PILOT_STAGED_RELEASE=1 but dist/pilot-release/MicrodentModern/ missing — run pnpm stage:pilot-release");
  }
  for (const rel of REQUIRED_STAGED_LAYOUT) {
    if (!existsSync(join(STAGE_ROOT, rel))) {
      fail(`PILOT_STAGED_RELEASE=1 missing staged artifact: ${rel}`);
    }
  }
  if (!existsSync(join(STAGE_ROOT, "bridge/server.js"))) {
    fail("PILOT_STAGED_RELEASE=1 missing bridge/server.js at package root");
  }
  if (!existsSync(join(STAGE_ROOT, "web/index.html"))) {
    fail("PILOT_STAGED_RELEASE=1 missing web/index.html at package root");
  }
  for (const rel of ["app/dist/runtime-install-root.js", "app/dist/startup-failure.js"]) {
    if (!existsSync(join(STAGE_ROOT, rel))) {
      fail(`PILOT_STAGED_RELEASE=1 missing staged desktop artifact: ${rel}`);
    }
  }
  const stagedSupervisor = readFileSync(join(STAGE_ROOT, "app/dist/bridge-supervisor.js"), "utf8");
  assertSupervisorResolvesInstallRoot(stagedSupervisor, "staged bridge-supervisor", { packaged: true });
  assertSupervisorSpawnArgv(stagedSupervisor, "staged bridge-supervisor");
  assertSpawnEnvNoLegacyAck(stagedSupervisor, "staged bridge-supervisor");
  const exampleConfig = readFileSync(join(STAGE_ROOT, "config-templates/config.example.json"), "utf8");
  assertConfigTemplateSafe(exampleConfig, "config-templates/config.example.json");
  const pathsExample = readFileSync(join(STAGE_ROOT, "config-templates/paths.example.env"), "utf8");
  assertConfigTemplateSafe(pathsExample, "config-templates/paths.example.env");
  const manifest = readFileSync(join(STAGE_ROOT, "RELEASE-MANIFEST.json"), "utf8");
  if (!/"schemaVersion"/.test(manifest)) {
    fail("RELEASE-MANIFEST.json must include schemaVersion");
  }
}

console.log(
  "[release-smoke] desktop dist, web dist, bridge dist, config defaults, and supervisor entrypoint OK",
);
