#!/usr/bin/env node
/**
 * Cross-platform pilot checkpoint orchestration.
 *
 * These commands are development/RC checkpoints, not substitutes for the
 * strict sandbox signoff or real Windows field evidence gates.
 */

import { spawnSync } from "node:child_process";

const mode = process.argv[2];
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function log(message) {
  console.log(`[pilot-${mode}] ${message}`);
}

function warn(message) {
  console.error(`[pilot-${mode}] ${message}`);
}

function run(args, options = {}) {
  log(`${pnpm} ${args.join(" ")}`);
  const result = spawnSync(pnpm, args, {
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasSandboxEnv() {
  return Boolean(process.env.DATA_ROOT?.trim() && process.env.SQLITE_PATH?.trim());
}

function fullCheckpoint() {
  run(["test"]);
  run(["build:web"]);

  if (hasSandboxEnv()) {
    log("pnpm qa:sandbox (sandbox env detected)");
    run(["qa:sandbox"]);
  } else {
    log("SKIP pnpm qa:sandbox - set DATA_ROOT and SQLITE_PATH for full sandbox proof");
  }

  log("desktop test + release-smoke");
  run(["--filter", "@microdent/desktop", "run", "test"]);
  run(["--filter", "@microdent/desktop", "run", "release-smoke"]);

  log(
    "NOTE: pilot:full-checkpoint does not run stage/verify - use pilot:distribution-checkpoint or pilot:release-signoff before IT handoff",
  );
  log("pilot-full-checkpoint complete");
}

function distributionCheckpoint() {
  run(["test"]);
  run(["build:web"]);

  log("bridge + desktop build");
  run(["--filter", "@microdent/bridge", "run", "build"]);
  run(["--filter", "@microdent/desktop", "run", "build"]);

  run(["stage:pilot-release"]);
  run(["pilot:verify-release"]);

  log("staged release-smoke (PILOT_STAGED_RELEASE=1)");
  run(["--filter", "@microdent/desktop", "run", "release-smoke"], {
    env: { PILOT_STAGED_RELEASE: "1" },
  });

  if (hasSandboxEnv()) {
    log("pnpm qa:sandbox (sandbox env detected)");
    run(["qa:sandbox"]);
  } else {
    log("WARNING: SKIP pnpm qa:sandbox - dev checkpoint only; NOT release signoff-ready");
    log("WARNING: set DATA_ROOT, SQLITE_PATH, and BACKUP_DIR then run pnpm pilot:release-signoff for strict gate");
  }

  log("pilot-distribution-checkpoint complete");
}

function releaseCheck() {
  warn("WARNING: dev iteration only - NOT release signoff.");
  warn("Sandbox QA may be skipped. Use pnpm pilot:release-signoff when DATA_ROOT/SQLITE_PATH/BACKUP_DIR are set.");
  console.error("");
  distributionCheckpoint();
}

if (mode === "full-checkpoint") {
  fullCheckpoint();
} else if (mode === "distribution-checkpoint") {
  distributionCheckpoint();
} else if (mode === "release-check") {
  releaseCheck();
} else {
  console.error(
    `ERROR: unknown pilot checkpoint mode "${mode ?? ""}". Expected full-checkpoint, distribution-checkpoint, or release-check.`,
  );
  process.exit(1);
}
