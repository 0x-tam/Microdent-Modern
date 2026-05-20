#!/usr/bin/env node
/**
 * Desktop release smoke — dist artifacts, config defaults, supervisor entrypoint.
 * PHI-safe: no operator paths or config file contents logged.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopRoot, "..", "..");

const REQUIRED_DIST = [
  "dist/main.js",
  "dist/bridge-supervisor.js",
  "dist/config.js",
  "dist/startup-validation.js",
  "dist/startup-failure.js",
  "dist/setup/setup.html",
  "dist/setup/setup-preload.cjs",
  "dist/setup/setup-window.js",
];

const STAGE_ROOT = join(repoRoot, "dist", "pilot-release", "MicrodentModern");

const REQUIRED_STAGED = [
  "HANDOFF-README.txt",
  "app/dist/main.js",
  "app/dist/bridge-supervisor.js",
  "app/dist/setup/setup.html",
  "app/package.json",
  "bridge/server.js",
  "web/index.html",
  "config-templates/config.example.json",
  "config-templates/paths.example.env",
  "docs/PILOT-START-HERE.md",
  "docs/phase-4-mirror-import-operator.md",
  "scripts/README.txt",
  "scripts/mirror-import-pointer.txt",
  "logs/README.txt",
  "mirror/README.txt",
  "backups/README.txt",
];

const FORBIDDEN_CONFIG_PATHS = [
  /Microdent-Legacy/i,
  /\/Users\//,
  /\/home\//i,
  /Microdent-Modern/i,
];

const FORBIDDEN_SUPERVISOR = [/\.(bat|cmd)["']/i, /foxpro/i, /legacy-copy/i, /microdent-legacy/i];

function fail(message) {
  console.error(`[release-smoke] FAIL: ${message}`);
  process.exit(1);
}

function assertSupervisorSpawnArgv(supervisorSrc, label) {
  if (!/spawn\([^,]+,\s*\[this\.bridgeEntry\]/.test(supervisorSrc)) {
    fail(`${label} must spawn with bridgeEntry argv only`);
  }
  for (const pattern of FORBIDDEN_SUPERVISOR) {
    if (pattern.test(supervisorSrc)) {
      fail(`${label} contains forbidden pattern: ${pattern}`);
    }
  }
}

function assertConfigTemplateSafe(content, label) {
  for (const pattern of FORBIDDEN_CONFIG_PATHS) {
    if (pattern.test(content)) {
      fail(`${label} contains forbidden path reference: ${pattern}`);
    }
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
if (!/join\(options\.repoRoot,\s*"services",\s*"bridge",\s*"dist",\s*"server\.js"\)/.test(supervisorDist)) {
  fail("bridge-supervisor dist must resolve bridgeEntry from options.repoRoot");
}
if (!/join\(options\.repoRoot,\s*"apps",\s*"web",\s*"dist",\s*"index\.html"\)/.test(supervisorDist)) {
  fail("bridge-supervisor dist must resolve web dist from options.repoRoot");
}
if (!supervisorDist.includes("server.js")) {
  fail("bridge-supervisor dist must reference services/bridge/dist/server.js");
}
assertSupervisorSpawnArgv(supervisorDist, "bridge-supervisor dist");

const { defaultDesktopConfig, desktopConfigNeedsSetup } = await import(
  join(desktopRoot, "dist/config.js"),
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
  for (const rel of REQUIRED_STAGED) {
    if (!existsSync(join(STAGE_ROOT, rel))) {
      fail(`PILOT_STAGED_RELEASE=1 missing staged artifact: ${rel}`);
    }
  }
  const stagedSupervisor = readFileSync(join(STAGE_ROOT, "app/dist/bridge-supervisor.js"), "utf8");
  assertSupervisorSpawnArgv(stagedSupervisor, "staged bridge-supervisor");
  const exampleConfig = readFileSync(join(STAGE_ROOT, "config-templates/config.example.json"), "utf8");
  assertConfigTemplateSafe(exampleConfig, "config-templates/config.example.json");
  const pathsExample = readFileSync(join(STAGE_ROOT, "config-templates/paths.example.env"), "utf8");
  assertConfigTemplateSafe(pathsExample, "config-templates/paths.example.env");
}

console.log(
  "[release-smoke] desktop dist, web dist, bridge dist, config defaults, and supervisor entrypoint OK",
);
