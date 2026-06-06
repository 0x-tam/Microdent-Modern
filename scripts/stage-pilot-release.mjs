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
    validation = validateNodeRuntimeDir({ runtimeDir: src });
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
  "- Preferred: this package contains node/ with Node 22.x for local-copy import.",
  "- Runtime staging: run pnpm pilot:node-runtime-check -- --runtime-dir <Node22 folder>",
  "  before pnpm stage:pilot-release; set MICRODENT_NODE_RUNTIME_DIR to include it.",
  "- Fallback: install Node 22.5+ or set MICRODENT_NODE_BINARY before first-run setup.",
  "- Electron runtime (launch via your clinic deployment process or dev checkout)",
  "",
  "Install / extract",
  "-----------------",
  "1. Copy MicrodentModern/ to an install location (e.g. C:\\Program Files\\MicrodentModern\\).",
  "2. Do not store clinic data, local-copy files, backups, or logs inside this folder.",
  "3. On first desktop launch, choose the copied clinic data folder; local copy and backups",
  "   are prepared by the app.",
  "4. Desktop config is saved to: %AppData%\\Microdent\\config.json",
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
    "1. Copy `MicrodentModern/` to an install location (e.g. `C:\\Program Files\\MicrodentModern\\`).",
    "2. Do not store clinic data, local-copy files, backups, or logs inside this folder.",
    "3. On first desktop launch, choose the copied clinic data folder; local copy and backups are prepared by the app.",
    "4. Desktop config is saved to `%AppData%\\Microdent\\config.json` (see `config-templates/config.example.json`).",
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

// bridge/ + web/
copyDistDir(bridgeDist, join(stageRoot, "bridge"));
copyDistDir(sqliteMirrorDist, join(stageRoot, "sqlite-mirror"));
copyDistDir(webDist, join(stageRoot, "web"));

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
  "FIELD-TEST-START-HERE.md",
  "pilot-tester-guide.md",
  "pilot-acceptance-checklist.md",
  "pilot-backup-restore-audit.md",
  "out-of-scope-guardrails.md",
  "pilot-issue-template.md",
  "windows-pilot-installer-decision-record.md",
  "windows-pilot-real-machine-checklist.md",
  "windows-pilot-data-locations.md",
  "windows-pilot-release-layout.md",
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
    "This folder contains documentation pointers only. No clinic data or secrets.",
    "",
    "Local copy preparation:",
    "  First-run setup prepares the fast local copy automatically from the copied",
    "  clinic data folder. See docs/PILOT-HANDOFF-PACK.md.",
    "",
    "Support fallback only:",
    "  See docs/phase-4-mirror-import-operator.md if support asks you to run a",
    "  manual local-copy import from a full repo checkout.",
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

writeHandoffReadme();

writeFileSync(
  join(stageRoot, "PILOT-START-HERE.md"),
  [
    "# Microdent Modern — pilot start",
    "",
    "1. **Field test on Windows:** open **docs/FIELD-TEST-START-HERE.md** → execution script.",
    "2. **Scope:** **docs/windows-pilot-release-notes.md** · **Full walkthrough:** **docs/PILOT-HANDOFF-PACK.md**.",
    "3. Verify package integrity on the build machine: `pnpm pilot:verify-manifest` (hash check on RELEASE-MANIFEST.json).",
    "4. **Safety:** This folder has no clinic DBF, mirror SQLite, backups, or `.env` secrets. Sandbox writes require explicit operator setup.",
    "",
    "Full index: docs/PILOT-START-HERE.md",
    "",
  ].join("\n"),
  "utf8",
);

writePlaceholderDir("qa-runs", [
  "QA run reports (dev/CI only — not shipped with clinic data).",
  "",
  "Field logs and signoff reports belong in the repo checkout qa-runs/, not inside the IT handoff package.",
]);

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
