import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { cpus, hostname, platform, release, tmpdir, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { DBFFile } from "dbffile";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(repoRoot);

type Args = {
  patients: number;
  appointments: number;
  iterations: number;
  output?: string;
  keepGenerated: boolean;
  failOnThreshold: boolean;
};

type TimedRoute = {
  name: string;
  path: string;
  thresholdMs: number;
  timingsMs: number[];
  status: number;
  bytes: number;
  failure?: string;
};

const DEFAULT_PATIENTS = 5_000;
const DEFAULT_APPOINTMENTS = 50_000;
const DEFAULT_ITERATIONS = 5;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    patients: DEFAULT_PATIENTS,
    appointments: DEFAULT_APPOINTMENTS,
    iterations: DEFAULT_ITERATIONS,
    keepGenerated: false,
    failOnThreshold: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--patients" && next) {
      args.patients = parsePositiveInt(next, arg);
      i += 1;
    } else if (arg === "--appointments" && next) {
      args.appointments = parsePositiveInt(next, arg);
      i += 1;
    } else if (arg === "--iterations" && next) {
      args.iterations = parsePositiveInt(next, arg);
      i += 1;
    } else if (arg === "--output" && next) {
      args.output = resolve(next);
      i += 1;
    } else if (arg === "--keep-generated") {
      args.keepGenerated = true;
    } else if (arg === "--fail-on-threshold") {
      args.failOnThreshold = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return n;
}

function printHelp(): void {
  console.log(`Usage: pnpm perf:synthetic [options]

Options:
  --patients <n>       Synthetic PATIENT.DBF rows (default ${DEFAULT_PATIENTS})
  --appointments <n>   Synthetic SCHEDULE.DBF rows (default ${DEFAULT_APPOINTMENTS})
  --iterations <n>     Timed route iterations after one warmup (default ${DEFAULT_ITERATIONS})
  --output <path>      Write markdown report
  --keep-generated     Keep generated DBF/SQLite files under the temp run directory
  --fail-on-threshold  Exit non-zero if a measured route exceeds its baseline threshold
`);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function syntheticDate(daysFromStart: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + daysFromStart));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function appendInChunks(dbf: DBFFile, rows: Record<string, unknown>[], chunkSize = 1_000): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await dbf.appendRecords(rows.slice(i, i + chunkSize));
  }
}

async function writeDoctors(dir: string): Promise<void> {
  const dbf = await DBFFile.create(
    join(dir, "DOCTORS.DBF"),
    [
      { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "NAME", type: "C" as const, size: 30 },
      { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
      { name: "PHONE", type: "C" as const, size: 19 },
    ],
    {},
  );
  await dbf.appendRecords([
    { DOCTOR_NB: 1, NAME: "Synthetic Provider One", SCHEDULE: 1, PHONE: "555-010-0001" },
    { DOCTOR_NB: 2, NAME: "Synthetic Provider Two", SCHEDULE: 1, PHONE: "555-010-0002" },
    { DOCTOR_NB: 3, NAME: "Synthetic Provider Three", SCHEDULE: 1, PHONE: "555-010-0003" },
  ]);
}

async function writeProcedures(dir: string): Promise<void> {
  const dbf = await DBFFile.create(
    join(dir, "PROCCHRT.DBF"),
    [
      { name: "PROCNB", type: "C" as const, size: 6 },
      { name: "PROCEDURE", type: "C" as const, size: 50 },
      { name: "CHART", type: "L" as const, size: 1 },
      { name: "QTYPRIC", type: "L" as const, size: 1 },
      { name: "PRICE1", type: "N" as const, size: 13, decimalPlaces: 4 },
      { name: "PRICE2", type: "N" as const, size: 13, decimalPlaces: 4 },
      { name: "PER_PROF", type: "N" as const, size: 6, decimalPlaces: 2 },
      { name: "CLASS", type: "C" as const, size: 30 },
      { name: "GROUP", type: "C" as const, size: 10 },
      { name: "CATAGORY", type: "C" as const, size: 10 },
      { name: "CLASS_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "TRANS_CODE", type: "N" as const, size: 10, decimalPlaces: 0 },
    ],
    {},
  );
  await dbf.appendRecords([
    {
      PROCNB: "SYN01",
      PROCEDURE: "Synthetic exam",
      CHART: true,
      QTYPRIC: false,
      PRICE1: 0,
      PRICE2: 0,
      PER_PROF: 0,
      CLASS: "Preventive",
      GROUP: "SYN",
      CATAGORY: "PRE",
      CLASS_ID: 1,
      TRANS_CODE: 0,
    },
  ]);
}

async function writeScheduleRooms(dir: string): Promise<void> {
  const rooms = await DBFFile.create(
    join(dir, "SC_ROOM.DBF"),
    [
      { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "DAY1", type: "L" as const, size: 1 },
      { name: "DAY2", type: "L" as const, size: 1 },
      { name: "DAY3", type: "L" as const, size: 1 },
      { name: "DAY4", type: "L" as const, size: 1 },
      { name: "DAY5", type: "L" as const, size: 1 },
      { name: "DAY6", type: "L" as const, size: 1 },
      { name: "DAY7", type: "L" as const, size: 1 },
      { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
    ],
    {},
  );
  await rooms.appendRecords([
    { ROOM: 1, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 1 },
    { ROOM: 2, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 2 },
    { ROOM: 3, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 3 },
  ]);

  const labels = await DBFFile.create(join(dir, "DICSCHED.DBF"), [{ name: "ROOM1", type: "C" as const, size: 30 }], {});
  await labels.appendRecords([{ ROOM1: "Synthetic operatory" }]);
}

async function writePatients(dir: string, count: number): Promise<void> {
  const dbf = await DBFFile.create(
    join(dir, "PATIENT.DBF"),
    [
      { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "CASENB", type: "C" as const, size: 15 },
      { name: "NAME", type: "C" as const, size: 51 },
      { name: "REV_NAME", type: "C" as const, size: 51 },
      { name: "FIRST_NAME", type: "C" as const, size: 25 },
      { name: "LAST_NAME", type: "C" as const, size: 25 },
      { name: "HOME_PHONE", type: "C" as const, size: 19 },
      { name: "MOBILE", type: "C" as const, size: 19 },
      { name: "ACTIVE", type: "L" as const, size: 1 },
      { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "ENTRY_DATE", type: "D" as const, size: 8 },
      { name: "LASTVISIT", type: "D" as const, size: 8 },
      { name: "STREET", type: "C" as const, size: 50 },
      { name: "EMAIL", type: "C" as const, size: 50 },
      { name: "QUICKNOTE", type: "C" as const, size: 80 },
    ],
    {},
  );

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= count; i += 1) {
    const suffix = pad(i, 5);
    rows.push({
      ID: i,
      CASENB: `SYN-${suffix}`,
      NAME: `Synthetic Patient ${suffix}`,
      REV_NAME: `Patient ${suffix}, Synthetic`,
      FIRST_NAME: "Synthetic",
      LAST_NAME: `Patient ${suffix}`,
      HOME_PHONE: `555-01${pad(i % 10_000, 4)}`,
      MOBILE: "",
      ACTIVE: i % 11 !== 0,
      DOCTOR_NB: (i % 3) + 1,
      ENTRY_DATE: syntheticDate(i % 365),
      LASTVISIT: syntheticDate((i + 180) % 365),
      STREET: "Synthetic street not real",
      EMAIL: `synthetic-${suffix}@example.invalid`,
      QUICKNOTE: "Synthetic non-PHI note",
    });
  }
  await appendInChunks(dbf, rows);
}

async function writeAppointments(dir: string, patientCount: number, count: number): Promise<void> {
  const dbf = await DBFFile.create(
    join(dir, "SCHEDULE.DBF"),
    [
      { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "DATE", type: "D" as const, size: 8 },
      { name: "TIME", type: "C" as const, size: 5 },
      { name: "DURATION", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "COMMENT", type: "C" as const, size: 80 },
      { name: "PAT_NAME", type: "C" as const, size: 40 },
      { name: "TELEPHONE", type: "C" as const, size: 19 },
      { name: "CASENUM", type: "C" as const, size: 15 },
      { name: "PERIOD", type: "N" as const, size: 3, decimalPlaces: 0 },
      { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
      { name: "DOC_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "PAT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "PROC_CLASS", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "VAC_ID", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "RECALL", type: "N" as const, size: 1, decimalPlaces: 0 },
      { name: "UNREASON", type: "N" as const, size: 1, decimalPlaces: 0 },
      { name: "MISSED", type: "L" as const, size: 1 },
    ],
    {},
  );

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= count; i += 1) {
    const patientId = ((i - 1) % patientCount) + 1;
    const slot = i % 20;
    const hour = 8 + Math.floor(slot / 2);
    const minute = slot % 2 === 0 ? "00" : "30";
    rows.push({
      ID: i,
      DATE: syntheticDate(i % 180),
      TIME: `${pad(hour, 2)}:${minute}`,
      DURATION: 1 + (i % 3),
      ROOM: (i % 3) + 1,
      COMMENT: i % 5 === 0 ? "Synthetic comment flag" : "",
      PAT_NAME: `Synthetic Patient ${pad(patientId, 5)}`,
      TELEPHONE: `555-01${pad(patientId % 10_000, 4)}`,
      CASENUM: `SYN-${pad(patientId, 5)}`,
      PERIOD: 30,
      STATUS: i % 6,
      DOC_ID: (i % 3) + 1,
      PAT_ID: patientId,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: i % 2,
      UNREASON: 0,
      MISSED: false,
    });
  }
  await appendInChunks(dbf, rows);
}

async function writeMedical(dir: string): Promise<void> {
  const dbf = await DBFFile.create(
    join(dir, "MEDICAL.DBF"),
    [
      { name: "PATIENT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "DATE", type: "D" as const, size: 8 },
      { name: "DIABETS", type: "L" as const, size: 1 },
      { name: "ALLERGIC", type: "L" as const, size: 1 },
      { name: "PROBLEM", type: "C" as const, size: 80 },
      { name: "ALLERGY_TO", type: "C" as const, size: 80 },
    ],
    {},
  );
  await dbf.appendRecords([]);
}

async function writeTreatments(dir: string): Promise<void> {
  const dbf = await DBFFile.create(
    join(dir, "OPERTBL.DBF"),
    [
      { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "OPNUM", type: "N" as const, size: 10, decimalPlaces: 0 },
      { name: "TOOTHNB", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "PROCEDURE", type: "C" as const, size: 50 },
      { name: "DATE", type: "D" as const, size: 8 },
      { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
      { name: "PROCNB", type: "C" as const, size: 12 },
      { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
      { name: "DESC", type: "C" as const, size: 30 },
      { name: "FEE", type: "N" as const, size: 13, decimalPlaces: 4 },
    ],
    {},
  );
  await dbf.appendRecords([]);
}

async function writeSyntheticDataRoot(dataRoot: string, patientCount: number, appointmentCount: number): Promise<void> {
  await mkdir(dataRoot, { recursive: true });
  await writeDoctors(dataRoot);
  await writeProcedures(dataRoot);
  await writeScheduleRooms(dataRoot);
  await writePatients(dataRoot, patientCount);
  await writeAppointments(dataRoot, patientCount, appointmentCount);
  await writeMedical(dataRoot);
  await writeTreatments(dataRoot);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index]!;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function timeRoute(baseUrl: string, route: Omit<TimedRoute, "timingsMs" | "status" | "bytes">, iterations: number): Promise<TimedRoute> {
  const url = `${baseUrl}${route.path}`;
  const timingsMs: number[] = [];
  let status = 0;
  let bytes = 0;
  let failure: string | undefined;

  for (let i = 0; i < iterations + 1; i += 1) {
    const start = performance.now();
    const res = await fetch(url);
    const text = await res.text();
    const elapsed = performance.now() - start;
    status = res.status;
    bytes = Buffer.byteLength(text);

    if (!res.ok) {
      failure = `HTTP ${res.status}`;
      break;
    }
    if (i > 0) timingsMs.push(elapsed);
  }

  return { ...route, timingsMs, status, bytes, failure };
}

function machineSummary(): string {
  const cpu = cpus()[0]?.model ?? "unknown CPU";
  const memoryGb = totalmem() / 1024 / 1024 / 1024;
  return `${platform()} ${release()}, ${cpu}, ${memoryGb.toFixed(1)} GB RAM, host ${hostname()}`;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

function reportMarkdown(params: {
  args: Args;
  startedAt: string;
  commit: string;
  runDir: string;
  dataRootHash: string;
  sqliteHash: string;
  generationMs: number;
  importMs: number;
  importResult: Awaited<ReturnType<typeof runMirrorImportSafe>>;
  routes: TimedRoute[];
  generatedFilesKept: boolean;
}): string {
  const failures = params.routes
    .flatMap((route) => {
      const p95 = percentile(route.timingsMs, 95);
      const thresholdFailure = p95 > route.thresholdMs ? `${route.name} p95 ${formatMs(p95)} exceeded ${formatMs(route.thresholdMs)}` : undefined;
      return [route.failure, thresholdFailure].filter((failure): failure is string => Boolean(failure));
    });

  const rows = params.routes
    .map((route) => {
      const min = Math.min(...route.timingsMs);
      const p50 = percentile(route.timingsMs, 50);
      const p95 = percentile(route.timingsMs, 95);
      const max = Math.max(...route.timingsMs);
      const status = route.failure ? `FAIL (${route.failure})` : p95 > route.thresholdMs ? "WARN" : "PASS";
      return `| ${route.name} | \`${route.path}\` | ${route.status} | ${formatMs(avg(route.timingsMs))} | ${formatMs(min)} | ${formatMs(p50)} | ${formatMs(p95)} | ${formatMs(max)} | ${formatMs(route.thresholdMs)} | ${status} |`;
    })
    .join("\n");

  const importRows = params.importResult.steps
    .map((step) => `| ${step.table} | ${step.status} | ${step.rowCount} | ${step.errorCount} |`)
    .join("\n");

  return `# Synthetic performance profiling baseline

**Date:** ${params.startedAt}
**Baseline commit:** ${params.commit}
**Dataset:** ${params.args.patients.toLocaleString()} synthetic patients, ${params.args.appointments.toLocaleString()} synthetic appointments
**Machine:** ${machineSummary()}
**Node:** ${process.version}
**Generated data:** ${params.generatedFilesKept ? `kept outside git at \`${params.runDir}\`` : "deleted after run"}
**Dataset fingerprints:** data root ${params.dataRootHash}, SQLite ${params.sqliteHash}

## Summary

This run profiles the local-copy import path and bridge read routes against generated non-PHI DBF fixtures. Synthetic labels, 555-style phone placeholders, and example.invalid addresses are generated solely for performance testing and are not copied from clinic records.

## Import

| Step | Timing / status |
| --- | ---: |
| Fixture generation | ${formatMs(params.generationMs)} |
| Local-copy import | ${formatMs(params.importMs)} |
| Overall import status | ${params.importResult.overall} |
| Migrations applied | ${params.importResult.migrations.applied} |
| Migrations skipped | ${params.importResult.migrations.skipped} |

| Table | Status | Rows | Errors |
| --- | --- | ---: | ---: |
${importRows}

## Read Route Timings

Each route has one untimed warmup request followed by ${params.args.iterations} measured iterations.

| Route | Path | HTTP | Avg | Min | P50 | P95 | Max | Baseline threshold | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

## Failures

${failures.length > 0 ? failures.map((failure) => `- ${failure}`).join("\n") : "- None"}

## Notes

- Generated DBF and SQLite files are intentionally not committed.
- Threshold warnings are initial baselines for trend tracking, not clinic go-live proof.
- Real Windows validation remains required before using these numbers as field evidence.
`;
}

async function shortGitCommit(): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"]);
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

function safeHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { createBridgeApp } = await import("../services/bridge/src/app.js");
  const { runMirrorImportSafe } = await import("../services/sqlite-mirror/src/run-mirror-import-safe.js");
  const startedAt = new Date().toISOString();
  const runDir = await mkdtemp(join(tmpdir(), "microdent-synthetic-perf-"));
  const dataRoot = join(runDir, "data-root");
  const sqlitePath = join(runDir, "mirror.sqlite");

  let exitCode = 0;
  try {
    const generationStart = performance.now();
    await writeSyntheticDataRoot(dataRoot, args.patients, args.appointments);
    const generationMs = performance.now() - generationStart;

    const importStart = performance.now();
    const importResult = await runMirrorImportSafe({ dataRoot, sqlitePath });
    const importMs = performance.now() - importStart;

    const app = createBridgeApp("synthetic-perf", {
      bridgeConfig: {
        listen: { host: "127.0.0.1", port: 0 },
        dataRoot: { configured: true, path: dataRoot, realPath: dataRoot },
        sqlitePath: { configured: true, path: sqlitePath },
        writeMode: "disabled",
      },
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolveListen) => server.once("listening", resolveListen));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind bridge server");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const targetPatientId = Math.min(2_500, args.patients);
    const targetPatientSuffix = pad(Math.min(1_234, args.patients), 5);
    const routesToMeasure = [
      { name: "health", path: "/health", thresholdMs: 200 },
      { name: "mirror status", path: "/v1/mirror/status", thresholdMs: 250 },
      { name: "patient search by name", path: `/v1/patients/search?q=Synthetic%20Patient%20${targetPatientSuffix}`, thresholdMs: 500 },
      { name: "patient search broad", path: "/v1/patients/search?q=SYN", thresholdMs: 700 },
      { name: "patient profile", path: `/v1/patients/${targetPatientId}/profile`, thresholdMs: 300 },
      { name: "patient appointments", path: `/v1/patients/${targetPatientId}/appointments?from=2026-01-01&to=2026-06-30`, thresholdMs: 800 },
      { name: "schedule one week", path: "/v1/schedule/appointments?from=2026-02-01&to=2026-02-07", thresholdMs: 1_200 },
      { name: "schedule one room", path: "/v1/schedule/appointments?from=2026-02-01&to=2026-02-07&room=1", thresholdMs: 1_000 },
      { name: "schedule rooms", path: "/v1/schedule/rooms", thresholdMs: 250 },
      { name: "reference doctors", path: "/v1/reference/doctors", thresholdMs: 250 },
    ];

    const routes: TimedRoute[] = [];
    try {
      for (const route of routesToMeasure) {
        routes.push(await timeRoute(baseUrl, route, args.iterations));
      }
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }

    const hardFailures = routes.filter((route) => route.failure);
    const thresholdFailures = routes.filter((route) => percentile(route.timingsMs, 95) > route.thresholdMs);
    if (hardFailures.length > 0 || (args.failOnThreshold && thresholdFailures.length > 0)) {
      exitCode = 1;
    }

    const markdown = reportMarkdown({
      args,
      startedAt,
      commit: await shortGitCommit(),
      runDir,
      dataRootHash: safeHash(`${dataRoot}:${args.patients}:${args.appointments}`),
      sqliteHash: safeHash(`${sqlitePath}:${importResult.overall}:${importResult.steps.map((s) => `${s.table}:${s.rowCount}`).join(",")}`),
      generationMs,
      importMs,
      importResult,
      routes,
      generatedFilesKept: args.keepGenerated,
    });

    if (args.output) {
      await mkdir(resolve(args.output, ".."), { recursive: true });
      await writeFile(args.output, markdown, "utf8");
      console.log(`wrote ${args.output}`);
    } else {
      console.log(markdown);
    }

    console.log(`import ${importResult.overall} in ${formatMs(importMs)}`);
    console.log(`route failures=${hardFailures.length} thresholdWarnings=${thresholdFailures.length}`);
  } finally {
    if (!args.keepGenerated) {
      await rm(runDir, { recursive: true, force: true });
    }
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
