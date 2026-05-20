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

function fail(message) {
  console.error(`[release-smoke] FAIL: ${message}`);
  process.exit(1);
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
if (!/spawn\([^,]+,\s*\[this\.bridgeEntry\]/.test(supervisorDist)) {
  fail("bridge-supervisor must spawn with bridgeEntry argv only");
}
for (const forbidden of [/\.(bat|cmd)["']/i, /foxpro/i, /legacy-copy/i, /microdent-legacy/i]) {
  if (forbidden.test(supervisorDist)) {
    fail(`bridge-supervisor dist contains forbidden pattern: ${forbidden}`);
  }
}

const { defaultDesktopConfig, desktopConfigNeedsSetup } = await import(
  join(desktopRoot, "dist/config.js")
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

const stagedIndex = join(repoRoot, "dist", "pilot-release", "web", "index.html");
const stagedBridge = join(repoRoot, "dist", "pilot-release", "bridge", "server.js");
const stagedMain = join(repoRoot, "dist", "pilot-release", "app", "dist", "main.js");
if (process.env.PILOT_STAGED_RELEASE === "1") {
  if (!existsSync(stagedIndex) || !existsSync(stagedBridge) || !existsSync(stagedMain)) {
    fail("PILOT_STAGED_RELEASE=1 but dist/pilot-release/ incomplete — run pnpm stage:pilot-release");
  }
  const stagedSupervisor = readFileSync(
    join(repoRoot, "dist", "pilot-release", "app", "dist", "bridge-supervisor.js"),
    "utf8",
  );
  if (!/spawn\([^,]+,\s*\[this\.bridgeEntry\]/.test(stagedSupervisor)) {
    fail("staged bridge-supervisor must spawn with bridgeEntry argv only");
  }
}

console.log(
  "[release-smoke] desktop dist, web dist, bridge dist, config defaults, and supervisor entrypoint OK",
);
