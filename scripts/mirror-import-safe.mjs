#!/usr/bin/env node
/**
 * Build the SQLite mirror from safe tables only.
 *
 * Cross-platform Node wrapper for the sqlite-mirror import CLI. It preserves
 * the root command's build-before-import behavior while letting Windows and
 * PowerShell users avoid the historical bash wrapper.
 */
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function envPath(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!isAbsolute(trimmed)) {
    fail(`${name} must be an absolute path.`);
  }
  return trimmed;
}

function printMissingEnvHelp() {
  console.error("ERROR: DATA_ROOT and SQLITE_PATH must be set to absolute paths.");
  console.error("");
  console.error('  export DATA_ROOT="/absolute/path/to/read-only/DATA-copy"');
  console.error('  export SQLITE_PATH="/absolute/path/to/MICRODENT_MIRROR.sqlite"');
  console.error("  pnpm mirror:import-safe");
  console.error("");
  console.error("Never point DATA_ROOT at production Microdent-Legacy. Use Microdent-Legacy-Copy only.");
}

function runPnpm(args) {
  const result = spawnSync(PNPM, args, {
    cwd: REPO_ROOT,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const dataRoot = envPath("DATA_ROOT");
const sqlitePath = envPath("SQLITE_PATH");
if (!dataRoot || !sqlitePath) {
  printMissingEnvHelp();
  process.exit(1);
}

runPnpm(["--filter", "@microdent/contracts", "run", "build"]);
runPnpm(["--filter", "@microdent/bridge", "run", "build"]);
runPnpm(["--filter", "@microdent/sqlite-mirror", "run", "import-safe"]);
