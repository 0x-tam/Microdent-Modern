#!/usr/bin/env node
/**
 * Strict release signoff - fails when sandbox env or paths are missing.
 *
 * PHI-safe: does not print DATA_ROOT paths, local row payloads, or sandbox
 * source paths. EPERM on backup mkdir remains not signoff-ready, not a product
 * bug.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const TOTAL_SECTIONS = 8;

let sectionIndex = 0;
const blockedReasons = [];

function failEnv(message) {
  console.error(`[pilot-release-signoff] FAIL: ${message}`);
  process.exit(1);
}

function section(label) {
  sectionIndex += 1;
  console.log("");
  console.log(`========== [${sectionIndex}/${TOTAL_SECTIONS}] ${label} ==========`);
}

function block(reason) {
  blockedReasons.push(reason);
  console.error(`[pilot-release-signoff] BLOCKED: ${reason}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    failEnv(`${name} is unset - sandbox QA not signoff-ready (see scripts/pilot-release-signoff.mjs header)`);
  }
  return value;
}

function requirePath(label, value) {
  if (!existsSync(value)) {
    failEnv(`${label} path missing on disk - sandbox QA not signoff-ready`);
  }
}

function runPnpm(args, { env = {} } = {}) {
  const result = spawnSync(PNPM, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`[pilot-release-signoff] FAIL: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

function printTierSummary(tier1) {
  console.log("");
  console.log("========== Pilot readiness status (3-tier) ==========");
  console.log(`Tier 1 - Mac-side release readiness:     ${tier1}`);
  console.log("Tier 2 - Windows-test readiness:         READY (field pack in staged tree)");
  console.log("Tier 3 - Windows execution status:       Deferred / Not yet run");
  console.log("Clinic go-live:                          BLOCKED (package evidence + field evidence link + commercial/go-live evidence)");
  console.log("");
  console.log("Mac signoff does not substitute for Windows field execution.");
  console.log("Field pack: docs/FIELD-TEST-START-HERE.md - file package evidence before clinic PC field evidence.");
}

function main() {
  const dataRoot = requireEnv("DATA_ROOT");
  const sqlitePath = requireEnv("SQLITE_PATH");
  const backupDir = requireEnv("BACKUP_DIR");

  requirePath("DATA_ROOT", dataRoot);
  requirePath("SQLITE_PATH", sqlitePath);
  requirePath("BACKUP_DIR", backupDir);

  section("Tests (pnpm test)");
  if (!runPnpm(["test"])) {
    block("pnpm test failed");
  }

  section("Pilot artifact tests (pnpm test:pilot-artifacts)");
  if (!runPnpm(["test:pilot-artifacts"])) {
    block("pnpm test:pilot-artifacts failed");
  }

  section("Web build (pnpm build:web)");
  if (!runPnpm(["build:web"])) {
    block("pnpm build:web failed");
  }

  section("Bridge + desktop build");
  if (!runPnpm(["--filter", "@microdent/bridge", "run", "build"])) {
    block("bridge build failed");
  }
  if (!runPnpm(["--filter", "@microdent/desktop", "run", "build"])) {
    block("desktop build failed");
  }

  section("Stage pilot release (pnpm stage:pilot-release)");
  if (!runPnpm(["stage:pilot-release"])) {
    block("pnpm stage:pilot-release failed");
  }

  section("Verify release + manifest");
  if (!runPnpm(["pilot:verify-release"])) {
    block("pnpm pilot:verify-release failed");
  }
  if (!runPnpm(["pilot:verify-manifest"])) {
    block("pnpm pilot:verify-manifest failed");
  }

  section("Desktop test + release-smoke");
  if (!runPnpm(["--filter", "@microdent/desktop", "run", "test"])) {
    block("desktop tests failed");
  }
  if (!runPnpm(["--filter", "@microdent/desktop", "run", "release-smoke"])) {
    block("desktop release-smoke failed");
  }
  if (!runPnpm(["--filter", "@microdent/desktop", "run", "release-smoke"], {
    env: { PILOT_STAGED_RELEASE: "1" },
  })) {
    block("staged release-smoke (PILOT_STAGED_RELEASE=1) failed");
  }

  section("Sandbox QA (pnpm qa:sandbox)");
  if (!runPnpm(["qa:sandbox"])) {
    block("pnpm qa:sandbox failed - check BACKUP_DIR is writable (EPERM = not signoff-ready)");
  }

  console.log("");
  if (blockedReasons.length === 0) {
    console.log("PILOT RELEASE SIGNOFF: READY");
    printTierSummary("READY");
    return 0;
  }

  console.log("PILOT RELEASE SIGNOFF: BLOCKED");
  for (const reason of blockedReasons) {
    console.log(`  - ${reason}`);
  }
  printTierSummary("NOT READY");
  return 1;
}

process.exitCode = main();
