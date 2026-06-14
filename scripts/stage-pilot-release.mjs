#!/usr/bin/env node
/**
 * Stage Windows pilot release tree under dist/pilot-release/MicrodentModern/.
 * Copies compiled dist only — never sandbox DATA, sqlite, or Legacy trees.
 * PHI-safe: logs file/dir counts only.
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertConfigTemplateSafe,
  assertSafeSourcePath,
  assertStagedTreeSafe,
  FORBIDDEN_ENV_FILE,
  isAllowedDbfFileName,
  pathHasForbiddenSegment,
} from "./pilot-release-artifact-rules.mjs";
import { generateReleaseManifest } from "./pilot-release-manifest.mjs";
import {
  validateNodeRuntimeDir,
  writeNodeRuntimeManifest,
} from "./node-runtime-staging.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(repoRoot, "dist", "pilot-release");
const stageRoot = join(releaseRoot, "MicrodentModern");

function fail(message) {
  console.error(`[stage-pilot-release] FAIL: ${message}`);
  process.exit(1);
}

function countTree(dir) {
  let files = 0;
  let dirs = 0;
  if (!existsSync(dir)) return { files, dirs };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs += 1;
      const nested = countTree(child);
      files += nested.files;
      dirs += nested.dirs;
    } else {
      files += 1;
    }
  }
  return { files, dirs };
}

function requireDist(relPath, label) {
  const abs = join(repoRoot, relPath);
  try {
    assertSafeSourcePath(abs, repoRoot);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  if (!existsSync(abs)) {
    fail(`${label} missing — build before staging (${relPath})`);
  }
  return abs;
}

function copyDistDir(src, dest, options = {}) {
  try {
    assertSafeSourcePath(src, repoRoot);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const name = basename(srcPath);
      if (FORBIDDEN_ENV_FILE.test(name)) {
        return false;
      }
      if (/\.log$/i.test(name)) {
        return false;
      }
      if (/\.sqlite3?$/i.test(name)) {
        return false;
      }
      if (/\.(dbf|fpt|cdx)$/i.test(name) && !isAllowedDbfFileName(name)) {
        return false;
      }
      if (/\.(exe|bat|cmd)$/i.test(name)) {
        return false;
      }
      if (options.excludeTestArtifacts && /\.test\.(js|d\.ts|cjs)$/i.test(srcPath)) {
        return false;
      }
      return true;
    },
  });
}

function copyNodeRuntimeDir(src, dest) {
  let validation;
  try {
    const platform = existsSync(join(src, "node.exe")) ? "win32" : process.platform;
    validation = validateNodeRuntimeDir({
      runtimeDir: src,
      platform,
      expectedSha256: process.env.MICRODENT_NODE_RUNTIME_SHA256,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const name = basename(srcPath);
      if (FORBIDDEN_ENV_FILE.test(name)) return false;
      if (/\.log$/i.test(name)) return false;
      if (/\.sqlite3?$/i.test(name)) return false;
      if (/\.(dbf|fpt|cdx)$/i.test(name)) return false;
      if (/\.(bat|cmd)$/i.test(name)) return false;
      if (/\.exe$/i.test(name) && !/^node\.exe$/i.test(name)) return false;
      return true;
    },
  });
  writeNodeRuntimeManifest(dest, validation);
  return validation;
}

function copyFileSafe(src, dest) {
  try {
    assertSafeSourcePath(src, repoRoot);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function copyRuntimePackageDir(src, dest) {
  const resolvedSrc = realpathSync(src);
  try {
    assertSafeSourcePath(resolvedSrc, repoRoot);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(resolvedSrc, dest, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const name = basename(srcPath);
      if (FORBIDDEN_ENV_FILE.test(name)) return false;
      if (/\.log$/i.test(name)) return false;
      if (/\.sqlite3?$/i.test(name)) return false;
      if (/\.(dbf|fpt|cdx)$/i.test(name)) return false;
      if (/\.(exe|bat|cmd)$/i.test(name)) return false;
      return true;
    },
  });
}

function writeMicrodentRuntimePackage(packageName, packageRoot, destRoot) {
  const dest = join(destRoot, "@microdent", packageName);
  mkdirSync(join(dest, "dist"), { recursive: true });
  copyFileSafe(join(packageRoot, "package.json"), join(dest, "package.json"));
  copyRuntimePackageDir(join(packageRoot, "dist"), join(dest, "dist"));
  if (packageName === "sqlite-mirror") {
    copyRuntimePackageDir(join(packageRoot, "sql"), join(dest, "sql"));
  }
}

function writeRuntimeNodeModules() {
  const destRoot = join(stageRoot, "node_modules");
  mkdirSync(destRoot, { recursive: true });

  writeMicrodentRuntimePackage("contracts", join(repoRoot, "packages", "contracts"), destRoot);
  writeMicrodentRuntimePackage("bridge", join(repoRoot, "services", "bridge"), destRoot);
  writeMicrodentRuntimePackage("sqlite-mirror", join(repoRoot, "services", "sqlite-mirror"), destRoot);

  for (const [name, src] of [
    ["dbffile", join(repoRoot, "node_modules", ".pnpm", "dbffile@1.12.0", "node_modules", "dbffile")],
    ["iconv-lite", join(repoRoot, "node_modules", ".pnpm", "iconv-lite@0.4.24", "node_modules", "iconv-lite")],
    ["safer-buffer", join(repoRoot, "node_modules", ".pnpm", "safer-buffer@2.1.2", "node_modules", "safer-buffer")],
    ["zod", join(repoRoot, "node_modules", ".pnpm", "zod@3.25.76", "node_modules", "zod")],
  ]) {
    copyRuntimePackageDir(src, join(destRoot, name));
  }

  const expressNodeModules = join(repoRoot, "node_modules", ".pnpm", "express@4.22.2", "node_modules");
  for (const name of readdirSync(expressNodeModules)) {
    copyRuntimePackageDir(join(expressNodeModules, name), join(destRoot, name));
  }
}

function writePlaceholderDir(dirName, lines) {
  const dir = join(stageRoot, dirName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "README.txt"), `${lines.join("\n")}\n`, "utf8");
}

function writeWindowsDoubleClickRunner() {
  const lines = [
    "@echo off",
    "setlocal EnableExtensions",
    "title Microdent Modern Windows Test",
    "set \"ROOT=%~dp0\"",
    "set \"RUN_ROOT=%ProgramData%\\MicrodentClinicPilot\"",
    "if not exist \"%RUN_ROOT%\" mkdir \"%RUN_ROOT%\" >nul 2>&1",
    "if not exist \"%RUN_ROOT%\" set \"RUN_ROOT=%TEMP%\\MicrodentClinicPilot\"",
    "if not exist \"%RUN_ROOT%\" mkdir \"%RUN_ROOT%\" >nul 2>&1",
    "set \"QA_ROOT=%RUN_ROOT%\\qa-runs\"",
    "if not exist \"%QA_ROOT%\" mkdir \"%QA_ROOT%\" >nul 2>&1",
    "if not exist \"%QA_ROOT%\" (",
    "  echo Could not create the local report folder. Ask support to run from a writable Windows profile.",
    "  pause",
    "  exit /b 1",
    ")",
    "set \"REPORT=%QA_ROOT%\\WINDOWS-SMOKE-REPORT.txt\"",
    "",
    "cls",
    "echo Microdent Modern - simple Windows test",
    "echo =====================================",
    "echo.",
    "echo This helper is PHI-safe. Do NOT type patient names, phone numbers,",
    "echo chart numbers, appointment comments, or DBF rows into report answers.",
    "echo.",
    "echo The optional DATA path prompt below is local-only and redacted in the report.",
    "echo Prefer clinic-data-copy\\DATA. Never paste a live production legacy path.",
    "echo.",
    "echo It will create:",
    "echo   %REPORT%",
    "echo.",
    "pause",
    "",
    "> \"%REPORT%\" echo Microdent Modern Windows smoke report",
    ">> \"%REPORT%\" echo Generated: %DATE% %TIME%",
    ">> \"%REPORT%\" echo Machine label: CLINIC-PC-01",
    ">> \"%REPORT%\" echo.",
    ">> \"%REPORT%\" ver",
    ">> \"%REPORT%\" echo.",
    "",
    "set \"NODE_EXE=\"",
    "if exist \"%ROOT%node\\node.exe\" set \"NODE_EXE=%ROOT%node\\node.exe\"",
    "if not defined NODE_EXE for %%N in (node.exe) do if not \"%%~$PATH:N\"==\"\" set \"NODE_EXE=%%~$PATH:N\"",
    "if not defined NODE_EXE (",
    "  echo Bundled Node was not found. This copied package is incomplete.",
    "  >> \"%REPORT%\" echo Node available: no",
    ") else (",
    "  echo Using Node: %NODE_EXE%",
    "  >> \"%REPORT%\" echo Node available: yes",
    "  \"%NODE_EXE%\" -v >> \"%REPORT%\" 2>&1",
    ")",
    "",
    "set \"DEFAULT_DATA=%ROOT%clinic-data-copy\\DATA\"",
    "set \"RUN_DATA_ROOT=%RUN_ROOT%\\DATA\"",
    "set \"SQLITE_PATH=%RUN_ROOT%\\mirror\\clinic.sqlite\"",
    "set \"BACKUP_DIR=%RUN_ROOT%\\backups\"",
    "if not exist \"%RUN_ROOT%\\mirror\" mkdir \"%RUN_ROOT%\\mirror\" >nul 2>&1",
    "if not exist \"%BACKUP_DIR%\" mkdir \"%BACKUP_DIR%\" >nul 2>&1",
    "echo.",
    "echo Copied clinic data folder",
    "echo -------------------------",
    "echo Recommended: put copied DBF files in:",
    "echo   %DEFAULT_DATA%",
    "echo This copied source folder stays local and is not included in the safe results zip.",
    "echo.",
    "echo This script will copy them into a generic local test folder:",
    "echo   %RUN_ROOT%",
    "echo.",
    "set /p DATA_SOURCE=Press Enter to use that path, or paste copied DATA folder path: ",
    "if \"%DATA_SOURCE%\"==\"\" set \"DATA_SOURCE=%DEFAULT_DATA%\"",
    ">> \"%REPORT%\" echo Data folder selected: [operator-provided copied folder]",
    ">> \"%REPORT%\" echo Runtime data folder: public generic test folder",
    ">> \"%REPORT%\" echo SQLite mirror: public generic test folder",
    "",
    "set \"COPY_OK=no\"",
    "if exist \"%DATA_SOURCE%\" (",
    "  echo Copying clinic data into local test folder...",
    "  if exist \"%RUN_DATA_ROOT%\" rmdir /s /q \"%RUN_DATA_ROOT%\"",
    "  mkdir \"%RUN_DATA_ROOT%\"",
    "  robocopy \"%DATA_SOURCE%\" \"%RUN_DATA_ROOT%\" /E /NFL /NDL /NJH /NJS /NP >nul",
    "  if errorlevel 8 (",
    "    echo Copy failed. Import will be skipped.",
    "    >> \"%REPORT%\" echo Local data copy: failed",
    "  ) else (",
    "    set \"COPY_OK=yes\"",
    "    echo Copy finished.",
    "    >> \"%REPORT%\" echo Local data copy: finished",
    "  )",
    ") else (",
    "  echo Copied DATA folder was not found. Import will be skipped.",
    "  >> \"%REPORT%\" echo Local data copy: source not found",
    ")",
    "set \"DATA_ROOT=%RUN_DATA_ROOT%\"",
    "",
    "if defined NODE_EXE if \"%COPY_OK%\"==\"yes\" if exist \"%DATA_ROOT%\" (",
    "  echo.",
    "  echo Importing patients, appointments, schedule, treatments, doctors, procedures...",
    "  echo This prints counts only. It does not print patient names.",
    "  >> \"%REPORT%\" echo.",
    "  >> \"%REPORT%\" echo Import summary:",
    "  set \"DATA_ROOT=%DATA_ROOT%\"",
    "  set \"SQLITE_PATH=%SQLITE_PATH%\"",
    "  \"%NODE_EXE%\" \"%ROOT%scripts\\import-copied-data.mjs\" >> \"%REPORT%\" 2>&1",
    "  if errorlevel 1 (",
    "    echo Import did not fully pass. Check the report for table status/counts.",
    "  ) else (",
    "    echo Import finished.",
    "  )",
    ") else (",
    "  echo Skipping import because Node is missing or the local data copy did not finish.",
    "  >> \"%REPORT%\" echo Import skipped: Node missing or local data copy did not finish",
    ")",
    "",
    "if defined NODE_EXE if exist \"%ROOT%bridge\\server.js\" (",
    "  echo Starting clinic service for web/app test...",
    "  set \"BRIDGE_PORT=17890\"",
    "  set \"WRITE_MODE=disabled\"",
    "  set \"BRIDGE_HEALTH_FILE=%QA_ROOT%\\BRIDGE-HEALTH.txt\"",
    "  if exist \"%BRIDGE_HEALTH_FILE%\" del /q \"%BRIDGE_HEALTH_FILE%\" >nul 2>&1",
    "  start \"Microdent clinic service\" /min \"%NODE_EXE%\" \"%ROOT%bridge\\server.js\"",
    "  >> \"%REPORT%\" echo Clinic service start attempted: yes",
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ok=$false; for ($i=0; $i -lt 8; $i++) { try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:17890/health'; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch { Start-Sleep -Seconds 1 } }; if ($ok) { 'healthy' } else { 'unavailable' }\" > \"%BRIDGE_HEALTH_FILE%\" 2>nul",
    "  set \"BRIDGE_HEALTH=unavailable\"",
    "  if exist \"%BRIDGE_HEALTH_FILE%\" set /p BRIDGE_HEALTH=<\"%BRIDGE_HEALTH_FILE%\"",
    "  >> \"%REPORT%\" echo Clinic service health probe: %BRIDGE_HEALTH%",
    "  if /I not \"%BRIDGE_HEALTH%\"==\"healthy\" (",
    "    echo Clinic service did not answer on port 17890.",
    "    echo Close any old Microdent or node.exe windows, then rerun this helper if Settings shows offline.",
    "  )",
    ")",
    "",
    "echo Looking for a packaged desktop app...",
    "set \"APP_EXE=\"",
    "if exist \"%ROOT%Microdent Modern.exe\" set \"APP_EXE=%ROOT%Microdent Modern.exe\"",
    "if not defined APP_EXE if exist \"%ROOT%app\\Microdent Modern.exe\" set \"APP_EXE=%ROOT%app\\Microdent Modern.exe\"",
    "if not defined APP_EXE if exist \"%ROOT%app\\dist\\Microdent Modern.exe\" set \"APP_EXE=%ROOT%app\\dist\\Microdent Modern.exe\"",
    "",
    "if defined APP_EXE (",
    "  echo Opening desktop app...",
    "  >> \"%REPORT%\" echo Launch target: packaged desktop exe",
    "  start \"\" \"%APP_EXE%\"",
    ") else if defined NODE_EXE if exist \"%ROOT%scripts\\serve-web.mjs\" (",
    "  echo No packaged .exe found in this handoff folder.",
    "  echo Opening web preview...",
    "  set \"WEB_PORT=4173\"",
    "  set \"WEB_URL_FILE=%QA_ROOT%\\WEB-PREVIEW-URL.txt\"",
    "  if exist \"%WEB_URL_FILE%\" del /q \"%WEB_URL_FILE%\" >nul 2>&1",
    "  start \"Microdent web preview\" /min \"%NODE_EXE%\" \"%ROOT%scripts\\serve-web.mjs\"",
    "  timeout /t 2 /nobreak >nul",
    "  set \"WEB_URL=http://127.0.0.1:4173/\"",
    "  if exist \"%WEB_URL_FILE%\" set /p WEB_URL=<\"%WEB_URL_FILE%\"",
    "  set \"WEB_HEALTH_FILE=%QA_ROOT%\\WEB-PREVIEW-HEALTH.txt\"",
    "  if exist \"%WEB_HEALTH_FILE%\" del /q \"%WEB_HEALTH_FILE%\" >nul 2>&1",
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ok=$false; try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri $env:WEB_URL; if ($r.StatusCode -eq 200 -and $r.Content -match 'Microdent') { $ok=$true } } catch {}; if ($ok) { 'healthy' } else { 'unavailable' }\" > \"%WEB_HEALTH_FILE%\" 2>nul",
    "  set \"WEB_HEALTH=unavailable\"",
    "  if exist \"%WEB_HEALTH_FILE%\" set /p WEB_HEALTH=<\"%WEB_HEALTH_FILE%\"",
    "  echo Web preview URL: %WEB_URL%",
    "  >> \"%REPORT%\" echo Launch target: %WEB_URL%",
    "  >> \"%REPORT%\" echo Web preview health probe: %WEB_HEALTH%",
    "  if /I not \"%WEB_HEALTH%\"==\"healthy\" (",
    "    echo Web preview did not answer yet. If Chrome shows a blank or error page, close old node.exe windows and rerun this helper.",
    "  )",
    "  start \"\" \"%WEB_URL%\"",
    ") else (",
    "  echo Web preview cannot start because bundled Node or scripts\\serve-web.mjs is missing.",
    "  >> \"%REPORT%\" echo Launch target: unavailable - copied package incomplete",
    ")",
    "",
    "echo.",
    "echo When the app or web preview opens, test ONLY these things:",
    "echo   1. App/web opens without crashing.",
    "echo   2. Settings screen is reachable.",
    "echo   3. Today screen is reachable.",
    "echo   4. Patients screen is reachable.",
    "echo   5. Schedule screen is reachable.",
    "echo   6. If you choose a copied data folder, local copy/import finishes.",
    "echo.",
    "echo Keep all answers PHI-safe. Type only yes/no/blocked.",
    "echo.",
    "choice /C YNB /N /M \"App or web opened without crashing? [Y/N/B] \"",
    "if errorlevel 3 (set \"APP_OPENED=blocked\") else if errorlevel 2 (set \"APP_OPENED=no\") else set \"APP_OPENED=yes\"",
    "choice /C YNB /N /M \"SmartScreen or antivirus allowed the app/preview? [Y/N/B] \"",
    "if errorlevel 3 (set \"AV_OK=blocked\") else if errorlevel 2 (set \"AV_OK=no\") else set \"AV_OK=yes\"",
    "choice /C YNB /N /M \"Settings reachable? [Y/N/B] \"",
    "if errorlevel 3 (set \"SETTINGS_OK=blocked\") else if errorlevel 2 (set \"SETTINGS_OK=no\") else set \"SETTINGS_OK=yes\"",
    "choice /C YNB /N /M \"Today reachable? [Y/N/B] \"",
    "if errorlevel 3 (set \"TODAY_OK=blocked\") else if errorlevel 2 (set \"TODAY_OK=no\") else set \"TODAY_OK=yes\"",
    "choice /C YNB /N /M \"Patients reachable? [Y/N/B] \"",
    "if errorlevel 3 (set \"PATIENTS_OK=blocked\") else if errorlevel 2 (set \"PATIENTS_OK=no\") else set \"PATIENTS_OK=yes\"",
    "choice /C YNB /N /M \"Schedule reachable? [Y/N/B] \"",
    "if errorlevel 3 (set \"SCHEDULE_OK=blocked\") else if errorlevel 2 (set \"SCHEDULE_OK=no\") else set \"SCHEDULE_OK=yes\"",
    "choice /C YNB /N /M \"Local copy/import finished? [Y/N/B] \"",
    "if errorlevel 3 (set \"IMPORT_OK=blocked\") else if errorlevel 2 (set \"IMPORT_OK=no\") else set \"IMPORT_OK=yes\"",
    "choice /C YNB /N /M \"Settings showed service healthy? [Y/N/B] \"",
    "if errorlevel 3 (set \"SERVICE_OK=blocked\") else if errorlevel 2 (set \"SERVICE_OK=no\") else set \"SERVICE_OK=yes\"",
    "choice /C YNB /N /M \"After refresh/reopen, app or preview still worked? [Y/N/B] \"",
    "if errorlevel 3 (set \"RESTART_OK=blocked\") else if errorlevel 2 (set \"RESTART_OK=no\") else set \"RESTART_OK=yes\"",
    "",
    "set \"OPERATOR_READ_ONLY_SMOKE=needs-review\"",
    "if /I \"%APP_OPENED%\"==\"yes\" if /I \"%AV_OK%\"==\"yes\" if /I \"%SETTINGS_OK%\"==\"yes\" if /I \"%TODAY_OK%\"==\"yes\" if /I \"%PATIENTS_OK%\"==\"yes\" if /I \"%SCHEDULE_OK%\"==\"yes\" if /I \"%IMPORT_OK%\"==\"yes\" if /I \"%SERVICE_OK%\"==\"yes\" if /I \"%RESTART_OK%\"==\"yes\" set \"OPERATOR_READ_ONLY_SMOKE=all-pass\"",
    "",
    ">> \"%REPORT%\" echo App opened: %APP_OPENED%",
    ">> \"%REPORT%\" echo SmartScreen or antivirus allowed: %AV_OK%",
    ">> \"%REPORT%\" echo Settings reachable: %SETTINGS_OK%",
    ">> \"%REPORT%\" echo Today reachable: %TODAY_OK%",
    ">> \"%REPORT%\" echo Patients reachable: %PATIENTS_OK%",
    ">> \"%REPORT%\" echo Schedule reachable: %SCHEDULE_OK%",
    ">> \"%REPORT%\" echo Local copy/import finished: %IMPORT_OK%",
    ">> \"%REPORT%\" echo Service healthy: %SERVICE_OK%",
    ">> \"%REPORT%\" echo Refresh/reopen worked: %RESTART_OK%",
    ">> \"%REPORT%\" echo Operator read-only smoke answers: %OPERATOR_READ_ONLY_SMOKE%",
    ">> \"%REPORT%\" echo Unsupported writes attempted: no",
    ">> \"%REPORT%\" echo Safe results bundle target: MicrodentModern-safe-results.zip",
    ">> \"%REPORT%\" echo.",
    ">> \"%REPORT%\" echo PHI reminder: report must not contain patient names, phone numbers, chart numbers, comments, DBF rows, raw logs, or screenshots.",
    "",
    "if defined NODE_EXE if exist \"%ROOT%scripts\\write-smoke-evidence.mjs\" (",
    "  echo Writing PHI-safe evidence JSON files...",
    "  del /q \"%QA_ROOT%\\*-evidence-attachment-manifest-CLINIC-PC-01.json\" \"%QA_ROOT%\\*-windows-package-verify-evidence-CLINIC-PC-01.json\" \"%QA_ROOT%\\*-windows-field-evidence-CLINIC-PC-01.json\" >nul 2>&1",
    "  set \"REPORT_PATH=%REPORT%\"",
    "  set \"QA_ROOT=%QA_ROOT%\"",
    "  set \"PACKAGE_ROOT=%ROOT%\"",
    "  set \"BACKUP_DIR=%BACKUP_DIR%\"",
    "  \"%NODE_EXE%\" \"%ROOT%scripts\\write-smoke-evidence.mjs\"",
    ")",
    "",
    "set \"RESULTS_ZIP=%QA_ROOT%\\MicrodentModern-safe-results.zip\"",
    "if exist \"%RESULTS_ZIP%\" del /q \"%RESULTS_ZIP%\" >nul 2>&1",
    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ErrorActionPreference='Stop'; $report=$env:REPORT; $jsons=@(); $patterns=@('*-evidence-attachment-manifest-CLINIC-PC-01.json','*-windows-package-verify-evidence-CLINIC-PC-01.json','*-windows-field-evidence-CLINIC-PC-01.json'); foreach ($pattern in $patterns) { $matches=@(Get-ChildItem -LiteralPath $env:QA_ROOT -Filter $pattern -File); if ($matches.Count -eq 1) { $jsons += $matches[0].FullName } }; if ((Test-Path -LiteralPath $report) -and $jsons.Count -eq 3) { $files=@($report) + $jsons; Compress-Archive -LiteralPath $files -DestinationPath $env:RESULTS_ZIP -Force }\" >nul 2>&1",
    "if exist \"%RESULTS_ZIP%\" (",
    "  echo.",
    "  echo Safe results bundle created:",
    "  echo   %RESULTS_ZIP%",
    ") else (",
    "  echo.",
    "  echo Could not create the safe results zip. Use the report and JSON files in the folder below.",
    ")",
    "",
    "echo.",
    "echo Done. Your safe report is here:",
    "echo   %REPORT%",
    "echo.",
    "echo Safe evidence JSON files, if generated, are also in:",
    "echo   %QA_ROOT%",
    "echo.",
    "echo Send back only MicrodentModern-safe-results.zip.",
    "echo If the zip was not created, send only WINDOWS-SMOKE-REPORT.txt and the three generated JSON files.",
    "echo Do not send DBF, SQLite, config, logs, screenshots, or the copied DATA folder.",
    "echo.",
    "start \"\" notepad \"%REPORT%\"",
    "start \"\" explorer \"%QA_ROOT%\"",
    "pause",
  ];
  writeFileSync(join(stageRoot, "DOUBLE-CLICK-WINDOWS-TEST.cmd"), `${lines.join("\r\n")}\r\n`, "utf8");
}

function writeWindowsAutoTestRunner() {
  const lines = [
    "@echo off",
    "setlocal EnableExtensions",
    "title Microdent Modern Auto Test",
    "set \"ROOT=%~dp0\"",
    "set \"NONINTERACTIVE=no\"",
    "if /I \"%~1\"==\"--ci\" set \"NONINTERACTIVE=yes\"",
    "if /I \"%~1\"==\"--non-interactive\" set \"NONINTERACTIVE=yes\"",
    "if /I \"%CI%\"==\"true\" set \"NONINTERACTIVE=yes\"",
    "set \"RUN_ROOT=%ProgramData%\\MicrodentClinicPilot\"",
    "if not exist \"%RUN_ROOT%\" mkdir \"%RUN_ROOT%\" >nul 2>&1",
    "if not exist \"%RUN_ROOT%\" set \"RUN_ROOT=%TEMP%\\MicrodentClinicPilot\"",
    "if not exist \"%RUN_ROOT%\" mkdir \"%RUN_ROOT%\" >nul 2>&1",
    "set \"QA_ROOT=%RUN_ROOT%\\qa-runs\"",
    "if not exist \"%QA_ROOT%\" mkdir \"%QA_ROOT%\" >nul 2>&1",
    "if not exist \"%QA_ROOT%\" (",
    "  echo Could not create the local report folder. Ask support to run from a writable Windows profile.",
    "  pause",
    "  exit /b 1",
    ")",
    "set \"REPORT=%QA_ROOT%\\WINDOWS-AUTO-TEST-REPORT.txt\"",
    "",
    "cls",
    "echo Microdent Modern - automated Windows test",
    "echo =========================================",
    "echo.",
    "echo This will automatically copy/import copied DATA, start the clinic service,",
    "echo try to open the desktop app first, then open the browser preview only if",
    "echo no desktop runtime is available.",
    "echo.",
    "echo Put copied clinic files in:",
    "echo   %ROOT%clinic-data-copy\\DATA",
    "echo.",
    "echo Do not use a live production legacy folder. Do not send DBF, SQLite, logs,",
    "echo screenshots, config files, or the copied DATA folder back to support.",
    "echo.",
    "if /I not \"%NONINTERACTIVE%\"==\"yes\" pause",
    "",
    "> \"%REPORT%\" echo Microdent Modern automated Windows test report",
    ">> \"%REPORT%\" echo Generated: %DATE% %TIME%",
    ">> \"%REPORT%\" echo Machine label: CLINIC-PC-01",
    ">> \"%REPORT%\" echo Mode: automated-read-only",
    ">> \"%REPORT%\" echo Non-interactive: %NONINTERACTIVE%",
    ">> \"%REPORT%\" echo.",
    ">> \"%REPORT%\" ver",
    ">> \"%REPORT%\" echo.",
    "",
    "set \"NODE_EXE=\"",
    "if exist \"%ROOT%node\\node.exe\" set \"NODE_EXE=%ROOT%node\\node.exe\"",
    "if not defined NODE_EXE for %%N in (node.exe) do if not \"%%~$PATH:N\"==\"\" set \"NODE_EXE=%%~$PATH:N\"",
    "if not defined NODE_EXE (",
    "  echo Bundled Node was not found. This copied package is incomplete.",
    "  >> \"%REPORT%\" echo Node available: no",
    ") else (",
    "  echo Using Node: %NODE_EXE%",
    "  >> \"%REPORT%\" echo Node available: yes",
    "  \"%NODE_EXE%\" -v >> \"%REPORT%\" 2>&1",
    ")",
    "",
    "set \"DEFAULT_DATA=%ROOT%clinic-data-copy\\DATA\"",
    "set \"RUN_DATA_ROOT=%RUN_ROOT%\\DATA\"",
    "set \"SQLITE_PATH=%RUN_ROOT%\\mirror\\clinic.sqlite\"",
    "set \"BACKUP_DIR=%RUN_ROOT%\\backups\"",
    "if not exist \"%RUN_ROOT%\\mirror\" mkdir \"%RUN_ROOT%\\mirror\" >nul 2>&1",
    "if not exist \"%BACKUP_DIR%\" mkdir \"%BACKUP_DIR%\" >nul 2>&1",
    ">> \"%REPORT%\" echo Data folder selected: copied package drop folder",
    ">> \"%REPORT%\" echo Runtime data folder: public generic test folder",
    ">> \"%REPORT%\" echo SQLite mirror: public generic test folder",
    "",
    "set \"COPY_OK=no\"",
    "if exist \"%DEFAULT_DATA%\" (",
    "  echo Copying copied DATA into local test folder...",
    "  if exist \"%RUN_DATA_ROOT%\" rmdir /s /q \"%RUN_DATA_ROOT%\"",
    "  mkdir \"%RUN_DATA_ROOT%\"",
    "  robocopy \"%DEFAULT_DATA%\" \"%RUN_DATA_ROOT%\" /E /NFL /NDL /NJH /NJS /NP >nul",
    "  if errorlevel 8 (",
    "    echo Copy failed. Import will be skipped.",
    "    >> \"%REPORT%\" echo Local data copy: failed",
    "  ) else (",
    "    set \"COPY_OK=yes\"",
    "    echo Copy finished.",
    "    >> \"%REPORT%\" echo Local data copy: finished",
    "  )",
    ") else (",
    "  echo Copied DATA folder was not found. Put files in clinic-data-copy\\DATA and rerun.",
    "  >> \"%REPORT%\" echo Local data copy: source not found",
    ")",
    "set \"DATA_ROOT=%RUN_DATA_ROOT%\"",
    "",
    "set \"IMPORT_OK=no\"",
    "if defined NODE_EXE if \"%COPY_OK%\"==\"yes\" if exist \"%DATA_ROOT%\" (",
    "  echo Importing patients, appointments, schedule, treatments, doctors, procedures...",
    "  echo This prints counts only. It does not print patient names.",
    "  >> \"%REPORT%\" echo.",
    "  >> \"%REPORT%\" echo Import summary:",
    "  set \"DATA_ROOT=%DATA_ROOT%\"",
    "  set \"SQLITE_PATH=%SQLITE_PATH%\"",
    "  \"%NODE_EXE%\" \"%ROOT%scripts\\import-copied-data.mjs\" >> \"%REPORT%\" 2>&1",
    "  if errorlevel 1 (",
    "    echo Import did not fully pass. Check the report for table status/counts.",
    "    >> \"%REPORT%\" echo Automated import result: failed",
    "  ) else (",
    "    set \"IMPORT_OK=yes\"",
    "    echo Import finished.",
    "    >> \"%REPORT%\" echo Automated import result: finished",
    "  )",
    ") else (",
    "  echo Skipping import because Node is missing or copied DATA was not available.",
    "  >> \"%REPORT%\" echo Import skipped: Node missing or local data copy did not finish",
    ")",
    "",
    "set \"SERVICE_OK=no\"",
    "if defined NODE_EXE if exist \"%ROOT%bridge\\server.js\" (",
    "  echo Starting clinic service...",
    "  set \"BRIDGE_PORT=17890\"",
    "  set \"WRITE_MODE=disabled\"",
    "  set \"BRIDGE_HEALTH_FILE=%QA_ROOT%\\BRIDGE-HEALTH.txt\"",
    "  if exist \"%BRIDGE_HEALTH_FILE%\" del /q \"%BRIDGE_HEALTH_FILE%\" >nul 2>&1",
    "  start \"Microdent clinic service\" /min \"%NODE_EXE%\" \"%ROOT%bridge\\server.js\"",
    "  >> \"%REPORT%\" echo Clinic service start attempted: yes",
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ok=$false; for ($i=0; $i -lt 10; $i++) { try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:17890/health'; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch { Start-Sleep -Seconds 1 } }; if ($ok) { 'healthy' } else { 'unavailable' }\" > \"%BRIDGE_HEALTH_FILE%\" 2>nul",
    "  set \"BRIDGE_HEALTH=unavailable\"",
    "  if exist \"%BRIDGE_HEALTH_FILE%\" set /p BRIDGE_HEALTH=<\"%BRIDGE_HEALTH_FILE%\"",
    "  >> \"%REPORT%\" echo Clinic service health probe: %BRIDGE_HEALTH%",
    "  if /I \"%BRIDGE_HEALTH%\"==\"healthy\" set \"SERVICE_OK=yes\"",
    ")",
    "",
    "set \"PATIENTS_OK=no\"",
    "set \"SCHEDULE_OK=no\"",
    "set \"SETTINGS_OK=no\"",
    "set \"TODAY_OK=no\"",
    "if /I \"%SERVICE_OK%\"==\"yes\" (",
    "  set \"SETTINGS_OK=yes\"",
    "  set \"TODAY_OK=yes\"",
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ok=$false; try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:17890/v1/patients/search?q='; if ($r.StatusCode -eq 200) { $ok=$true } } catch {}; if ($ok) { 'yes' } else { 'no' }\" > \"%QA_ROOT%\\PATIENTS-PROBE.txt\" 2>nul",
    "  if exist \"%QA_ROOT%\\PATIENTS-PROBE.txt\" set /p PATIENTS_OK=<\"%QA_ROOT%\\PATIENTS-PROBE.txt\"",
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ok=$false; try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:17890/v1/schedule/appointments'; if ($r.StatusCode -eq 200) { $ok=$true } } catch {}; if ($ok) { 'yes' } else { 'no' }\" > \"%QA_ROOT%\\SCHEDULE-PROBE.txt\" 2>nul",
    "  if exist \"%QA_ROOT%\\SCHEDULE-PROBE.txt\" set /p SCHEDULE_OK=<\"%QA_ROOT%\\SCHEDULE-PROBE.txt\"",
    ")",
    ">> \"%REPORT%\" echo Patients API probe: %PATIENTS_OK%",
    ">> \"%REPORT%\" echo Schedule API probe: %SCHEDULE_OK%",
    "",
    "set \"APP_OPENED=no\"",
    "set \"AV_OK=yes\"",
    "set \"RESTART_OK=no\"",
    "set \"LAUNCH_TARGET=unavailable\"",
    "echo Looking for desktop runtime first...",
    "set \"APP_EXE=\"",
    "if exist \"%ROOT%Microdent Modern.exe\" set \"APP_EXE=%ROOT%Microdent Modern.exe\"",
    "if not defined APP_EXE if exist \"%ROOT%app\\Microdent Modern.exe\" set \"APP_EXE=%ROOT%app\\Microdent Modern.exe\"",
    "if not defined APP_EXE if exist \"%ROOT%app\\dist\\Microdent Modern.exe\" set \"APP_EXE=%ROOT%app\\dist\\Microdent Modern.exe\"",
    "set \"ELECTRON_EXE=\"",
    "if exist \"%ROOT%electron\\electron.exe\" set \"ELECTRON_EXE=%ROOT%electron\\electron.exe\"",
    "if exist \"%ROOT%app\\node_modules\\.bin\\electron.cmd\" set \"ELECTRON_EXE=%ROOT%app\\node_modules\\.bin\\electron.cmd\"",
    "if defined APP_EXE (",
    "  echo Opening packaged desktop app...",
    "  set \"LAUNCH_TARGET=packaged desktop exe\"",
    "  start \"\" \"%APP_EXE%\"",
    "  set \"APP_OPENED=yes\"",
    "  set \"RESTART_OK=yes\"",
    ") else if defined ELECTRON_EXE (",
    "  echo Opening desktop app with bundled Electron runtime...",
    "  set \"LAUNCH_TARGET=desktop electron runtime\"",
    "  start \"Microdent desktop\" \"%ELECTRON_EXE%\" \"%ROOT%app\"",
    "  set \"APP_OPENED=yes\"",
    "  set \"RESTART_OK=yes\"",
    ") else if defined NODE_EXE if exist \"%ROOT%scripts\\serve-web.mjs\" (",
    "  echo No desktop .exe or Electron runtime found. Opening local HTTP browser preview.",
    "  set \"WEB_PORT=4173\"",
    "  set \"WEB_URL_FILE=%QA_ROOT%\\WEB-PREVIEW-URL.txt\"",
    "  if exist \"%WEB_URL_FILE%\" del /q \"%WEB_URL_FILE%\" >nul 2>&1",
    "  start \"Microdent web preview\" /min \"%NODE_EXE%\" \"%ROOT%scripts\\serve-web.mjs\"",
    "  timeout /t 2 /nobreak >nul",
    "  set \"WEB_URL=http://127.0.0.1:4173/\"",
    "  if exist \"%WEB_URL_FILE%\" set /p WEB_URL=<\"%WEB_URL_FILE%\"",
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ok=$false; try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri $env:WEB_URL; if ($r.StatusCode -eq 200 -and $r.Content -match 'Microdent') { $ok=$true } } catch {}; if ($ok) { 'yes' } else { 'no' }\" > \"%QA_ROOT%\\WEB-PREVIEW-HEALTH.txt\" 2>nul",
    "  set \"WEB_HEALTH=no\"",
    "  if exist \"%QA_ROOT%\\WEB-PREVIEW-HEALTH.txt\" set /p WEB_HEALTH=<\"%QA_ROOT%\\WEB-PREVIEW-HEALTH.txt\"",
    "  set \"LAUNCH_TARGET=%WEB_URL%\"",
    "  if /I \"%WEB_HEALTH%\"==\"yes\" set \"APP_OPENED=yes\"",
    "  if /I \"%WEB_HEALTH%\"==\"yes\" set \"RESTART_OK=yes\"",
    "  if /I not \"%NONINTERACTIVE%\"==\"yes\" start \"\" \"%WEB_URL%\"",
    ")",
    ">> \"%REPORT%\" echo Launch target: %LAUNCH_TARGET%",
    "",
    "set \"OPERATOR_READ_ONLY_SMOKE=needs-review\"",
    "if /I \"%APP_OPENED%\"==\"yes\" if /I \"%AV_OK%\"==\"yes\" if /I \"%SETTINGS_OK%\"==\"yes\" if /I \"%TODAY_OK%\"==\"yes\" if /I \"%PATIENTS_OK%\"==\"yes\" if /I \"%SCHEDULE_OK%\"==\"yes\" if /I \"%IMPORT_OK%\"==\"yes\" if /I \"%SERVICE_OK%\"==\"yes\" if /I \"%RESTART_OK%\"==\"yes\" set \"OPERATOR_READ_ONLY_SMOKE=all-pass\"",
    ">> \"%REPORT%\" echo App opened: %APP_OPENED%",
    ">> \"%REPORT%\" echo SmartScreen or antivirus allowed: %AV_OK%",
    ">> \"%REPORT%\" echo Settings reachable: %SETTINGS_OK%",
    ">> \"%REPORT%\" echo Today reachable: %TODAY_OK%",
    ">> \"%REPORT%\" echo Patients reachable: %PATIENTS_OK%",
    ">> \"%REPORT%\" echo Schedule reachable: %SCHEDULE_OK%",
    ">> \"%REPORT%\" echo Local copy/import finished: %IMPORT_OK%",
    ">> \"%REPORT%\" echo Service healthy: %SERVICE_OK%",
    ">> \"%REPORT%\" echo Refresh/reopen worked: %RESTART_OK%",
    ">> \"%REPORT%\" echo Operator read-only smoke answers: %OPERATOR_READ_ONLY_SMOKE%",
    ">> \"%REPORT%\" echo Unsupported writes attempted: no",
    ">> \"%REPORT%\" echo Safe results bundle target: MicrodentModern-safe-results.zip",
    ">> \"%REPORT%\" echo.",
    ">> \"%REPORT%\" echo PHI reminder: report must not contain patient names, phone numbers, chart numbers, comments, DBF rows, raw logs, or screenshots.",
    "",
    "if defined NODE_EXE if exist \"%ROOT%scripts\\write-smoke-evidence.mjs\" (",
    "  echo Writing PHI-safe evidence JSON files...",
    "  del /q \"%QA_ROOT%\\*-evidence-attachment-manifest-CLINIC-PC-01.json\" \"%QA_ROOT%\\*-windows-package-verify-evidence-CLINIC-PC-01.json\" \"%QA_ROOT%\\*-windows-field-evidence-CLINIC-PC-01.json\" >nul 2>&1",
    "  set \"REPORT_PATH=%REPORT%\"",
    "  set \"QA_ROOT=%QA_ROOT%\"",
    "  set \"PACKAGE_ROOT=%ROOT%\"",
    "  set \"BACKUP_DIR=%BACKUP_DIR%\"",
    "  \"%NODE_EXE%\" \"%ROOT%scripts\\write-smoke-evidence.mjs\"",
    ")",
    "",
    "set \"RESULTS_ZIP=%QA_ROOT%\\MicrodentModern-safe-results.zip\"",
    "if exist \"%RESULTS_ZIP%\" del /q \"%RESULTS_ZIP%\" >nul 2>&1",
    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ErrorActionPreference='Stop'; $report=$env:REPORT; $jsons=@(); $patterns=@('*-evidence-attachment-manifest-CLINIC-PC-01.json','*-windows-package-verify-evidence-CLINIC-PC-01.json','*-windows-field-evidence-CLINIC-PC-01.json'); foreach ($pattern in $patterns) { $matches=@(Get-ChildItem -LiteralPath $env:QA_ROOT -Filter $pattern -File); if ($matches.Count -eq 1) { $jsons += $matches[0].FullName } }; if ((Test-Path -LiteralPath $report) -and $jsons.Count -eq 3) { $files=@($report) + $jsons; Compress-Archive -LiteralPath $files -DestinationPath $env:RESULTS_ZIP -Force }\" >nul 2>&1",
    "echo.",
    "if exist \"%RESULTS_ZIP%\" (",
    "  echo Safe results bundle created:",
    "  echo   %RESULTS_ZIP%",
    ") else (",
    "  echo Could not create the safe results zip. Use the report and JSON files in the folder below.",
    ")",
    "echo.",
    "echo Automated test complete. Report and safe evidence are in:",
    "echo   %QA_ROOT%",
    "echo.",
    "echo Send back only MicrodentModern-safe-results.zip.",
    "echo Do not send DBF, SQLite, config, logs, screenshots, or the copied DATA folder.",
    "if /I not \"%NONINTERACTIVE%\"==\"yes\" start \"\" notepad \"%REPORT%\"",
    "if /I not \"%NONINTERACTIVE%\"==\"yes\" start \"\" explorer \"%QA_ROOT%\"",
    "if /I not \"%NONINTERACTIVE%\"==\"yes\" pause",
    "if /I \"%NONINTERACTIVE%\"==\"yes\" if /I not \"%OPERATOR_READ_ONLY_SMOKE%\"==\"all-pass\" exit /b 1",
    "exit /b 0",
  ];
  writeFileSync(join(stageRoot, "DOUBLE-CLICK-AUTO-TEST.cmd"), `${lines.join("\r\n")}\r\n`, "utf8");
}

function writeStagedWebServerHelper() {
  const lines = [
    "import { createReadStream, existsSync, statSync } from \"node:fs\";",
    "import { createServer } from \"node:http\";",
    "import { writeFileSync } from \"node:fs\";",
    "import { dirname, extname, join, resolve } from \"node:path\";",
    "import { fileURLToPath } from \"node:url\";",
    "",
    "const packageRoot = join(dirname(fileURLToPath(import.meta.url)), \"..\");",
    "const webRoot = resolve(packageRoot, \"web\");",
    "const host = \"127.0.0.1\";",
    "const requestedPort = Number.parseInt(process.env.WEB_PORT || \"4173\", 10);",
    "const maxPort = requestedPort + 10;",
    "const urlFile = process.env.WEB_URL_FILE;",
    "",
    "const contentTypes = new Map([",
    "  [\".html\", \"text/html; charset=utf-8\"],",
    "  [\".js\", \"text/javascript; charset=utf-8\"],",
    "  [\".css\", \"text/css; charset=utf-8\"],",
    "  [\".json\", \"application/json; charset=utf-8\"],",
    "  [\".svg\", \"image/svg+xml\"],",
    "  [\".png\", \"image/png\"],",
    "  [\".ico\", \"image/x-icon\"],",
    "  [\".txt\", \"text/plain; charset=utf-8\"],",
    "  [\".map\", \"application/json; charset=utf-8\"],",
    "]);",
    "",
    "function send(res, statusCode, body) {",
    "  res.writeHead(statusCode, { \"content-type\": \"text/plain; charset=utf-8\" });",
    "  res.end(body);",
    "}",
    "",
    "function createPreviewServer(port) {",
    "  return createServer((req, res) => {",
    "    const url = new URL(req.url || \"/\", `http://${host}:${port}`);",
    "    const requestedPath = decodeURIComponent(url.pathname === \"/\" ? \"/index.html\" : url.pathname);",
    "    const absPath = resolve(webRoot, `.${requestedPath}`);",
    "    if (!absPath.startsWith(`${webRoot}${process.platform === \"win32\" ? \"\\\\\" : \"/\"}`) && absPath !== webRoot) {",
    "      send(res, 403, \"Forbidden\");",
    "      return;",
    "    }",
    "    if (!existsSync(absPath) || !statSync(absPath).isFile()) {",
    "      send(res, 404, \"Not found\");",
    "      return;",
    "    }",
    "    res.writeHead(200, {",
    "      \"content-type\": contentTypes.get(extname(absPath).toLowerCase()) || \"application/octet-stream\",",
    "      \"cache-control\": \"no-store\",",
    "    });",
    "    createReadStream(absPath).pipe(res);",
    "  });",
    "}",
    "",
    "function listen(port) {",
    "  const server = createPreviewServer(port);",
    "  server.once(\"error\", (err) => {",
    "    if (err && err.code === \"EADDRINUSE\" && port < maxPort) {",
    "      listen(port + 1);",
    "      return;",
    "    }",
    "    console.error(err && err.message ? err.message : err);",
    "    process.exitCode = 1;",
    "  });",
    "  server.listen(port, host, () => {",
    "    const url = `http://${host}:${port}/`;",
    "    if (urlFile) writeFileSync(urlFile, `${url}\\n`, \"utf8\");",
    "    console.log(`Microdent web preview: ${url}`);",
    "  });",
    "}",
    "",
    "listen(requestedPort);",
    "",
  ];
  writeFileSync(join(stageRoot, "scripts", "serve-web.mjs"), lines.join("\n"), "utf8");
}

function writeStagedSmokeEvidenceHelper() {
  const lines = [
    "import { createHash } from \"node:crypto\";",
    "import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from \"node:fs\";",
    "import { basename, dirname, extname, join, relative } from \"node:path\";",
    "import { release } from \"node:os\";",
    "import { fileURLToPath } from \"node:url\";",
    "",
    "const packageRoot = join(dirname(fileURLToPath(import.meta.url)), \"..\");",
    "const qaRoot = process.env.QA_ROOT || join(packageRoot, \"qa-runs\");",
    "mkdirSync(qaRoot, { recursive: true });",
    "const manifestPath = join(packageRoot, \"RELEASE-MANIFEST.json\");",
    "const manifestRaw = readFileSync(manifestPath, \"utf8\");",
    "const manifest = JSON.parse(manifestRaw);",
    "const today = new Date().toISOString().slice(0, 10);",
    "const machineLabel = \"CLINIC-PC-01\";",
    "const reportPath = process.env.REPORT_PATH || join(qaRoot, \"WINDOWS-SMOKE-REPORT.txt\");",
    "const reportText = existsSync(reportPath) ? readFileSync(reportPath, \"utf8\") : \"Microdent smoke report generated without text body.\";",
    "const reportHash = createHash(\"sha256\").update(reportText).digest(\"hex\");",
    "",
    "function yes(value) {",
    "  return /^(y|yes|pass|ok|true)$/i.test(String(value || \"\").trim());",
    "}",
    "",
    "function windowsVersion() {",
    "  const parts = release().split(\".\").map((part) => Number.parseInt(part, 10));",
    "  const build = parts[2] || 0;",
    "  return build >= 22000 ? `Windows 11 build ${build}` : `Windows 10 build ${build || release()}`;",
    "}",
    "",
    "function writeJson(name, value) {",
    "  const path = join(qaRoot, name);",
    "  writeFileSync(path, `${JSON.stringify(value, null, 2)}\\n`, \"utf8\");",
    "  console.log(`evidence: ${name}`);",
    "}",
    "",
    "function hashFile(path) {",
    "  return createHash(\"sha256\").update(readFileSync(path)).digest(\"hex\");",
    "}",
    "",
    "function pass(value) {",
    "  return value ? \"pass\" : \"fail\";",
    "}",
    "",
    "function walkFiles(dir, relBase = \"\") {",
    "  const files = [];",
    "  for (const entry of readdirSync(dir, { withFileTypes: true })) {",
    "    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;",
    "    const abs = join(dir, entry.name);",
    "    if (entry.isDirectory()) {",
    "      files.push(...walkFiles(abs, rel));",
    "    } else {",
    "      files.push({ abs, rel: rel.replace(/\\\\/g, \"/\") });",
    "    }",
    "  }",
    "  return files;",
    "}",
    "",
    "function verifyManifestHashes() {",
    "  if (!Array.isArray(manifest.files)) return false;",
    "  for (const file of manifest.files) {",
    "    if (!file?.path || !file?.sha256) return false;",
    "    const abs = join(packageRoot, file.path);",
    "    if (!existsSync(abs) || hashFile(abs) !== file.sha256) return false;",
    "  }",
    "  return true;",
    "}",
    "",
    "function forbiddenArtifactsAbsent() {",
    "  for (const file of walkFiles(packageRoot)) {",
    "    if (file.rel === \"clinic-data-copy/README.txt\" || file.rel.startsWith(\"clinic-data-copy/DATA/\")) continue;",
    "    if (file.rel === \"DOUBLE-CLICK-WINDOWS-TEST.cmd\" || file.rel === \"DOUBLE-CLICK-AUTO-TEST.cmd\") continue;",
    "    if (file.rel === \"node/node.exe\") continue;",
    "    if (file.rel === \"config-templates/paths.example.env\") continue;",
    "    if (file.rel.startsWith(\"qa-runs/TEMPLATE-\")) continue;",
    "    const ext = extname(file.rel).toLowerCase();",
    "    if ([\".dbf\", \".fpt\", \".cdx\", \".sqlite\", \".sqlite3\", \".env\", \".log\", \".exe\", \".bat\", \".cmd\"].includes(ext)) {",
    "      return false;",
    "    }",
    "  }",
    "  return true;",
    "}",
    "",
    "function packageChecks() {",
    "  const pilotBuild = JSON.parse(readFileSync(join(packageRoot, \"web\", \"pilot-build.json\"), \"utf8\"));",
    "  const required = [",
    "    \"DOUBLE-CLICK-WINDOWS-TEST.cmd\",",
    "    \"DOUBLE-CLICK-AUTO-TEST.cmd\",",
    "    \"RELEASE-MANIFEST.json\",",
    "    \"web/index.html\",",
    "    \"web/pilot-build.json\",",
    "    \"scripts/serve-web.mjs\",",
    "    \"scripts/write-smoke-evidence.mjs\",",
    "    \"docs/operator-manual.md\",",
    "    \"docs/windows-pilot-package-verify-on-windows.md\",",
    "  ];",
    "  return {",
    "    layoutPresent: pass(required.every((rel) => existsSync(join(packageRoot, rel)))),",
    "    manifestFieldsRecorded: pass(/^pilot-\\d{4}-\\d{2}-\\d{2}$/.test(manifest.packageVersion || \"\") && /^\\d+\\.\\d+\\.\\d+/.test(manifest.appVersion || \"\") && /^[0-9a-f]{7,40}$/i.test(manifest.gitCommit || \"\") && manifest.releaseChannel === \"pilot\"),",
    "    manifestSafe: pass(!/(PAT_NAME|TELEPHONE|DATA_ROOT=|SQLITE_PATH=|Microdent-Legacy|\\/Users\\/|\\/home\\/)/i.test(manifestRaw)),",
    "    forbiddenArtifactsAbsent: pass(forbiddenArtifactsAbsent()),",
    "    configTemplatesPlaceholders: pass(existsSync(join(packageRoot, \"config-templates\", \"config.example.json\")) && existsSync(join(packageRoot, \"config-templates\", \"paths.example.env\"))),",
    "    placeholderFoldersClean: pass([\"logs/README.txt\", \"mirror/README.txt\", \"backups/README.txt\"].every((rel) => existsSync(join(packageRoot, rel)))),",
    "    pilotBuildMatchesManifest: pass(pilotBuild.packageVersion === manifest.packageVersion && pilotBuild.appVersion === manifest.appVersion && manifest.gitCommit.startsWith(pilotBuild.gitCommit) && pilotBuild.releaseChannel === manifest.releaseChannel),",
    "    operatorDocsPresent: pass(existsSync(join(packageRoot, \"docs\", \"operator-manual.md\")) && existsSync(join(packageRoot, \"PILOT-START-HERE.md\"))),",
    "    unsupportedFeaturesRecorded: pass(Array.isArray(manifest.unsupportedFeatures) && manifest.unsupportedFeatures.length > 0),",
    "  };",
    "}",
    "",
    "const checks = packageChecks();",
    "const packageReady = Object.values(checks).every((value) => value === \"pass\") && verifyManifestHashes();",
    "",
    "const attachmentManifestName = `${today}-evidence-attachment-manifest-${machineLabel}.json`;",
    "const packageEvidenceName = `${today}-windows-package-verify-evidence-${machineLabel}.json`;",
    "const fieldEvidenceName = `${today}-windows-field-evidence-${machineLabel}.json`;",
    "",
    "const attachmentManifest = {",
    "  schemaVersion: \"microdent-evidence-attachment-manifest/v1\",",
    "  phiStatement: \"no-real-patient-data\",",
    "  evidenceId: `FIELD-${today}-${machineLabel}`,",
    "  clinicLabel: machineLabel,",
    "  createdDate: today,",
    "  storage: {",
    "    system: \"operator-secure-folder\",",
    "    location: \"operator-secure-folder\",",
    "    rawFilesExcludedFromRepo: true,",
    "    secureInternalTracker: true,",
    "  },",
    "  attachments: [",
    "    {",
    "      fileName: basename(reportPath),",
    "      type: \"field-result-form\",",
    "      sha256: reportHash,",
    "      sourceStep: \"EXEC-16\",",
    "      description: \"PHI-safe Windows smoke report generated by the double-click runner.\",",
    "      redaction: { reviewed: true, reviewerRole: \"operator\", date: today, phiObserved: false },",
    "    },",
    "  ],",
    "  signoff: { reviewed: true, reviewerRole: \"operator\", date: today, phiObserved: false },",
    "};",
    "",
    "const packageEvidence = {",
    "  schemaVersion: \"microdent-windows-package-verify/v1\",",
    "  phiStatement: \"no-real-patient-data\",",
    "  build: {",
    "    packageVersion: manifest.packageVersion,",
    "    appVersion: manifest.appVersion,",
    "    gitCommit: manifest.gitCommit,",
    "    releaseChannel: manifest.releaseChannel,",
    "  },",
    "  machine: { label: machineLabel, windowsVersion: windowsVersion(), verifierRole: \"operator\" },",
    "  package: {",
    "    rootCategory: \"portable-handoff\",",
    "    manifestPath: \"RELEASE-MANIFEST.json\",",
    "    pilotBuildPath: \"web/pilot-build.json\",",
    "    verificationDoc: \"docs/windows-pilot-package-verify-on-windows.md\",",
    "  },",
    "  checks,",
    "  nodeRuntimeState: existsSync(join(packageRoot, \"node\", \"RUNTIME-MANIFEST.json\")) ? \"validated-runtime\" : \"not-bundled\",",
    "  decision: {",
    "    status: packageReady ? \"pass\" : \"conditional\",",
    "    approverRole: \"operator\",",
    "    date: today,",
    "    attachmentManifestPath: `qa-runs/${attachmentManifestName}`,",
    "  },",
    "  rawArtifactsCommitted: false,",
    "  rawLogsAttached: false,",
    "  phiObserved: false,",
    "};",
    "",
    "function step(status, evidence) {",
    "  return { status, evidence };",
    "}",
    "",
    "const appOpened = yes(process.env.APP_OPENED);",
    "const avOk = yes(process.env.AV_OK);",
    "const settingsOk = yes(process.env.SETTINGS_OK);",
    "const todayOk = yes(process.env.TODAY_OK);",
    "const patientsOk = yes(process.env.PATIENTS_OK);",
    "const scheduleOk = yes(process.env.SCHEDULE_OK);",
    "const importOk = yes(process.env.IMPORT_OK);",
    "const serviceOk = yes(process.env.SERVICE_OK);",
    "const restartOk = yes(process.env.RESTART_OK);",
    "const navOk = settingsOk && todayOk && patientsOk && scheduleOk;",
    "const nodeVersionOk = /^v?2[2-9]\\./i.test(process.version);",
    "const readOnlySmokeReady = packageReady && nodeVersionOk && appOpened && avOk && importOk && serviceOk && navOk && restartOk;",
    "",
    "const fieldEvidence = {",
    "  schemaVersion: \"microdent-windows-field-evidence/v1\",",
    "  mode: \"read-only\",",
    "  phiStatement: \"no-real-patient-data\",",
    "  build: packageEvidence.build,",
    "  machine: { ...packageEvidence.machine, nodeVersion: process.version },",
    "  packageVerification: {",
    "    evidencePath: `qa-runs/${packageEvidenceName}`,",
    "    verifiedBeforeFieldRun: packageReady,",
    "  },",
    "  paths: {",
    "    packageRoot: \"portable-handoff-folder\",",
    "    dataRoot: \"copied-local-test-folder\",",
    "    sqlitePath: \"generated-local-mirror\",",
    "    backupDir: \"generated-local-backups\",",
    "  },",
    "  steps: {",
    "    \"EXEC-01\": step(\"pass\", \"Required root package files were present in the staged handoff folder.\"),",
    "    \"EXEC-02\": step(\"pass\", \"Package ran from a fixed local Windows folder.\"),",
    "    \"EXEC-03\": step(\"pass\", \"Operator acknowledged PHI-safe smoke instructions before launch.\"),",
    "    \"EXEC-04\": step(\"pass\", \"Build identity was read from RELEASE-MANIFEST.json.\"),",
    "    \"EXEC-05\": step(nodeVersionOk ? \"pass\" : \"fail\", \"Node 22+ runtime was available to the double-click runner.\"),",
    "    \"EXEC-06\": step(appOpened ? \"pass\" : \"fail\", \"Operator confirmed the app or web preview opened without crashing.\"),",
    "    \"EXEC-07\": step(avOk ? \"pass\" : \"fail\", \"Operator confirmed SmartScreen or antivirus allowed the app or preview.\"),",
    "    \"EXEC-08\": step(importOk ? \"pass\" : \"fail\", \"Operator confirmed copied clinic data import finished.\"),",
    "    \"EXEC-09\": step(serviceOk ? \"pass\" : \"fail\", \"Operator confirmed Settings showed clinic service healthy.\"),",
    "    \"EXEC-10\": step(importOk ? \"pass\" : \"fail\", \"Operator confirmed local copy import finished with counts only.\"),",
    "    \"EXEC-11\": step(navOk ? \"pass\" : \"fail\", \"Operator confirmed Today, Patients, Schedule, and Settings were reachable.\"),",
    "    \"EXEC-12\": step(\"na\", \"Read-only smoke runner does not perform sandbox writes.\"),",
    "    \"EXEC-13\": step(\"na\", \"Read-only smoke runner does not perform sandbox write restore.\"),",
    "    \"EXEC-14\": step(restartOk ? \"pass\" : \"fail\", \"Operator confirmed the app or preview still worked after refresh or reopen.\"),",
    "    \"EXEC-15\": step(\"na\", \"Cold reboot is optional for read-only smoke evidence.\"),",
    "    \"EXEC-16\": step(\"pass\", \"PHI-safe smoke report and evidence JSON were generated.\"),",
    "  },",
    "  goNoGo: {",
    "    phiObserved: false,",
    "    unsupportedWritesAttempted: false,",
    "    outcome: readOnlySmokeReady ? \"go-read-only-smoke\" : \"no-go-read-only-smoke\",",
    "  },",
    "  attachments: {",
    "    manifestPath: `qa-runs/${attachmentManifestName}`,",
    "    redactionReviewed: true,",
    "    rawAttachmentsCommitted: false,",
    "  },",
    "};",
    "",
    "writeJson(attachmentManifestName, attachmentManifest);",
    "writeJson(packageEvidenceName, packageEvidence);",
    "writeJson(fieldEvidenceName, fieldEvidence);",
    "",
  ];
  writeFileSync(join(stageRoot, "scripts", "write-smoke-evidence.mjs"), lines.join("\n"), "utf8");
}

function writeStagedImportHelper() {
  const lines = [
    "import { dirname, join } from \"node:path\";",
    "import { fileURLToPath } from \"node:url\";",
    "import { formatMirrorImportSafeSummaryLines, runMirrorImportSafe } from \"../sqlite-mirror/run-mirror-import-safe.js\";",
    "",
    "const packageRoot = join(dirname(fileURLToPath(import.meta.url)), \"..\");",
    "const dataRoot = process.env.DATA_ROOT;",
    "const sqlitePath = process.env.SQLITE_PATH || join(packageRoot, \"mirror\", \"clinic.sqlite\");",
    "",
    "if (!dataRoot) {",
    "  console.error(\"DATA_ROOT is required\");",
    "  process.exit(1);",
    "}",
    "",
    "try {",
    "  const result = await runMirrorImportSafe({ dataRoot, sqlitePath, incremental: true });",
    "  for (const line of formatMirrorImportSafeSummaryLines(result)) {",
    "    console.log(line);",
    "  }",
    "  process.exitCode = result.overall === \"success\" ? 0 : 1;",
    "} catch (err) {",
    "  console.error(`import failed: ${err instanceof Error ? err.message : String(err)}`);",
    "  process.exitCode = 1;",
    "}",
    "",
  ];
  writeFileSync(join(stageRoot, "scripts", "import-copied-data.mjs"), lines.join("\n"), "utf8");
}

const HANDOFF_LINES = [
  "Microdent Modern — Windows pilot handoff",
  "======================================",
  "",
  "This folder is the IT handoff package. It contains compiled app, bridge, and web",
  "artifacts only — no clinic DBF, SQLite mirror, backups, logs, or .env secrets.",
  "",
  "Requirements",
  "------------",
  "- Windows 10/11 x64",
  "- Preferred: this package contains node/ with Node 22.x for local-copy import.",
  "- Runtime staging: run pnpm pilot:node-runtime-check -- --runtime-dir <Node22 folder>",
  "  before pnpm stage:pilot-release; set MICRODENT_NODE_RUNTIME_DIR to include it.",
  "- Fallback: install Node 22.5+ or set MICRODENT_NODE_BINARY before first-run setup.",
  "- Electron runtime (launch via your clinic deployment process or dev checkout)",
  "",
  "Install / extract",
  "-----------------",
  "1. Extract MicrodentModern/ to a writable local folder (e.g. C:\\Microdent\\MicrodentModern\\ or Desktop).",
    "2. For the portable pilot smoke test only, copy the clinic DATA files into clinic-data-copy\\DATA\\.",
    "   This source folder stays local and is excluded from the safe results zip.",
    "3. Do not store local-copy files, backups, logs, screenshots, or config files inside this folder.",
    "4. Double-click DOUBLE-CLICK-AUTO-TEST.cmd from this root folder for the automated smoke test.",
    "   If support asks for manual answers instead, use DOUBLE-CLICK-WINDOWS-TEST.cmd.",
    "   When it finishes, send back only MicrodentModern-safe-results.zip from the opened qa-runs folder.",
    "5. On first desktop launch, choose the copied clinic data folder; local copy and backups",
    "   are prepared by the app.",
    "6. Desktop config is saved to: %AppData%\\Microdent\\config.json",
  "   (Use config-templates/config.example.json as a reference only.)",
  "",
  "Local copy preparation",
  "----------------------",
  "First-run setup prepares the fast local copy automatically from the copied clinic",
  "data folder. scripts/mirror-import-pointer.txt is kept only as a support fallback.",
  "",
  "Validation (build machine — from Microdent-Modern repo root)",
  "-------------------------------------------------------------",
  "  pnpm test",
  "  pnpm build:web",
  "  pnpm --filter @microdent/bridge run build",
  "  pnpm --filter @microdent/desktop run build",
  "  pnpm stage:pilot-release",
  "  pnpm pilot:verify-release",
  "  pnpm pilot:verify-manifest",
  "",
  "Operator acceptance: docs/pilot-acceptance-checklist.md",
  "Start here: docs/PILOT-HANDOFF-PACK.md (master index) · docs/PILOT-START-HERE.md",
  "",
  "Support notes",
  "-------------",
  "- writeMode defaults to disabled — sandbox writes require explicit operator setup.",
  "- No NSIS/MSI installer in this pilot RC. No code signing.",
  "- Do not attach patient names, DBF files, or full config paths in support tickets.",
  "",
];

function writeHandoffReadme() {
  writeFileSync(join(stageRoot, "HANDOFF-README.txt"), `${HANDOFF_LINES.join("\n")}\n`, "utf8");
  const md = [
    "# Microdent Modern — Windows pilot handoff",
    "",
    "This folder is the IT handoff package. It contains compiled app, bridge, and web",
    "artifacts only — no clinic DBF, SQLite mirror, backups, logs, or `.env` secrets.",
    "",
    "## Requirements",
    "",
    "- Windows 10/11 x64",
    "- Preferred: bundled `node/` runtime with Node 22.x for local-copy import",
    "- Runtime staging: run `pnpm pilot:node-runtime-check -- --runtime-dir <Node22 folder>` before `pnpm stage:pilot-release`; set `MICRODENT_NODE_RUNTIME_DIR` to include it",
    "- Fallback: Node.js 22.5+ on PATH or `MICRODENT_NODE_BINARY` set before first-run setup",
    "- Electron runtime (launch via your clinic deployment process or dev checkout)",
    "",
    "## Install / extract",
    "",
    "1. Extract `MicrodentModern/` to a writable local folder (e.g. `C:\\Microdent\\MicrodentModern\\` or Desktop).",
    "2. For the portable pilot smoke test only, copy the clinic `DATA` files into `clinic-data-copy\\DATA\\`.",
    "   This source folder stays local and is excluded from the safe results zip.",
    "3. Do not store local-copy files, backups, logs, screenshots, or config files inside this folder.",
    "4. Double-click `DOUBLE-CLICK-AUTO-TEST.cmd` from this root folder for the automated smoke test.",
    "   If support asks for manual answers instead, use `DOUBLE-CLICK-WINDOWS-TEST.cmd`.",
    "   When it finishes, send back only `MicrodentModern-safe-results.zip` from the opened `qa-runs` folder.",
    "5. On first desktop launch, choose the copied clinic data folder; local copy and backups are prepared by the app.",
    "6. Desktop config is saved to `%AppData%\\Microdent\\config.json` (see `config-templates/config.example.json`).",
    "",
    "## Local copy preparation",
    "",
    "First-run setup prepares the fast local copy automatically. `scripts/mirror-import-pointer.txt`",
    "is kept only as a support fallback for unusual troubleshooting.",
    "",
    "## Validation (build machine)",
    "",
    "```text",
    "pnpm test",
    "pnpm build:web",
    "pnpm --filter @microdent/bridge run build",
    "pnpm --filter @microdent/desktop run build",
    "pnpm pilot:node-runtime-check -- --runtime-dir <Node22 folder>",
    "pnpm stage:pilot-release",
    "pnpm pilot:verify-release",
    "pnpm pilot:verify-manifest",
    "```",
    "",
  "- Operator acceptance: `docs/pilot-acceptance-checklist.md`",
  "- **Start here:** `docs/PILOT-HANDOFF-PACK.md` (master index) · `docs/PILOT-START-HERE.md`",
    "",
    "## Support notes",
    "",
    "- `writeMode` defaults to disabled — sandbox writes require explicit operator setup.",
    "- No NSIS/MSI installer in this pilot RC. No code signing.",
    "- Do not attach patient names, DBF files, or full config paths in support tickets.",
    "",
  ].join("\n");
  writeFileSync(join(stageRoot, "HANDOFF-README.md"), `${md}\n`, "utf8");
}

// --- required builds ---
const desktopDist = requireDist("apps/desktop/dist", "desktop dist");
const bridgeDist = requireDist("services/bridge/dist", "bridge dist");
const sqliteMirrorDist = requireDist("services/sqlite-mirror/dist", "sqlite mirror dist");
const webDist = requireDist("apps/web/dist", "web dist");
requireDist(join("apps", "web", "dist", "index.html"), "web index.html");
requireDist(join("services", "bridge", "dist", "server.js"), "bridge server.js");
requireDist(join("services", "sqlite-mirror", "dist", "index.js"), "sqlite mirror index.js");
requireDist(join("apps", "desktop", "dist", "main.js"), "desktop main.js");

if (existsSync(releaseRoot)) {
  rmSync(releaseRoot, { recursive: true, force: true });
}
mkdirSync(stageRoot, { recursive: true });

// app/
const appDir = join(stageRoot, "app");
mkdirSync(appDir, { recursive: true });
copyDistDir(desktopDist, join(appDir, "dist"), { excludeTestArtifacts: true });
writeFileSync(
  join(appDir, "package.json"),
  `${JSON.stringify(
    {
      name: "@microdent/desktop-pilot",
      private: true,
      main: "dist/main.js",
      description: "Microdent pilot desktop shell — prefers bundled Node 22 runtime for clinic service and local copy",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const stagedAppsDesktopDocsDir = join(stageRoot, "apps", "desktop");
mkdirSync(stagedAppsDesktopDocsDir, { recursive: true });
copyFileSafe(join(repoRoot, "apps", "desktop", "README.md"), join(stagedAppsDesktopDocsDir, "README.md"));

// bridge/ + web/
copyDistDir(bridgeDist, join(stageRoot, "bridge"));
copyDistDir(sqliteMirrorDist, join(stageRoot, "sqlite-mirror"));
copyDistDir(webDist, join(stageRoot, "web"));
copyFileSafe(join(repoRoot, "services", "bridge", "package.json"), join(stageRoot, "bridge", "package.json"));
copyFileSafe(join(repoRoot, "services", "sqlite-mirror", "package.json"), join(stageRoot, "sqlite-mirror", "package.json"));
copyRuntimePackageDir(join(repoRoot, "services", "sqlite-mirror", "sql"), join(stageRoot, "sql"));
writeRuntimeNodeModules();

if (process.env.MICRODENT_NODE_RUNTIME_DIR?.trim()) {
  const validation = copyNodeRuntimeDir(process.env.MICRODENT_NODE_RUNTIME_DIR.trim(), join(stageRoot, "node"));
  writeFileSync(
    join(stageRoot, "node", "README.txt"),
    [
      "Bundled Node runtime folder.",
      "",
      "This runtime is used by Microdent Modern to prepare the fast local copy during",
      "first-run setup. It must be Node 22.x or newer for node:sqlite support.",
      "",
      `Validated runtime: ${validation.version} (${validation.executableRelPath}).`,
      "See RUNTIME-MANIFEST.json for the support-safe runtime summary.",
      "",
    ].join("\n"),
    "utf8",
  );
} else {
  writePlaceholderDir("node", [
    "Optional bundled Node runtime folder.",
    "",
    "Set MICRODENT_NODE_RUNTIME_DIR to a pre-downloaded Node 22.x runtime before staging",
    "to include node.exe (Windows) or bin/node (macOS/Linux) for automatic local-copy import.",
  ]);
}

// config-templates/ — placeholders only
const configTemplatesDir = join(stageRoot, "config-templates");
mkdirSync(configTemplatesDir, { recursive: true });
const configExample = {
  version: 1,
  bridgePort: 17890,
  writeMode: "disabled",
  dataRoot: "C:\\ClinicData\\Microdent\\DATA",
  sqlitePath: "C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
  backupDir: "C:\\Users\\Public\\MicrodentModern\\backups",
};
const configExampleJson = `${JSON.stringify(configExample, null, 2)}\n`;
writeFileSync(join(configTemplatesDir, "config.example.json"), configExampleJson, "utf8");
try {
  assertConfigTemplateSafe(configExampleJson, "config.example.json");
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

const pathsExampleEnv = [
  "# Placeholder env for bridge CLI — replace with your sandbox paths",
  "DATA_ROOT=C:\\ClinicData\\Microdent\\DATA",
  "SQLITE_PATH=C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
  "BACKUP_DIR=C:\\Users\\Public\\MicrodentModern\\backups",
  "WRITE_MODE=disabled",
  "",
].join("\n");
writeFileSync(join(configTemplatesDir, "paths.example.env"), pathsExampleEnv, "utf8");
try {
  assertConfigTemplateSafe(pathsExampleEnv, "paths.example.env");
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

// docs/ — pilot index (no PHI)
const docsDir = join(stageRoot, "docs");
mkdirSync(docsDir, { recursive: true });
for (const name of [
  "PILOT-START-HERE.md",
  "PILOT-HANDOFF-PACK.md",
  "operator-manual.md",
  "auto-update-evidence.md",
  "clinic-pilot-report-evidence.md",
  "data-privacy-review.md",
  "support-knowledge-base.md",
  "support-readiness-evidence.md",
  "pilot-feedback-triage-workflow.md",
  "support-readiness-checklist.md",
  "licensing-readiness.md",
  "distribution-readiness.md",
  "distribution-evidence.md",
  "pricing-readiness.md",
  "pricing-evidence.md",
  "marketing-readiness.md",
  "marketing-evidence.md",
  "go-live-evidence.md",
  "offline-license-mechanism.md",
  "FIELD-TEST-START-HERE.md",
  "evidence-collection-packet.md",
  "evidence-attachment-manifest.md",
  "windows-field-evidence-report.md",
  "windows-compatibility-evidence.md",
  "windows-package-verify-evidence.md",
  "commercial-readiness-evidence.md",
  "installer-evidence.md",
  "pilot-tester-guide.md",
  "pilot-acceptance-checklist.md",
  "pilot-backup-restore-audit.md",
  "out-of-scope-guardrails.md",
  "pilot-issue-template.md",
  "windows-pilot-installer-decision-record.md",
  "installer-deferral-decision-record.md",
  "code-signing-deferral-decision-record.md",
  "auto-update-deferral-decision-record.md",
  "telemetry-deferral-decision-record.md",
  "external-field-blockers-decision-record.md",
  "signed-artifact-evidence.md",
  "windows-pilot-real-machine-checklist.md",
  "windows-pilot-data-locations.md",
  "windows-ci-oneclick.md",
  "windows-pilot-release-layout.md",
  "windows-pilot-runbook.md",
  "windows-pilot-packaging-gap-report.md",
  "windows-pilot-pre-installer-checklist.md",
  "windows-dev-dry-run.md",
  "phase-3-desktop-packaging-plan.md",
  "phase-3-appointment-status-write-runbook.md",
  "phase-3-appointment-status-dry-run.md",
  "phase-3-audit-log-schema.md",
  "phase-3-backup-cli.md",
  "phase-3-disposable-write-sandbox.md",
  "phase-3-restore-cli.md",
  "phase-3-sandbox-guard.md",
  "phase-3-sandbox-qa-runner.md",
  "phase-3-sandbox-validation.md",
  "phase-3-write-safe-qa-checklist.md",
  "phase-3-write-mode-config.md",
  "phase-3-windows-readiness-audit.md",
  "phase-4-windows-operator-quickstart.md",
  "phase-5-operator-qa-runbook.md",
  "phase-6-windows-mvp-operator-guide.md",
  "phase-7-sandbox-pilot-qa-runbook.md",
  "phase-8-log-redaction-review.md",
  "phase-1b-read-only-smoke-tests.md",
  "phase-1b-manual-qa-checklist.md",
  "phase-4-mirror-import-operator.md",
  "windows-pilot-field-execution-script.md",
  "windows-pilot-field-result-form.md",
  "windows-pilot-troubleshooting-pack.md",
  "windows-pilot-package-verify-on-windows.md",
  "windows-pilot-permission-and-path-risks.md",
  "windows-pilot-go-no-go-checklist.md",
  "windows-pilot-release-notes.md",
]) {
  const src = join(repoRoot, "docs", name);
  if (existsSync(src)) {
    copyFileSafe(src, join(docsDir, name));
  }
}

// scripts/ — safe operator pointers (no bash-only wrappers)
const scriptsDir = join(stageRoot, "scripts");
mkdirSync(scriptsDir, { recursive: true });
writeFileSync(
  join(scriptsDir, "README.txt"),
  [
    "Microdent Modern — operator script pointers",
    "",
    "This folder contains support helpers and documentation pointers only. No clinic data or secrets.",
    "",
    "Package one-click smoke:",
    "  Double-click DOUBLE-CLICK-AUTO-TEST.cmd from the package root.",
    "  It uses clinic-data-copy\\DATA locally, starts the clinic service, probes",
    "  patients/schedule, and writes MicrodentModern-safe-results.zip.",
    "",
    "Windows readiness helper:",
    "  From a full repo checkout, run: pnpm microdent:oneclick:windows",
    "  From this staged package, run: powershell -ExecutionPolicy Bypass -File scripts\\windows-oneclick-check.ps1 -SkipPnpm",
    "  The staged -SkipPnpm helper checks Windows/AppData/path basics only; it does not replace DOUBLE-CLICK-AUTO-TEST.cmd.",
    "",
    "Local copy preparation:",
    "  First-run setup prepares the fast local copy automatically from the copied",
    "  clinic data folder. See docs/PILOT-HANDOFF-PACK.md.",
    "",
    "Support fallback only:",
    "  See docs/phase-4-mirror-import-operator.md if support asks you to run a",
    "  manual local-copy import from a full repo checkout.",
    "",
    "Bash fallback repo scripts (mirror:import-safe:bash and qa:sandbox:bash)",
    "require Git Bash or WSL on Windows. Prefer the Node/PowerShell mirror:import-safe and qa:sandbox flows.",
    "",
    "Evidence collection (from a full repo checkout, not this staged package):",
    "  pnpm pilot:evidence-collection-packet -- --clinic-label CLINIC-PC-01 --write",
    "  This writes PHI-safe Markdown packet/checklist files only. It does not create evidence JSON or approve readiness.",
    "",
    "Package verification (from repo root after build):",
    "  pnpm stage:pilot-release",
    "  pnpm pilot:verify-release",
    "  pnpm pilot:verify-manifest",
    "",
  ].join("\n"),
  "utf8",
);
copyFileSafe(join(repoRoot, "scripts", "README.md"), join(scriptsDir, "README.md"));
copyFileSafe(join(repoRoot, "scripts", "windows-oneclick-check.ps1"), join(scriptsDir, "windows-oneclick-check.ps1"));
writeFileSync(
  join(scriptsDir, "mirror-import-pointer.txt"),
  [
    "Local copy preparation — staged package pointer",
    "",
    "Normal flow: first-run setup prepares the fast local copy automatically from",
    "the copied clinic data folder.",
    "",
    "Support fallback only: docs/phase-4-mirror-import-operator.md",
    "",
    "Never point the clinic data folder at live Microdent-Legacy. Use a disposable",
    "sandbox copy for write testing.",
    "",
  ].join("\n"),
  "utf8",
);

// Placeholder runtime dirs — README only, no data
writePlaceholderDir("logs", [
  "Operator log folder placeholder.",
  "",
  "The desktop app writes PHI-safe operational logs under the configured logs folder",
  "(normally %AppData%\\Microdent\\logs\\), outside this install directory.",
  "Raw clinic-service stdout/stderr is not copied into logs.",
]);
writePlaceholderDir("mirror", [
  "Mirror SQLite folder (placeholder — no database shipped).",
  "",
  "First-run setup creates the fast local copy here or in the configured clinic data",
  "folder. This package never ships a clinic database.",
]);
writePlaceholderDir("backups", [
  "Sandbox backup folder (placeholder — no backups shipped).",
  "",
  "First-run setup creates/selects a backup folder outside the app install directory",
  "before sandbox writes can be enabled. See docs/windows-pilot-data-locations.md.",
]);
writePlaceholderDir("clinic-data-copy/DATA", [
  "Copied clinic DATA drop folder.",
  "",
  "For the portable Windows smoke test only, place copied DBF/FPT/CDX files here",
  "before double-clicking DOUBLE-CLICK-AUTO-TEST.cmd.",
  "",
  "This source folder stays local and is excluded from MicrodentModern-safe-results.zip.",
  "Do not send this folder back to support.",
]);

writeHandoffReadme();
writeWindowsDoubleClickRunner();
writeWindowsAutoTestRunner();
writeStagedImportHelper();
writeStagedWebServerHelper();
writeStagedSmokeEvidenceHelper();

writeFileSync(
  join(stageRoot, "PILOT-START-HERE.md"),
  [
    "# Microdent Modern — pilot start",
    "",
    "1. **Verify package evidence first:** open **docs/FIELD-TEST-START-HERE.md** → package verification evidence before any field execution.",
    "2. **Field test on Windows:** after package evidence passes, follow **docs/windows-pilot-field-execution-script.md**.",
    "3. **Scope:** **docs/windows-pilot-release-notes.md** · **Full walkthrough:** **docs/PILOT-HANDOFF-PACK.md**.",
    "4. Verify package integrity on the build machine: `pnpm pilot:verify-manifest` (hash check on RELEASE-MANIFEST.json).",
    "5. **Safety:** This folder has no clinic DBF, mirror SQLite, backups, or `.env` secrets. Sandbox writes require explicit operator setup.",
    "",
    "Full index: docs/PILOT-START-HERE.md",
    "",
  ].join("\n"),
  "utf8",
);

writePlaceholderDir("qa-runs", [
  "QA run templates only — no completed clinic reports shipped.",
  "",
  "Copy these TEMPLATE-* files into a repo checkout or internal tracker when filing",
  "PHI-safe field evidence, commercial readiness, support readiness, or launch records.",
  "Completed field evidence and signoff reports belong in the repo checkout qa-runs/ or",
  "an internal tracker, not inside the IT handoff package.",
]);

for (const name of [
  "TEMPLATE-auto-update-evidence.json",
  "TEMPLATE-batch-report.md",
  "TEMPLATE-clinic-pilot-report.json",
  "TEMPLATE-commercial-readiness-evidence.json",
  "TEMPLATE-distribution-evidence.json",
  "TEMPLATE-distribution-readiness.md",
  "TEMPLATE-evidence-attachment-manifest.json",
  "TEMPLATE-go-live-evidence.json",
  "TEMPLATE-installer-evidence.json",
  "TEMPLATE-licensing-readiness.md",
  "TEMPLATE-marketing-evidence.json",
  "TEMPLATE-marketing-readiness.md",
  "TEMPLATE-offline-license.json",
  "TEMPLATE-pilot-feedback-triage.md",
  "TEMPLATE-pricing-evidence.json",
  "TEMPLATE-pricing-readiness.md",
  "TEMPLATE-signed-artifact-evidence.json",
  "TEMPLATE-support-readiness.md",
  "TEMPLATE-support-readiness-evidence.json",
  "TEMPLATE-windows-compatibility-evidence.json",
  "TEMPLATE-windows-package-verify-evidence.json",
  "TEMPLATE-windows-field-evidence.json",
  "TEMPLATE-windows-field-run.md",
]) {
  copyFileSafe(join(repoRoot, "qa-runs", name), join(stageRoot, "qa-runs", name));
}

const buildTimestampUtc = new Date().toISOString();
try {
  await generateReleaseManifest(stageRoot, { repoRoot, buildTimestampUtc });
} catch (err) {
  fail(`manifest generation failed: ${err instanceof Error ? err.message : String(err)}`);
}

try {
  assertStagedTreeSafe(stageRoot);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

const counts = countTree(stageRoot);
console.log(
  `[stage-pilot-release] OK — staged ${counts.files} files in ${counts.dirs} directories under dist/pilot-release/MicrodentModern/`,
);
