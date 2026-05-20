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

function copyFileSafe(src, dest) {
  try {
    assertSafeSourcePath(src, repoRoot);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function writePlaceholderDir(dirName, lines) {
  const dir = join(stageRoot, dirName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "README.txt"), `${lines.join("\n")}\n`, "utf8");
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
  "- Node.js 22.x on PATH (node.exe — not bundled in this package)",
  "- Electron runtime (launch via your clinic deployment process or dev checkout)",
  "",
  "Install / extract",
  "-----------------",
  "1. Copy MicrodentModern/ to an install location (e.g. C:\\Program Files\\MicrodentModern\\).",
  "2. Do not store DATA_ROOT, mirror SQLite, backups, or logs inside this folder.",
  "3. On first desktop launch, complete setup for DATA_ROOT, SQLITE_PATH, and BACKUP_DIR.",
  "4. Desktop config is saved to: %AppData%\\Microdent\\config.json",
  "   (Use config-templates/config.example.json as a reference only.)",
  "",
  "Mirror import",
  "-------------",
  "Mirror import is CLI-only. See scripts/mirror-import-pointer.txt and",
  "docs/phase-4-mirror-import-operator.md. Use disposable sandbox DATA only.",
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
    "- Node.js 22.x on PATH (`node.exe` — not bundled in this package)",
    "- Electron runtime (launch via your clinic deployment process or dev checkout)",
    "",
    "## Install / extract",
    "",
    "1. Copy `MicrodentModern/` to an install location (e.g. `C:\\Program Files\\MicrodentModern\\`).",
    "2. Do not store DATA_ROOT, mirror SQLite, backups, or logs inside this folder.",
    "3. On first desktop launch, complete setup for DATA_ROOT, SQLITE_PATH, and BACKUP_DIR.",
    "4. Desktop config is saved to `%AppData%\\Microdent\\config.json` (see `config-templates/config.example.json`).",
    "",
    "## Mirror import",
    "",
    "CLI-only — see `scripts/mirror-import-pointer.txt` and `docs/phase-4-mirror-import-operator.md`.",
    "Use disposable sandbox DATA only.",
    "",
    "## Validation (build machine)",
    "",
    "```text",
    "pnpm test",
    "pnpm build:web",
    "pnpm --filter @microdent/bridge run build",
    "pnpm --filter @microdent/desktop run build",
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
const webDist = requireDist("apps/web/dist", "web dist");
requireDist(join("apps", "web", "dist", "index.html"), "web index.html");
requireDist(join("services", "bridge", "dist", "server.js"), "bridge server.js");
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
      description: "Microdent pilot desktop shell — run with Electron + system Node 22",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

// bridge/ + web/
copyDistDir(bridgeDist, join(stageRoot, "bridge"));
copyDistDir(webDist, join(stageRoot, "web"));

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
  "pilot-tester-guide.md",
  "pilot-acceptance-checklist.md",
  "pilot-backup-restore-audit.md",
  "out-of-scope-guardrails.md",
  "windows-pilot-real-machine-checklist.md",
  "windows-pilot-data-locations.md",
  "windows-pilot-release-layout.md",
  "phase-4-mirror-import-operator.md",
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
    "This folder contains documentation pointers only. No clinic data or secrets.",
    "",
    "Mirror import (Windows PowerShell — from a full repo checkout with Node 22):",
    "  See docs/phase-4-mirror-import-operator.md in this package.",
    "  Example:",
    "    $env:DATA_ROOT = \"C:\\ClinicData\\Microdent\\DATA\"",
    "    $env:SQLITE_PATH = \"C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite\"",
    "    pnpm --filter @microdent/sqlite-mirror run import-safe",
    "",
    "Bash-only repo scripts (mirror-import-safe.sh, qa-sandbox-run.sh) require Git Bash",
    "or WSL on Windows. Prefer the PowerShell flow in phase-4-mirror-import-operator.md.",
    "",
    "Package verification (from repo root after build):",
    "  pnpm stage:pilot-release",
    "  pnpm pilot:verify-release",
    "  pnpm pilot:verify-manifest",
    "",
  ].join("\n"),
  "utf8",
);
writeFileSync(
  join(scriptsDir, "mirror-import-pointer.txt"),
  [
    "Mirror import — staged package pointer",
    "",
    "Full steps: docs/phase-4-mirror-import-operator.md",
    "",
    "Windows (PowerShell, quoted paths):",
    "  $env:DATA_ROOT = \"C:\\ClinicData\\Microdent\\DATA\"",
    "  $env:SQLITE_PATH = \"C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite\"",
    "",
    "Run from Microdent-Modern repo root (not this install folder):",
    "  pnpm --filter @microdent/sqlite-mirror run import-safe",
    "",
    "Never point DATA_ROOT at live Microdent-Legacy. Use a disposable sandbox copy.",
    "",
  ].join("\n"),
  "utf8",
);

// Placeholder runtime dirs — README only, no data
writePlaceholderDir("logs", [
  "Operator log folder (placeholder — not used at install time).",
  "",
  "Create a log folder outside this install directory if you capture desktop or bridge logs.",
  "See docs/windows-pilot-data-locations.md.",
]);
writePlaceholderDir("mirror", [
  "Mirror SQLite folder (placeholder — no database shipped).",
  "",
  "Create this folder on the clinic machine and set SQLITE_PATH in desktop setup",
  "to a file here (example: C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite).",
  "Run mirror import from the repo checkout — see scripts/mirror-import-pointer.txt.",
]);
writePlaceholderDir("backups", [
  "Sandbox backup folder (placeholder — no backups shipped).",
  "",
  "Set BACKUP_DIR in desktop setup to a folder outside the app install directory",
  "before enabling sandbox writes. See docs/windows-pilot-data-locations.md.",
]);

writeHandoffReadme();

try {
  assertStagedTreeSafe(stageRoot);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

const buildTimestampUtc = new Date().toISOString();
try {
  await generateReleaseManifest(stageRoot, { repoRoot, buildTimestampUtc });
} catch (err) {
  fail(`manifest generation failed: ${err instanceof Error ? err.message : String(err)}`);
}

const counts = countTree(stageRoot);
console.log(
  `[stage-pilot-release] OK — staged ${counts.files} files in ${counts.dirs} directories under dist/pilot-release/MicrodentModern/`,
);
