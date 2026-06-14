#!/usr/bin/env node
/**
 * Cross-platform root wrappers for legacy data safety commands.
 *
 * These preserve the old shell guards while letting Windows/PowerShell users run
 * the root `pnpm legacy:*` scripts without Git Bash.
 */

import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2];
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const commands = {
  backup: {
    required: ["DATA_ROOT", "BACKUP_DIR", "WORKFLOW"],
    absolute: ["DATA_ROOT", "BACKUP_DIR"],
    bridgeScript: "legacy-backup",
    guidance: `ERROR: DATA_ROOT, BACKUP_DIR, and WORKFLOW must be set.

  export DATA_ROOT="/absolute/path/to/disposable/DATA"
  export BACKUP_DIR="/absolute/path/to/backups"
  export WORKFLOW="appointment.statusUpdate"
  pnpm legacy:backup

Never point DATA_ROOT at production Microdent-Legacy.`,
  },
  "create-sandbox": {
    required: ["SOURCE_DATA_ROOT", "SANDBOX_ROOT"],
    absolute: ["SOURCE_DATA_ROOT", "SANDBOX_ROOT"],
    bridgeScript: "legacy-create-sandbox",
    guidance: `ERROR: SOURCE_DATA_ROOT and SANDBOX_ROOT must be set.

  export SOURCE_DATA_ROOT="/absolute/path/to/read-only/DATA"
  export SANDBOX_ROOT="/absolute/path/to/Microdent-Write-Sandbox"
  pnpm legacy:create-sandbox

Never point SOURCE_DATA_ROOT at production Microdent-Legacy.
Never place SANDBOX_ROOT inside Microdent-Legacy or Microdent-Legacy-Copy.`,
  },
  restore: {
    required: ["BACKUP_MANIFEST", "DATA_ROOT"],
    absolute: ["BACKUP_MANIFEST", "DATA_ROOT"],
    bridgeScript: "legacy-restore",
    guidance: `ERROR: BACKUP_MANIFEST and DATA_ROOT must be set.

  export BACKUP_MANIFEST="/absolute/path/to/backup/folder"
  export DATA_ROOT="/absolute/path/to/disposable/DATA"
  pnpm legacy:restore

DATA_ROOT must contain .microdent-write-sandbox.json with disposable: true.
Never point DATA_ROOT at Microdent-Legacy or Microdent-Legacy-Copy.`,
  },
  "backup-verify": {
    required: ["BACKUP_MANIFEST"],
    absolute: ["BACKUP_MANIFEST"],
    optionalAbsolute: ["DATA_ROOT"],
    bridgeScript: "legacy-backup-verify",
    guidance: `ERROR: BACKUP_MANIFEST must be set to the backup folder (contains manifest.json and files/).

  export BACKUP_MANIFEST="/absolute/path/to/backups/20260515T120000Z__appointment.statusUpdate__abcd"
  pnpm legacy:backup-verify

Optional: also compare live DATA_ROOT files to the manifest:

  export DATA_ROOT="/absolute/path/to/disposable/DATA"`,
  },
};

const config = commands[command];

if (!config) {
  console.error(
    `ERROR: unknown legacy command "${command ?? ""}". Expected one of: ${Object.keys(commands).join(", ")}.`,
  );
  process.exit(1);
}

function isBlank(value) {
  return value === undefined || value.trim() === "";
}

function run(args) {
  const result = spawnSync(pnpm, args, { stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exitCode = result.status ?? 1;
  if (process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

const missing = config.required.filter((name) => isBlank(process.env[name]));

if (missing.length > 0) {
  console.error(config.guidance);
  process.exit(1);
}

for (const name of config.absolute) {
  if (!path.isAbsolute(process.env[name])) {
    console.error(`ERROR: ${name} must be an absolute path.`);
    process.exit(1);
  }
}

for (const name of config.optionalAbsolute ?? []) {
  if (!isBlank(process.env[name]) && !path.isAbsolute(process.env[name])) {
    console.error(`ERROR: ${name} must be an absolute path when set.`);
    process.exit(1);
  }
}

run(["--filter", "@microdent/contracts", "run", "build"]);
run(["--filter", "@microdent/bridge", "run", "build"]);
run(["--filter", "@microdent/bridge", "run", config.bridgeScript]);
