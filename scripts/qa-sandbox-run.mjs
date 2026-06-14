#!/usr/bin/env node
/**
 * Cross-platform sandbox QA orchestrator.
 *
 * Mirrors the bash qa:sandbox flow without curl/jq/realpath/shasum:
 * build bridge, start dist/server.js, prove health/write capability, then run
 * four backup-first sandbox write workflows with DBF readback and restore.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const BRIDGE_DIR = join(REPO_ROOT, "services", "bridge");

function log(message) {
  console.log(`[qa-sandbox-run] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function banner(message) {
  console.log("");
  console.log(`========== ${message} ==========`);
  console.log("");
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function run(command, args, { cwd = REPO_ROOT, env = {}, stdio = "inherit" } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      stdio,
    });
    let stdout = "";
    let stderr = "";
    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        const detail = stderr.trim() || stdout.trim() || `${command} ${args.join(" ")} exited ${code}`;
        reject(new Error(detail));
      }
    });
  });
}

async function runNode(args, options = {}) {
  return run(process.execPath, args, options);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    fail(`${name} required`);
  }
  return value;
}

function pathContainsSandbox(path) {
  return path.toLowerCase().includes("microdent-write-sandbox");
}

function validateEnv({ dataRoot, sqlitePath }) {
  const resolvedDataRoot = resolve(dataRoot);
  if (!pathContainsSandbox(resolvedDataRoot)) {
    fail("DATA_ROOT must resolve under Microdent-Write-Sandbox");
  }
  for (const rel of [
    ".microdent-write-sandbox.json",
    "SCHEDULE.DBF",
    "PATIENT.DBF",
  ]) {
    if (!existsSync(join(dataRoot, rel))) {
      fail(`missing sandbox artifact under DATA_ROOT: ${rel}`);
    }
  }
  if (!existsSync(sqlitePath)) {
    fail("SQLITE_PATH not found");
  }
}

function validateBuiltArtifacts() {
  for (const rel of [
    "server.js",
    join("cli", "legacy-backup.js"),
    join("cli", "legacy-restore.js"),
    join("cli", "qa-sandbox-readback.js"),
  ]) {
    const path = join(BRIDGE_DIR, "dist", rel);
    if (!existsSync(path)) {
      fail(`missing services/bridge/dist/${rel}`);
    }
  }
}

async function sqliteQuery(sqlitePath, sql) {
  const { stdout } = await runNode(
    ["--no-warnings", join(REPO_ROOT, "scripts", "sqlite-query.mjs"), sqlitePath, sql],
    { stdio: "pipe" },
  );
  return stdout.trim();
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashPrefix(hash) {
  return hash.slice(0, 12);
}

function latestBackupDir(backupDir, workflow) {
  if (!existsSync(backupDir)) return "";
  const matches = readdirSync(backupDir)
    .map((name) => join(backupDir, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory() && path.includes(workflow);
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return matches[0] ?? "";
}

async function requestJson(baseUrl, path, { method = "GET", body, intent } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (intent) {
    headers["X-Write-Intent"] = intent;
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let json = {};
      if (text.trim() !== "") {
        json = JSON.parse(text);
      }
      return { status: response.status, json };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        log(`http transient path=${path} attempt=${attempt}`);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1000));
      }
    }
  }
  throw lastError;
}

async function waitFor(baseUrl, label, path, predicate) {
  for (let attempt = 1; attempt <= 45; attempt += 1) {
    try {
      const result = await requestJson(baseUrl, path);
      if (predicate(result)) {
        log(`${label} ready attempt=${attempt}`);
        return result;
      }
    } catch {
      // Bridge may still be binding the port.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  fail(`${label} not ready after 45s`);
}

function spawnBridge({ dataRoot, sqlitePath, backupDir, bridgeHost, bridgePort }) {
  const env = {
    ...process.env,
    DATA_ROOT: dataRoot,
    SQLITE_PATH: sqlitePath,
    BACKUP_DIR: backupDir,
    WRITE_MODE: process.env.WRITE_MODE || "enabled",
    ALLOW_LEGACY_WRITES:
      process.env.ALLOW_LEGACY_WRITES || "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_COPY",
    BRIDGE_HOST: bridgeHost,
    BRIDGE_PORT: bridgePort,
  };
  return spawn(process.execPath, ["dist/server.js"], {
    cwd: BRIDGE_DIR,
    env,
    stdio: ["ignore", "ignore", "ignore"],
  });
}

async function readback(command, id, env) {
  const { stdout } = await runNode(
    [join(BRIDGE_DIR, "dist", "cli", "qa-sandbox-readback.js"), command, String(id)],
    { cwd: BRIDGE_DIR, env, stdio: "pipe" },
  );
  return stdout.trim();
}

async function legacyBackup(workflow, env) {
  await runNode([join(BRIDGE_DIR, "dist", "cli", "legacy-backup.js")], {
    cwd: BRIDGE_DIR,
    env: { ...env, WORKFLOW: workflow },
    stdio: "pipe",
  });
}

async function legacyRestore(manifest, env) {
  await runNode([join(BRIDGE_DIR, "dist", "cli", "legacy-restore.js")], {
    cwd: BRIDGE_DIR,
    env: { ...env, BACKUP_MANIFEST: manifest },
    stdio: "pipe",
  });
}

function logWriteResponse(workflow, phase, response) {
  const operationId = response.json?.operationId || "none";
  const committed =
    response.json?.committed === undefined ? "n/a" : String(response.json.committed);
  log(`workflow=${workflow} phase=${phase} http=${response.status} operationId=${operationId} committed=${committed}`);
}

function workflowSummary({ workflow, dryRun, commit, backup, dbfReadback, restore }) {
  return {
    workflow,
    dryRunHttpStatus: dryRun.status,
    commitHttpStatus: commit.status,
    operationId: commit.json?.operationId || "none",
    backupBasename: basenameSafe(backup),
    dbfReadbackPassed: dbfReadback === true,
    restorePassed: restore === true,
  };
}

async function assertAuditOperation(baseUrl, sqlitePath, operationId, workflow) {
  if (workflow !== "appointment.statusUpdate") {
    log(`audit workflow=${workflow} skipped (audit not implemented for this workflow)`);
    return;
  }
  if (!operationId) {
    fail(`audit check workflow=${workflow} missing operationId`);
  }

  const recent = await requestJson(baseUrl, "/v1/meta/write-audit-recent");
  if (recent.json?.sqliteUsable === true) {
    const match = (recent.json.entries ?? []).some(
      (entry) =>
        entry.operationId === operationId &&
        entry.workflow === workflow &&
        entry.terminalStatus === "success",
    );
    if (!match) {
      fail(`audit workflow=${workflow} operationId=${operationId} not success in recent`);
    }
    log(`audit workflow=${workflow} operationId=${operationId} terminalStatus=success`);
    return;
  }

  const count = await sqliteQuery(
    sqlitePath,
    `SELECT COUNT(*) FROM write_audit_log WHERE operation_id='${operationId}' AND workflow_type='${workflow}' AND terminal_status='success';`,
  );
  if (Number(count || 0) < 1) {
    fail(`sqlite audit workflow=${workflow} operationId=${operationId} not success`);
  }
  log(`audit workflow=${workflow} operationId=${operationId} terminalStatus=success`);
}

async function runStatusWorkflow(ctx) {
  const workflow = "appointment.statusUpdate";
  log(`=== ${workflow} ===`);
  const schedulePath = join(ctx.dataRoot, "SCHEDULE.DBF");
  const beforeHash = hashFile(schedulePath);
  log(`baseline hash_prefix=${hashPrefix(beforeHash)}`);
  const statusBefore = await readback("schedule-status", ctx.appointmentId, ctx.env);
  const statusAfter = (Number(statusBefore) + 1) % 6;

  const dryRun = await requestJson(ctx.bridgeUrl, `/v1/schedule/appointments/${ctx.appointmentId}/status`, {
    method: "PATCH",
    intent: "dry-run",
    body: { status: statusAfter },
  });
  logWriteResponse(workflow, "dry-run", dryRun);
  if (dryRun.status !== 200 || beforeHash !== hashFile(schedulePath)) {
    fail(`${workflow} dry-run FAIL`);
  }

  await legacyBackup(workflow, ctx.env);
  const backup = latestBackupDir(ctx.backupDir, workflow);
  if (!backup) fail(`backup directory missing workflow=${workflow}`);
  log(`backup workflow=${workflow} basename=${basenameSafe(backup)}`);

  const commit = await requestJson(ctx.bridgeUrl, `/v1/schedule/appointments/${ctx.appointmentId}/status`, {
    method: "PATCH",
    intent: "commit",
    body: { status: statusAfter },
  });
  logWriteResponse(workflow, "commit", commit);
  if (commit.status !== 200 || commit.json?.committed !== true || beforeHash === hashFile(schedulePath)) {
    fail(`${workflow} commit FAIL`);
  }
  const actual = await readback("schedule-status", ctx.appointmentId, ctx.env);
  if (actual !== String(statusAfter)) {
    fail(`dbf readback workflow=${workflow} expected_status=${statusAfter} got=${actual || "none"}`);
  }
  log(`readback workflow=${workflow} source=dbf appointment_id=${ctx.appointmentId} status=${actual}`);
  await assertAuditOperation(ctx.bridgeUrl, ctx.sqlitePath, commit.json?.operationId, workflow);

  await legacyRestore(backup, ctx.env);
  const restoredHash = hashFile(schedulePath);
  if (beforeHash !== restoredHash) fail(`${workflow} restore FAIL`);
  const restored = await readback("schedule-status", ctx.appointmentId, ctx.env);
  if (restored !== String(statusBefore)) {
    fail(`restore readback workflow=${workflow} expected_status=${statusBefore} got=${restored || "none"}`);
  }
  log(`${workflow} restore PASS hash_prefix=${hashPrefix(restoredHash)}`);
  return workflowSummary({
    workflow,
    dryRun,
    commit,
    backup,
    dbfReadback: true,
    restore: true,
  });
}

async function discoverFreeSlot(ctx) {
  const sparseRaw = await sqliteQuery(
    ctx.sqlitePath,
    `SELECT appointment_date FROM appointments GROUP BY appointment_date ORDER BY COUNT(*) ASC LIMIT 8;`,
  ).catch(() => "");
  const roomRaw = await sqliteQuery(
    ctx.sqlitePath,
    `SELECT DISTINCT room_id FROM appointments WHERE room_id IS NOT NULL ORDER BY CAST(room_id AS INTEGER) LIMIT 25;`,
  ).catch(() => "");
  const sparseDates = sparseRaw.split(/\r?\n/).filter(Boolean);
  const knownRooms = roomRaw
    .split(/\r?\n/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const candidateDates = [
    ...sparseDates,
    "2026-05-22",
    "2026-05-25",
    "2026-06-01",
  ];
  const candidateRooms = [
    ...knownRooms,
    ...Array.from({ length: 25 }, (_, index) => index + 1),
  ].filter((room, index, rooms) => rooms.indexOf(room) === index);
  const currentSlot = await readback("schedule-slot", ctx.appointmentId, ctx.env).catch(() => "");
  for (const date of candidateDates) {
    for (const room of candidateRooms) {
      for (let hour = 8; hour <= 17; hour += 1) {
        for (const min of ["00", "15", "30", "45"]) {
          const time = `${String(hour).padStart(2, "0")}:${min}`;
          const candidate = `${date}|${time}|${room}`;
          if (candidate === currentSlot) continue;
          const dryRun = await requestJson(ctx.bridgeUrl, `/v1/schedule/appointments/${ctx.appointmentId}/time`, {
            method: "PATCH",
            intent: "dry-run",
            body: { date, time, room },
          });
          if (dryRun.status === 200) {
            return { date, time, room, candidate };
          }
        }
      }
    }
  }
  fail("no dry-run 200 slot for time move");
}

async function runTimeMoveWorkflow(ctx) {
  const workflow = "appointment.timeMove";
  log(`=== ${workflow}: discovering conflict-free slot (dry-run) ===`);
  const slot = await discoverFreeSlot(ctx);
  log(`slot_found date=${slot.date} time=${slot.time} room=${slot.room}`);

  const schedulePath = join(ctx.dataRoot, "SCHEDULE.DBF");
  const beforeHash = hashFile(schedulePath);
  log(`baseline hash_prefix=${hashPrefix(beforeHash)}`);
  const body = { date: slot.date, time: slot.time, room: slot.room };

  const dryRun = await requestJson(ctx.bridgeUrl, `/v1/schedule/appointments/${ctx.appointmentId}/time`, {
    method: "PATCH",
    intent: "dry-run",
    body,
  });
  logWriteResponse(workflow, "dry-run", dryRun);
  if (dryRun.status !== 200 || beforeHash !== hashFile(schedulePath)) {
    fail(`${workflow} dry-run FAIL`);
  }

  await legacyBackup(workflow, ctx.env);
  const backup = latestBackupDir(ctx.backupDir, workflow);
  if (!backup) fail(`backup directory missing workflow=${workflow}`);
  log(`backup workflow=${workflow} basename=${basenameSafe(backup)}`);

  const commit = await requestJson(ctx.bridgeUrl, `/v1/schedule/appointments/${ctx.appointmentId}/time`, {
    method: "PATCH",
    intent: "commit",
    body,
  });
  logWriteResponse(workflow, "commit", commit);
  if (commit.status !== 200 || commit.json?.committed !== true) {
    fail(`${workflow} commit FAIL`);
  }
  const actualSlot = await readback("schedule-slot", ctx.appointmentId, ctx.env);
  if (actualSlot !== slot.candidate) {
    fail(`dbf readback workflow=${workflow} expected_slot=${slot.candidate} got=${actualSlot || "none"}`);
  }
  log(`readback workflow=${workflow} source=dbf appointment_id=${ctx.appointmentId} slot=${actualSlot}`);
  await assertAuditOperation(ctx.bridgeUrl, ctx.sqlitePath, commit.json?.operationId, workflow);

  await legacyRestore(backup, ctx.env);
  const restoredHash = hashFile(schedulePath);
  if (beforeHash !== restoredHash) fail(`${workflow} restore FAIL`);
  log(`${workflow} restore PASS hash_prefix=${hashPrefix(restoredHash)}`);
  return workflowSummary({
    workflow,
    dryRun,
    commit,
    backup,
    dbfReadback: true,
    restore: true,
  });
}

async function runCreateWorkflow(ctx) {
  const workflow = "appointment.create";
  log(`=== ${workflow} ===`);
  const schedulePath = join(ctx.dataRoot, "SCHEDULE.DBF");
  const beforeHash = hashFile(schedulePath);
  log(`baseline hash_prefix=${hashPrefix(beforeHash)}`);

  const candidates = [
    { patId: ctx.patientId, date: "2026-05-22", time: "10:30", room: 2, durationSlots: 1 },
    { patId: ctx.patientId, date: "2026-05-25", time: "09:00", room: 1, durationSlots: 1 },
  ];
  let body;
  let dryRun;
  for (const candidate of candidates) {
    const response = await requestJson(ctx.bridgeUrl, "/v1/schedule/appointments", {
      method: "POST",
      intent: "dry-run",
      body: candidate,
    });
    if (response.status === 200 && beforeHash === hashFile(schedulePath)) {
      body = candidate;
      dryRun = response;
      break;
    }
  }
  if (!body || !dryRun) fail(`${workflow} dry-run FAIL`);
  logWriteResponse(workflow, "dry-run", dryRun);

  await legacyBackup(workflow, ctx.env);
  const backup = latestBackupDir(ctx.backupDir, workflow);
  if (!backup) fail(`backup directory missing workflow=${workflow}`);
  log(`backup workflow=${workflow} basename=${basenameSafe(backup)}`);

  const commit = await requestJson(ctx.bridgeUrl, "/v1/schedule/appointments", {
    method: "POST",
    intent: "commit",
    body,
  });
  logWriteResponse(workflow, "commit", commit);
  if (commit.status !== 200 || commit.json?.committed !== true || beforeHash === hashFile(schedulePath)) {
    fail(`${workflow} commit FAIL`);
  }
  const createId = commit.json?.recordIds?.[0];
  if (!createId) fail(`${workflow} commit missing recordIds[0]`);
  const exists = await readback("schedule-exists", createId, ctx.env);
  if (exists !== "ok") {
    fail(`dbf readback workflow=${workflow} appointment_id=${createId} not_in_schedule_dbf`);
  }
  log(`readback workflow=${workflow} source=dbf appointment_id=${createId} schedule_row=present`);
  await assertAuditOperation(ctx.bridgeUrl, ctx.sqlitePath, commit.json?.operationId, workflow);

  await legacyRestore(backup, ctx.env);
  const restoredHash = hashFile(schedulePath);
  if (beforeHash !== restoredHash) fail(`${workflow} restore FAIL`);
  log(`${workflow} restore PASS hash_prefix=${hashPrefix(restoredHash)}`);
  return workflowSummary({
    workflow,
    dryRun,
    commit,
    backup,
    dbfReadback: true,
    restore: true,
  });
}

async function runDemographicsWorkflow(ctx) {
  const workflow = "patient.demographics.update";
  log(`=== ${workflow} ===`);
  const patientPath = join(ctx.dataRoot, "PATIENT.DBF");
  const beforeHash = hashFile(patientPath);
  log(`baseline hash_prefix=${hashPrefix(beforeHash)}`);

  const dryRun = await requestJson(ctx.bridgeUrl, `/v1/patients/${ctx.patientId}/demographics`, {
    method: "PATCH",
    intent: "dry-run",
    body: { chartNumber: "QA-DRY-ONLY" },
  });
  logWriteResponse(workflow, "dry-run", dryRun);
  if (dryRun.status !== 200 || beforeHash !== hashFile(patientPath)) {
    fail(`${workflow} dry-run FAIL`);
  }

  await legacyBackup(workflow, ctx.env);
  const backup = latestBackupDir(ctx.backupDir, workflow);
  if (!backup) fail(`backup directory missing workflow=${workflow}`);
  log(`backup workflow=${workflow} basename=${basenameSafe(backup)}`);

  const commit = await requestJson(ctx.bridgeUrl, `/v1/patients/${ctx.patientId}/demographics`, {
    method: "PATCH",
    intent: "commit",
    body: { chartNumber: "QA-COMMIT-1" },
  });
  logWriteResponse(workflow, "commit", commit);
  if (commit.status !== 200 || commit.json?.committed !== true || beforeHash === hashFile(patientPath)) {
    fail(`${workflow} commit FAIL`);
  }
  const chart = await readback("patient-chart", ctx.patientId, ctx.env);
  if (chart !== "QA-COMMIT-1") {
    fail(`dbf readback workflow=${workflow} chart_number_mismatch`);
  }
  log(`readback workflow=${workflow} source=dbf patient_id=${ctx.patientId} chart_number_set=yes`);
  await assertAuditOperation(ctx.bridgeUrl, ctx.sqlitePath, commit.json?.operationId, workflow);

  await legacyRestore(backup, ctx.env);
  const restoredHash = hashFile(patientPath);
  if (beforeHash !== restoredHash) fail(`${workflow} restore FAIL`);
  log(`${workflow} restore PASS hash_prefix=${hashPrefix(restoredHash)}`);
  return workflowSummary({
    workflow,
    dryRun,
    commit,
    backup,
    dbfReadback: true,
    restore: true,
  });
}

function basenameSafe(path) {
  return path.split(/[\\/]/).pop() || "none";
}

function writeEvidenceSummary(summaryPath, workflows) {
  const resolved = resolve(summaryPath);
  const summary = {
    schemaVersion: "microdent-qa-sandbox-evidence-summary/v1",
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    phiStatement: "no-real-patient-data",
    rawPathsExcluded: true,
    workflows,
  };
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  log(`evidence summary written basename=${basenameSafe(resolved)} workflows=${workflows.length}`);
}

async function mirrorAdvisory(bridgeUrl) {
  banner("4/5 Mirror freshness advisory (warn only)");
  try {
    const mirror = await requestJson(bridgeUrl, "/v1/mirror/status");
    if (mirror.json?.sqliteConfigured !== true) {
      log("mirror advisory: status unavailable (skipped)");
      return;
    }
    const imported = mirror.json?.importedTables?.length ?? 0;
    const runs = mirror.json?.latestImportRuns?.length ?? 0;
    log(`mirror advisory: imported_tables=${imported} latest_runs=${runs} (stale mirror does not fail write proof)`);
    const stale = (mirror.json?.latestImportRuns ?? []).filter((run) => {
      if (!run.finishedAt) return false;
      return Date.now() - Date.parse(run.finishedAt) > 172800000;
    }).length;
    if (stale > 0) {
      log("WARN: mirror metadata includes imports older than 48h — re-run mirror:import-safe before relying on search/schedule");
    }
    const partialFailed = (mirror.json?.latestImportRuns ?? []).filter(
      (run) => run.status === "partial" || run.status === "failed",
    ).length;
    if (partialFailed > 0) {
      log("WARN: mirror has partial/failed table imports — DBF remains source of truth for writes");
    }
  } catch {
    log("mirror advisory: status unavailable (skipped)");
  }
}

async function main() {
  const dataRoot = requireEnv("DATA_ROOT");
  const sqlitePath = requireEnv("SQLITE_PATH");
  const backupDir = process.env.BACKUP_DIR || join(dirname(dataRoot), "backups");
  const bridgeHost = process.env.BRIDGE_HOST || "127.0.0.1";
  const bridgePort = process.env.BRIDGE_PORT || "17890";
  const bridgeUrl = process.env.BRIDGE_URL || `http://${bridgeHost}:${bridgePort}`;
  const env = {
    DATA_ROOT: dataRoot,
    SQLITE_PATH: sqlitePath,
    BACKUP_DIR: backupDir,
  };

  banner("1/5 Preflight");
  validateEnv({ dataRoot, sqlitePath });
  log("preflight ok marker=ok sqlite=ok");

  banner("2/5 Bridge build and start");
  log("building bridge (contracts + dist)");
  await run(pnpmCommand(), ["--filter", "@microdent/contracts", "run", "build"], { stdio: "ignore" });
  await run(pnpmCommand(), ["--filter", "@microdent/bridge", "run", "build"], { stdio: "ignore" });
  validateBuiltArtifacts();

  log(`starting bridge (node dist/server.js, writeMode=${process.env.WRITE_MODE || "enabled"})`);
  const bridge = spawnBridge({ dataRoot, sqlitePath, backupDir, bridgeHost, bridgePort });
  let bridgeExited = false;
  bridge.on("exit", () => {
    bridgeExited = true;
  });

  const stopBridge = async () => {
    if (!bridgeExited) {
      log(`stopping bridge pid=${bridge.pid}`);
      bridge.kill("SIGTERM");
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
      if (!bridgeExited) {
        bridge.kill("SIGKILL");
      }
    }
  };

  try {
    banner("3/5 Health and write-capability");
    await waitFor(bridgeUrl, "health", "/health", (result) => result.json?.ok === true);
    await waitFor(
      bridgeUrl,
      "write-capability",
      "/v1/meta/write-capability",
      (result) => result.json?.writableSandbox === true && result.json?.writeMode === "enabled",
    );

    await mirrorAdvisory(bridgeUrl);

    banner("5/5 Sandbox write smoke (DBF readback)");
    const appointmentId = await sqliteQuery(sqlitePath, "SELECT appointment_id FROM appointments LIMIT 1;");
    const patientId = await sqliteQuery(sqlitePath, "SELECT patient_id FROM patients LIMIT 1;");
    if (!appointmentId) fail("no appointment_id in mirror sqlite");
    if (!patientId) fail("no patient_id in mirror sqlite (run mirror import first)");
    const statusBefore = await readback("schedule-status", appointmentId, env);
    if (!/^\d+$/.test(statusBefore)) {
      fail(`could not read baseline STATUS from SCHEDULE.DBF for appointment_id=${appointmentId}`);
    }
    log(`appointment_id=${appointmentId} patient_id_present=yes status_before=${statusBefore}`);

    const ctx = { dataRoot, sqlitePath, backupDir, bridgeUrl, env, appointmentId, patientId };
    const workflows = [
      await runStatusWorkflow(ctx),
      await runTimeMoveWorkflow(ctx),
      await runCreateWorkflow(ctx),
      await runDemographicsWorkflow(ctx),
    ];
    if (process.env.QA_SANDBOX_EVIDENCE_SUMMARY) {
      writeEvidenceSummary(process.env.QA_SANDBOX_EVIDENCE_SUMMARY, workflows);
    }

    log("=== qa-sandbox-write-smoke complete (4 workflows) ===");
    banner("qa:sandbox complete");
    log("qa:sandbox complete");
  } finally {
    await stopBridge();
  }
}

main().catch((error) => {
  console.error(`[qa-sandbox-run] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
