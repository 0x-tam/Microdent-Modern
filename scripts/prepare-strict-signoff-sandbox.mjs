#!/usr/bin/env node
import { createRequire } from "node:module";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const bridgeRequire = createRequire(new URL("../services/bridge/package.json", import.meta.url));
const { DBFFile } = bridgeRequire("dbffile");

const DEFAULT_ROOT = "services/strict-signoff";
const SANDBOX_WARNING = "DISPOSABLE COPY ONLY - safe to delete; never use for production or read-only reference.";

function parseArgs(argv) {
  const args = {
    root: resolve(repoRoot, DEFAULT_ROOT),
    force: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--root" && next) {
      args.root = resolve(repoRoot, next);
      i += 1;
    } else if (arg === "--no-force") {
      args.force = false;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: pnpm strict-signoff:prepare [--root <path>] [--no-force]

Creates a PHI-free synthetic strict-signoff workspace:
  <root>/synthetic-source/DATA
  <root>/Microdent-Write-Sandbox/DATA
  <root>/Microdent-Write-Sandbox/backups

Then run:
  DATA_ROOT="<root>/Microdent-Write-Sandbox/DATA" \\
  SQLITE_PATH="<root>/MICRODENT_MIRROR_SANDBOX.sqlite" \\
  pnpm mirror:import-safe
`);
}

const patientFields = [
  { name: "ID", type: "N", size: 10, decimalPlaces: 0 },
  { name: "CASENB", type: "C", size: 15 },
  { name: "NAME", type: "C", size: 51 },
  { name: "REV_NAME", type: "C", size: 51 },
  { name: "FIRST_NAME", type: "C", size: 25 },
  { name: "LAST_NAME", type: "C", size: 25 },
  { name: "HOME_PHONE", type: "C", size: 19 },
  { name: "MOBILE", type: "C", size: 19 },
  { name: "ACTIVE", type: "L", size: 1 },
  { name: "DOCTOR_NB", type: "N", size: 5, decimalPlaces: 0 },
  { name: "ENTRY_DATE", type: "D", size: 8 },
  { name: "LASTVISIT", type: "D", size: 8 },
];

const scheduleFields = [
  { name: "ID", type: "N", size: 12, decimalPlaces: 0 },
  { name: "DATE", type: "D", size: 8 },
  { name: "TIME", type: "C", size: 8 },
  { name: "DURATION", type: "N", size: 3, decimalPlaces: 0 },
  { name: "ROOM", type: "N", size: 2, decimalPlaces: 0 },
  { name: "COMMENT", type: "C", size: 40 },
  { name: "PAT_NAME", type: "C", size: 41 },
  { name: "TELEPHONE", type: "C", size: 20 },
  { name: "PERIOD", type: "N", size: 3, decimalPlaces: 0 },
  { name: "STATUS", type: "N", size: 2, decimalPlaces: 0 },
  { name: "DOC_ID", type: "N", size: 5, decimalPlaces: 0 },
  { name: "PAT_ID", type: "N", size: 10, decimalPlaces: 0 },
  { name: "PROC_CLASS", type: "N", size: 2, decimalPlaces: 0 },
  { name: "VAC_ID", type: "N", size: 10, decimalPlaces: 0 },
  { name: "RECALL", type: "N", size: 2, decimalPlaces: 0 },
  { name: "UNREASON", type: "N", size: 2, decimalPlaces: 0 },
  { name: "MISSED", type: "L", size: 1 },
];

const roomFields = [
  { name: "ROOM", type: "N", size: 3, decimalPlaces: 0 },
  { name: "DAY1", type: "L", size: 1 },
  { name: "DAY2", type: "L", size: 1 },
  { name: "DAY3", type: "L", size: 1 },
  { name: "DAY4", type: "L", size: 1 },
  { name: "DAY5", type: "L", size: 1 },
  { name: "DAY6", type: "L", size: 1 },
  { name: "DAY7", type: "L", size: 1 },
  { name: "DOCT", type: "N", size: 5, decimalPlaces: 0 },
];

const dicSchedFields = Array.from({ length: 25 }, (_, i) => ({ name: `ROOM${i + 1}`, type: "C", size: 40 }));

const doctorFields = [
  { name: "DOCTOR_NB", type: "N", size: 5, decimalPlaces: 0 },
  { name: "NAME", type: "C", size: 40 },
  { name: "SCHEDULE", type: "N", size: 1, decimalPlaces: 0 },
];

const procedureFields = [
  { name: "PROCNB", type: "C", size: 10 },
  { name: "PROCEDURE", type: "C", size: 60 },
  { name: "CLASS", type: "C", size: 20 },
  { name: "CATAGORY", type: "C", size: 10 },
  { name: "CLASS_ID", type: "N", size: 5, decimalPlaces: 0 },
  { name: "CHART", type: "L", size: 1 },
];

async function createDbf(dir, fileName, fields, rows = []) {
  const dbf = await DBFFile.create(join(dir, fileName), fields, {});
  if (rows.length > 0) {
    await dbf.appendRecords(rows);
  }
}

function utcDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day));
}

async function writeSyntheticSource(dataRoot) {
  await createDbf(dataRoot, "PATIENT.DBF", patientFields, [
    {
      ID: 50001,
      CASENB: "SYN-50001",
      NAME: "Synthetic Schedule Patient Alpha",
      REV_NAME: "Alpha, Synthetic",
      FIRST_NAME: "Synthetic",
      LAST_NAME: "Alpha",
      HOME_PHONE: "555-200-3001",
      MOBILE: "",
      ACTIVE: true,
      DOCTOR_NB: 7,
      ENTRY_DATE: utcDate(2026, 0, 1),
      LASTVISIT: utcDate(2026, 4, 1),
    },
    {
      ID: 50002,
      CASENB: "SYN-50002",
      NAME: "Synthetic Schedule Patient Beta",
      REV_NAME: "Beta, Synthetic",
      FIRST_NAME: "Synthetic",
      LAST_NAME: "Beta",
      HOME_PHONE: "555-200-3002",
      MOBILE: "",
      ACTIVE: true,
      DOCTOR_NB: 7,
      ENTRY_DATE: utcDate(2026, 0, 2),
      LASTVISIT: utcDate(2026, 4, 2),
    },
  ]);

  await createDbf(dataRoot, "SCHEDULE.DBF", scheduleFields, [
    {
      ID: 1001,
      DATE: utcDate(2026, 4, 20),
      TIME: "09:00",
      DURATION: 2,
      ROOM: 1,
      COMMENT: "SYNTHETIC_COMMENT_TOKEN",
      PAT_NAME: "SYNTHETIC_NAME_TOKEN",
      TELEPHONE: "555-000-0000",
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 7,
      PAT_ID: 50001,
      PROC_CLASS: 3,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 1002,
      DATE: utcDate(2026, 4, 20),
      TIME: "10:00",
      DURATION: 1,
      ROOM: 2,
      COMMENT: "",
      PAT_NAME: "SYNTHETIC_NAME_TOKEN",
      TELEPHONE: "555-000-0000",
      PERIOD: 30,
      STATUS: 2,
      DOC_ID: 7,
      PAT_ID: 50002,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
  ]);

  await createDbf(dataRoot, "SC_ROOM.DBF", roomFields, [
    { ROOM: 1, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 7 },
    { ROOM: 2, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 7 },
  ]);

  const rooms = {};
  for (let i = 1; i <= 25; i += 1) rooms[`ROOM${i}`] = "";
  rooms.ROOM1 = "Synthetic operatory A";
  rooms.ROOM2 = "Synthetic chair B";
  await createDbf(dataRoot, "DICSCHED.DBF", dicSchedFields, [rooms]);

  await createDbf(dataRoot, "DOCTORS.DBF", doctorFields, [{ DOCTOR_NB: 7, NAME: "Dr Synthetic", SCHEDULE: 1 }]);
  await createDbf(dataRoot, "PROCCHRT.DBF", procedureFields, [
    { PROCNB: "D1110", PROCEDURE: "Synthetic cleaning", CLASS: "Preventive", CATAGORY: "PREV", CLASS_ID: 3, CHART: true },
  ]);
  await createDbf(dataRoot, "MEDICAL.DBF", [
    { name: "PATIENT_ID", type: "N", size: 10, decimalPlaces: 0 },
    { name: "DATE", type: "D", size: 8 },
  ]);
  await createDbf(dataRoot, "OPERTBL.DBF", [
    { name: "PAT_ID", type: "N", size: 10, decimalPlaces: 0 },
    { name: "DATE", type: "D", size: 8 },
    { name: "PROCNB", type: "C", size: 10 },
    { name: "DOC_ID", type: "N", size: 5, decimalPlaces: 0 },
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDataRoot = join(args.root, "synthetic-source", "DATA");
  const sandboxRoot = join(args.root, "Microdent-Write-Sandbox");
  const sandboxDataRoot = join(sandboxRoot, "DATA");
  const backupDir = join(sandboxRoot, "backups");
  const sqlitePath = join(args.root, "MICRODENT_MIRROR_SANDBOX.sqlite");

  if (existsSync(args.root) && !args.force) {
    throw new Error(`${args.root} already exists; pass without --no-force to recreate it`);
  }

  await rm(args.root, { recursive: true, force: true });
  await mkdir(sourceDataRoot, { recursive: true });
  await writeSyntheticSource(sourceDataRoot);
  await mkdir(backupDir, { recursive: true });
  await cp(sourceDataRoot, sandboxDataRoot, { recursive: true });
  await writeFile(
    join(sandboxDataRoot, ".microdent-write-sandbox.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        disposable: true,
        createdAt: new Date().toISOString(),
        sourceDataRootRealpath: sourceDataRoot,
        sandboxDataRootRealpath: sandboxDataRoot,
        warning: SANDBOX_WARNING,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("strict-signoff-sandbox: ok");
  console.log("syntheticSource: synthetic-source/DATA");
  console.log("sandboxDataRoot: Microdent-Write-Sandbox/DATA");
  console.log("backupsDir: Microdent-Write-Sandbox/backups");
  console.log("sqlitePath: MICRODENT_MIRROR_SANDBOX.sqlite");
  console.log("");
  console.log("Next:");
  console.log(`  DATA_ROOT="${sandboxDataRoot}" SQLITE_PATH="${sqlitePath}" pnpm mirror:import-safe`);
  console.log(
    `  DATA_ROOT="${sandboxDataRoot}" SQLITE_PATH="${sqlitePath}" BACKUP_DIR="${backupDir}" BRIDGE_PORT=17992 BRIDGE_URL="http://127.0.0.1:17992" pnpm pilot:release-signoff`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "prepare strict signoff sandbox failed";
  console.error(`ERROR: ${message}`);
  process.exit(1);
});
