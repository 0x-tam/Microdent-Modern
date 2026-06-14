#!/usr/bin/env node
/**
 * PHI-free local strict signoff rehearsal.
 *
 * Creates synthetic DBFs, imports a local SQLite mirror, runs a fast sandbox
 * preflight, then delegates to the strict release signoff gate unless
 * --prepare-only is passed.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const DEFAULT_ROOT = "services/strict-signoff";

function printUsage() {
  console.log(`Usage: pnpm strict-signoff:local [--root <path>] [--port <port>] [--prepare-only]

Creates a PHI-free synthetic strict-signoff workspace, imports the SQLite mirror,
and runs pnpm pilot:release-signoff with DATA_ROOT, SQLITE_PATH, BACKUP_DIR,
BRIDGE_PORT, and BRIDGE_URL set to generated local paths.

Options:
  --root <path>      Workspace path relative to repo root or absolute
                    (default services/strict-signoff)
  --port <port>      Bridge port for sandbox QA (default 17992)
  --prepare-only     Generate synthetic data and import mirror, but do not run signoff
`);
}

function parseArgs(argv) {
  const parsed = {
    root: DEFAULT_ROOT,
    port: process.env.BRIDGE_PORT || "17992",
    runSignoff: true,
  };
  const args = argv.slice(2).filter((arg) => arg !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--root" && next) {
      parsed.root = next;
      index += 1;
      continue;
    }
    if (arg === "--port" && next) {
      parsed.port = next;
      index += 1;
      continue;
    }
    if (arg === "--prepare-only") {
      parsed.runSignoff = false;
      continue;
    }
    throw new Error(`unknown or incomplete argument: ${arg}`);
  }
  if (!/^\d+$/.test(parsed.port) || Number(parsed.port) < 1 || Number(parsed.port) > 65535) {
    throw new Error("--port must be an integer between 1 and 65535");
  }
  return parsed;
}

function log(message) {
  console.log(`[strict-signoff:local] ${message}`);
}

function run(command, args, { env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
}

function resolveRoot(root) {
  return isAbsolute(root) ? root : join(REPO_ROOT, root);
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} missing`);
  }
}

function assertSandboxPreflight({ DATA_ROOT: dataRoot, SQLITE_PATH: sqlitePath }) {
  if (!resolve(dataRoot).toLowerCase().includes("microdent-write-sandbox")) {
    throw new Error("DATA_ROOT must resolve under Microdent-Write-Sandbox");
  }
  assertFile(join(dataRoot, ".microdent-write-sandbox.json"), "sandbox marker");
  assertFile(sqlitePath, "SQLITE_PATH");
  for (const relPath of [
    "server.js",
    join("cli", "legacy-backup.js"),
    join("cli", "legacy-restore.js"),
    join("cli", "qa-sandbox-readback.js"),
  ]) {
    assertFile(join(REPO_ROOT, "services", "bridge", "dist", relPath), `services/bridge/dist/${relPath}`);
  }
  log("preflight ok marker=ok dist=ok sqlite=ok");
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[strict-signoff:local] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    printUsage();
    return 64;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }

  const rootAbs = resolveRoot(parsed.root);
  const dataRoot = join(rootAbs, "Microdent-Write-Sandbox", "DATA");
  const sqlitePath = join(rootAbs, "MICRODENT_MIRROR_SANDBOX.sqlite");
  const backupDir = join(rootAbs, "Microdent-Write-Sandbox", "backups");
  const env = {
    DATA_ROOT: dataRoot,
    SQLITE_PATH: sqlitePath,
    BACKUP_DIR: backupDir,
    BRIDGE_PORT: parsed.port,
    BRIDGE_URL: `http://127.0.0.1:${parsed.port}`,
  };

  log("preparing synthetic strict-signoff workspace");
  run(process.execPath, [join(REPO_ROOT, "scripts", "prepare-strict-signoff-sandbox.mjs"), "--root", rootAbs]);

  log("importing synthetic SQLite mirror");
  run(PNPM, ["mirror:import-safe"], { env });

  log("sandbox preflight");
  assertSandboxPreflight(env);

  if (!parsed.runSignoff) {
    log("prepare-only complete");
    log(`DATA_ROOT/SQLITE_PATH/BACKUP_DIR are under ${rootAbs}`);
    return 0;
  }

  log(`running strict release signoff on port ${parsed.port}`);
  run(PNPM, ["pilot:release-signoff"], { env });
  return 0;
}

process.exitCode = main(process.argv);
