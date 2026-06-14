#!/usr/bin/env node
/**
 * Microdent one-click local verification.
 *
 * This is a development/Codex orchestration script. It never launches legacy
 * binaries, never touches production data, and does not claim Windows field
 * verification from Linux.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const node = process.execPath;
const args = new Set(process.argv.slice(2));
const quick = args.has("--quick");
const launch = args.has("--launch");
const reportArgIndex = process.argv.indexOf("--report");
const reportPath =
  reportArgIndex >= 0 && process.argv[reportArgIndex + 1]
    ? resolve(process.argv[reportArgIndex + 1])
    : join(
        repoRoot,
        "qa-runs",
        `${new Date().toISOString().slice(0, 10)}-microdent-oneclick-report.md`,
      );

const steps = [];
const notes = [];
let failed = false;

function now() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[microdent:oneclick] ${message}`);
}

function record(name, status, evidence, remainingGap = "") {
  steps.push({ name, status, evidence, remainingGap });
  if (status === "PROJECT FAILURE" || status === "ENV BLOCKED") {
    failed = true;
  }
}

function runCommand(label, command, commandArgs, options = {}) {
  log(`${label}: ${command} ${commandArgs.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: false,
  });
  const elapsed = `${Math.round((Date.now() - started) / 1000)}s`;

  if (result.error) {
    record(label, "ENV BLOCKED", `${result.error.message} (${elapsed})`, options.gap ?? "");
    return false;
  }
  if (result.status !== 0) {
    record(label, "PROJECT FAILURE", `exit ${result.status ?? "unknown"} (${elapsed})`, options.gap ?? "");
    return false;
  }
  record(label, "PASSED", `exit 0 (${elapsed})`);
  return true;
}

function runPnpm(label, commandArgs, options = {}) {
  return runCommand(label, pnpm, commandArgs, options);
}

async function probeClinicService() {
  const root = await mkdtemp(join(tmpdir(), "microdent-oneclick-"));
  const dataRoot = join(root, "DATA");
  const mirrorDir = join(root, "mirror");
  const backupDir = join(root, "backups");
  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(mirrorDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  const bridgeEntry = join(repoRoot, "services", "bridge", "dist", "server.js");
  if (!existsSync(bridgeEntry)) {
    record(
      "clinic service startup probe",
      "PROJECT FAILURE",
      "services/bridge/dist/server.js missing",
      "Run bridge build before probing service startup.",
    );
    await rm(root, { recursive: true, force: true });
    return;
  }

  const port = 19000 + Math.floor(Math.random() * 1000);
  const child = spawn(node, [bridgeEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BRIDGE_HOST: "127.0.0.1",
      BRIDGE_PORT: String(port),
      DATA_ROOT: dataRoot,
      SQLITE_PATH: join(mirrorDir, "clinic.sqlite"),
      BACKUP_DIR: backupDir,
      WRITE_MODE: "disabled",
    },
    stdio: ["ignore", "ignore", "ignore"],
  });

  try {
    let ok = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const body = await res.json();
          ok = body?.ok === true;
          if (ok) break;
        }
      } catch {
        // Service may still be starting.
      }
    }

    record(
      "clinic service startup probe",
      ok ? "PASSED" : "PROJECT FAILURE",
      ok ? "health endpoint returned ok on loopback with WRITE_MODE=disabled" : "health endpoint did not become ready",
      ok ? "" : "Inspect bridge startup locally; Windows firewall/AV remains WINDOWS-ONLY BLOCKED.",
    );
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolveExit) => {
      const timeout = setTimeout(resolveExit, 1500);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolveExit();
      });
    });
    if (!child.killed) child.kill("SIGKILL");
    await rm(root, { recursive: true, force: true });
  }
}

async function simulateDesktopConfigScenarios() {
  const configModulePath = join(repoRoot, "apps", "desktop", "dist", "config.js");
  const validationModulePath = join(repoRoot, "apps", "desktop", "dist", "startup-validation.js");
  if (!existsSync(configModulePath) || !existsSync(validationModulePath)) {
    record(
      "desktop first-run/config scenario simulation",
      "PROJECT FAILURE",
      "desktop dist config modules missing",
      "Run desktop build before scenario simulation.",
    );
    return;
  }

  const { defaultDesktopConfig, desktopConfigNeedsSetup } = await import(
    pathToFileURL(configModulePath).href
  );
  const { validateDesktopStartupConfig } = await import(pathToFileURL(validationModulePath).href);
  const root = await mkdtemp(join(tmpdir(), "microdent-desktop-config-"));
  const dataRoot = join(root, "DATA folder with spaces");
  const mirrorDir = join(root, "mirror folder with spaces");
  const backupDir = join(root, "backup folder with spaces");
  mkdirSync(dataRoot, { recursive: true });
  mkdirSync(mirrorDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  try {
    const defaults = defaultDesktopConfig();
    const noConfigNeedsSetup = desktopConfigNeedsSetup(defaults) === true;
    const validConfig = {
      ...defaults,
      dataRoot,
      sqlitePath: join(mirrorDir, "clinic.sqlite"),
      backupDir,
      writeMode: "disabled",
    };
    validateDesktopStartupConfig(validConfig);
    const validConfigReady = desktopConfigNeedsSetup(validConfig) === false;

    let invalidFolderRejected = false;
    try {
      validateDesktopStartupConfig({
        ...validConfig,
        dataRoot: join(root, "missing DATA"),
      });
    } catch {
      invalidFolderRejected = true;
    }

    const ok = noConfigNeedsSetup && validConfigReady && invalidFolderRejected;
    record(
      "desktop first-run/config scenario simulation",
      ok ? "PASSED" : "PROJECT FAILURE",
      ok
        ? "no-config requires setup; valid paths with spaces pass; invalid data folder is rejected"
        : "one or more first-run/config checks failed",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function verifyWindowsPreparedPath() {
  const script = join(repoRoot, "scripts", "windows-oneclick-check.ps1");
  if (existsSync(script)) {
    record(
      "Windows one-click readiness script",
      "PASSED",
      "scripts/windows-oneclick-check.ps1 exists for real Windows validation",
      "Execution remains WINDOWS-ONLY BLOCKED until run on Windows.",
    );
  } else {
    record(
      "Windows one-click readiness script",
      "PROJECT FAILURE",
      "scripts/windows-oneclick-check.ps1 missing",
    );
  }
}

function writeReport() {
  mkdirSync(dirname(reportPath), { recursive: true });
  const lines = [
    "# Microdent Modern One-Click Report",
    "",
    `Generated: ${now()}`,
    `Mode: ${quick ? "quick" : "full"}`,
    `Platform: ${process.platform}`,
    "",
    "This report is PHI-safe by design. It does not contain patient names, raw DBF rows, SQLite rows, comments, notes, phone numbers, payment amounts, or operator paths.",
    "",
    "## Scenario Matrix",
    "",
    "| Scenario | Status | Evidence | Remaining gap |",
    "| --- | --- | --- | --- |",
    ...steps.map((step) =>
      `| ${step.name} | ${step.status} | ${step.evidence.replaceAll("|", "\\|")} | ${step.remainingGap.replaceAll("|", "\\|")} |`,
    ),
    "",
    "## Launch",
    "",
    launch
      ? "Launch flag was requested; use the desktop start command below if the app did not open."
      : "Desktop launch was not requested. Exact local launch command:",
    "",
    "```sh",
    "pnpm --filter @microdent/desktop run start",
    "```",
    "",
    "## Windows Status",
    "",
    "- Linux/Codex can verify builds, tests, config scenarios, and loopback clinic service startup.",
    "- Real Windows desktop launch, AppData behavior, SmartScreen/firewall/AV prompts, and packaged Electron runtime remain WINDOWS-ONLY BLOCKED until run on a Windows clinic machine.",
    "",
    ...notes,
  ];
  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  log(`report written: ${reportPath}`);
}

async function main() {
  log(`mode=${quick ? "quick" : "full"}`);

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  record(
    "Node runtime",
    nodeMajor >= 18 ? "PASSED" : "ENV BLOCKED",
    `node ${process.version}`,
    nodeMajor >= 22 ? "" : "Node 22+ is recommended for local-copy SQLite runtime; staged Windows package should bundle Node 22.",
  );

  runPnpm("pnpm availability", ["--version"]);

  if (!existsSync(join(repoRoot, "node_modules"))) {
    runPnpm("dependency install", ["install", "--frozen-lockfile"], {
      gap: "Install dependencies before running one-click verification.",
    });
  } else {
    record("dependency install/check", "PASSED", "node_modules present; install skipped");
  }

  if (quick) {
    runPnpm("contracts build", ["--filter", "@microdent/contracts", "run", "build"]);
    runPnpm("bridge build", ["--filter", "@microdent/bridge", "run", "build"]);
    runPnpm("sqlite mirror build", ["--filter", "@microdent/sqlite-mirror", "run", "build"]);
    runPnpm("web build", ["build:web"]);
    runPnpm("desktop build", ["--filter", "@microdent/desktop", "run", "build"]);
    runPnpm("desktop tests", ["--filter", "@microdent/desktop", "run", "test"]);
    runPnpm("desktop release smoke", ["desktop:release-smoke"]);
  } else {
    runPnpm("full workspace test", ["test"]);
    runPnpm("web build", ["build:web"]);
    runPnpm("desktop release smoke", ["desktop:release-smoke"]);
    runPnpm("pilot artifact tests", ["test:pilot-artifacts"]);
  }

  await simulateDesktopConfigScenarios();
  await probeClinicService();
  verifyWindowsPreparedPath();

  if (launch) {
    const launched = runPnpm("desktop launch", ["--filter", "@microdent/desktop", "run", "start"], {
      gap: "If GUI launch is unavailable in this environment, use the printed launch command on a desktop session.",
    });
    if (!launched) {
      notes.push("- Desktop GUI launch failed or was environment-blocked; this does not by itself prove the app runtime is broken.");
    }
  }

  writeReport();
  if (failed) process.exit(1);
}

main().catch((err) => {
  record("one-click orchestrator", "PROJECT FAILURE", err instanceof Error ? err.message : String(err));
  writeReport();
  process.exit(1);
});
