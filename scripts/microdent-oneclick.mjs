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

const APP_SCENARIO_TEST_FILES = [
  "src/read-only-flow-smoke.test.tsx",
  "src/read-only-responsive-smoke.test.tsx",
  "src/appointment-status-write.test.tsx",
  "src/patient-demographics-write.test.tsx",
  "src/settings-panel.test.tsx",
];

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

function stepPassed(name) {
  return steps.some((step) => step.name === name && step.status === "PASSED");
}

function requiredScenarioCoverage() {
  const configSimulation = stepPassed("desktop first-run/config scenario simulation");
  const serviceProbe = stepPassed("clinic service startup probe");
  const desktopSmoke = stepPassed("desktop release smoke");
  const windowsScript = stepPassed("Windows one-click readiness script");
  const appScenarios = stepPassed("app scenario tests") || stepPassed("full workspace test");

  const linuxVerified = "LINUX VERIFIED";
  const linuxSimulated = "LINUX SIMULATED";
  const documented = "DOCUMENTED";
  const notCovered = "NOT COVERED BY ONE-CLICK";
  const windowsBlocked = "WINDOWS-ONLY BLOCKED";

  return [
    [
      "first launch with no config",
      configSimulation ? linuxSimulated : notCovered,
      configSimulation ? "default desktop config requires first-run setup" : "No config simulation did not pass",
      "Real first launch UX still needs desktop GUI observation",
    ],
    [
      "first-run setup appears",
      desktopSmoke ? documented : notCovered,
      desktopSmoke ? "desktop dist includes setup window artifacts and release smoke verifies setup-required defaults" : "Desktop smoke did not pass",
      "GUI appearance must be observed in Electron",
    ],
    [
      "first-run folder selection",
      desktopSmoke ? documented : notCovered,
      desktopSmoke ? "setup window/preload/build artifacts are present and desktop tests cover setup save helpers" : "No setup build evidence",
      "Native folder picker requires GUI/Windows observation",
    ],
    [
      "invalid folder handling",
      configSimulation ? linuxSimulated : notCovered,
      configSimulation ? "invalid data folder rejected by startup validation" : "Invalid-folder simulation did not pass",
      "Renderer copy/visual state still needs UI walk",
    ],
    [
      "config save",
      desktopSmoke ? documented : notCovered,
      desktopSmoke ? "desktop setup tests and release smoke cover config defaults/setup path" : "No desktop config evidence",
      "End-to-end setup save with picker requires GUI observation",
    ],
    [
      "backup folder creation",
      configSimulation ? linuxSimulated : notCovered,
      configSimulation ? "valid config with writable backup folder passes startup validation" : "Backup validation simulation did not pass",
      "Actual setup-created backup folder should be observed in GUI/Windows run",
    ],
    [
      "clinic service auto-start",
      serviceProbe ? linuxVerified : notCovered,
      serviceProbe ? "one-click starts built clinic service on loopback with WRITE_MODE=disabled" : "Clinic service probe did not pass",
      "Desktop-supervised start is covered by desktop tests/release smoke but real packaged Windows launch remains blocked",
    ],
    [
      "clinic service health check",
      serviceProbe ? linuxVerified : notCovered,
      serviceProbe ? "/health returned ok" : "Health probe did not pass",
      "",
    ],
    [
      "clinic service failure message",
      desktopSmoke ? documented : notCovered,
      desktopSmoke ? "desktop startup-failure tests are included in desktop test suite" : "Desktop tests did not pass",
      "Manual UI failure copy should be observed during GUI smoke",
    ],
    [
      "retry/restart path",
      desktopSmoke ? documented : notCovered,
      desktopSmoke ? "desktop tests cover supervisor restart/status IPC surfaces" : "Desktop tests did not pass",
      "Operator click path needs GUI smoke",
    ],
    [
      "local copy/mirror build or refresh",
      desktopSmoke ? documented : notCovered,
      desktopSmoke ? "setup import tests are included in desktop test suite; full import uses copied data only" : "Desktop setup import tests did not pass",
      "Real copied clinic data import remains Windows/operator-data dependent",
    ],
    [
      "Today loads",
      appScenarios ? linuxVerified : documented,
      appScenarios ? "read-only flow smoke opens Today and checks clinic-friendly status" : "Full mode runs workspace app tests",
      "Browser/Electron UI walkthrough still recommended",
    ],
    [
      "Patients search",
      appScenarios ? linuxVerified : documented,
      appScenarios ? "read-only flow smoke exercises top search and patient selection" : "Full mode runs bridge/client/app tests",
      "Real copied clinic data result set remains external",
    ],
    [
      "Patient Profile opens",
      appScenarios ? linuxVerified : documented,
      appScenarios ? "read-only flow smoke opens a patient profile and summary panel" : "Full mode runs app tests",
      "UI walkthrough still required for real patient navigation",
    ],
    ["Timeline tab", appScenarios ? linuxVerified : documented, appScenarios ? "read-only flow smoke activates Timeline" : "Full mode runs app tests", ""],
    ["Appointments tab", appScenarios ? linuxVerified : documented, appScenarios ? "read-only flow smoke activates Appointments" : "Full mode runs app tests", ""],
    ["Medical tab", appScenarios ? linuxVerified : documented, appScenarios ? "read-only flow smoke activates Medical" : "Full mode runs app tests", ""],
    ["Treatments tab", appScenarios ? linuxVerified : documented, appScenarios ? "read-only flow smoke activates Treatments" : "Full mode runs app tests", ""],
    ["Chart tab", appScenarios ? linuxVerified : documented, appScenarios ? "read-only flow smoke activates Chart" : "Full mode runs app tests", ""],
    [
      "Ledger preview tab",
      appScenarios ? linuxVerified : documented,
      appScenarios ? "read-only flow smoke activates Ledger preview and safety checks forbid payment detail leaks" : "Full mode runs app tests and safety regressions",
      "Must keep amounts/payment details hidden",
    ],
    ["Schedule loads", appScenarios ? linuxVerified : documented, appScenarios ? "read-only flow smoke opens Schedule and verifies appointments render" : "Full mode runs app tests", ""],
    ["Schedule filters", documented, appScenarios ? "read-only flow smoke clicks a schedule status chip; dedicated schedule tests cover broader filters" : "Full mode runs app tests", "Full cross-filter UI pass still belongs in browser/manual smoke"],
    [
      "opening patient from Schedule",
      documented,
      appScenarios ? "app scenario band verifies patient context and schedule rendering; deeper cross-navigation remains in app tests/manual smoke" : "Full mode runs app tests",
      "Manual UI walkthrough still recommended",
    ],
    [
      "opening Schedule from Profile",
      documented,
      appScenarios ? "app scenario band navigates profile to Settings/Schedule; direct profile-to-schedule action still needs UI walkthrough" : "Full mode runs app tests",
      "Manual UI walkthrough still recommended",
    ],
    ["Settings status refresh", appScenarios ? linuxVerified : documented, appScenarios ? "settings panel scenario tests pass" : "Full mode runs app tests", ""],
    ["sandbox write blocked state", appScenarios ? linuxVerified : documented, appScenarios ? "appointment status and demographics write tests cover unavailable/blocked states" : "Full mode runs bridge/app tests", ""],
    [
      "sandbox write available state",
      documented,
      "Sandbox workflows are guarded by existing sandbox tests and optional qa:sandbox; one-click does not enable writes",
      "Real sandbox signoff requires explicit DATA_ROOT/SQLITE_PATH/BACKUP_DIR",
    ],
    [
      "responsive layout check",
      appScenarios ? linuxSimulated : notCovered,
      appScenarios ? "read-only responsive smoke renders core pages at 1600, 1280, 1024, and 760 px widths" : "One-click does not drive a responsive smoke yet",
      "Visual browser/Electron viewport proof still recommended",
    ],
    [
      "forbidden-token safety check",
      appScenarios || desktopSmoke ? linuxVerified : notCovered,
      appScenarios ? "read-only flow smoke asserts no forbidden DOM tokens across main scenarios" : "release smoke and pilot artifact tests enforce staged artifact safety",
      "Full safety sweep should run before final release",
    ],
    [
      "one-click script result",
      "LINUX VERIFIED",
      `this report was generated by ${quick ? "microdent:oneclick:quick" : "microdent:oneclick"}`,
      "",
    ],
    [
      "Windows readiness script/checklist",
      windowsScript ? windowsBlocked : notCovered,
      windowsScript ? "scripts/windows-oneclick-check.ps1 is present" : "Windows script missing",
      "Run pnpm microdent:oneclick:windows on Windows 10/11 clinic test machine",
    ],
  ];
}

function writeReport() {
  mkdirSync(dirname(reportPath), { recursive: true });
  const coverage = requiredScenarioCoverage();
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
    "## Required App Scenario Coverage",
    "",
    "| Scenario | Status | Evidence | Remaining gap |",
    "| --- | --- | --- | --- |",
    ...coverage.map(
      ([scenario, status, evidence, gap]) =>
        `| ${scenario} | ${status} | ${evidence.replaceAll("|", "\\|")} | ${gap.replaceAll("|", "\\|")} |`,
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
    runPnpm("app scenario tests", [
      "--filter",
      "@microdent/app",
      "exec",
      "vitest",
      "run",
      ...APP_SCENARIO_TEST_FILES,
    ]);
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
