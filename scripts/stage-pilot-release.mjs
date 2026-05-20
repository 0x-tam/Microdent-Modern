#!/usr/bin/env node
/**
 * Stage Windows pilot release tree under dist/pilot-release/.
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
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = join(repoRoot, "dist", "pilot-release");

const FORBIDDEN_SEGMENTS = [
  /microdent-legacy/i,
  /write-sandbox/i,
  /legacy-copy/i,
];
const FORBIDDEN_FILE = /\.(sqlite3?|dbf)$/i;

function fail(message) {
  console.error(`[stage-pilot-release] FAIL: ${message}`);
  process.exit(1);
}

function assertSafeSourcePath(absPath) {
  const rel = relative(repoRoot, absPath);
  for (const pattern of FORBIDDEN_SEGMENTS) {
    if (pattern.test(rel) || pattern.test(absPath)) {
      fail(`forbidden source path segment: ${pattern}`);
    }
  }
  if (FORBIDDEN_FILE.test(absPath)) {
    const base = basename(absPath).toLowerCase();
    if (base !== "fake_tiny.dbf") {
      fail(`forbidden sensitive file in source: ${basename(absPath)}`);
    }
  }
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
  assertSafeSourcePath(abs);
  if (!existsSync(abs)) {
    fail(`${label} missing — build before staging (${relPath})`);
  }
  return abs;
}

function copyDistDir(src, dest, options = {}) {
  assertSafeSourcePath(src);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      if (options.excludeTestArtifacts && /\.test\.(js|d\.ts|cjs)$/i.test(srcPath)) {
        return false;
      }
      return true;
    },
  });
}

function pathHasForbiddenSegment(relPath) {
  const segments = relPath.split(/[/\\]/);
  return segments.some(
    (seg) =>
      /^microdent-legacy$/i.test(seg) ||
      /^write-sandbox$/i.test(seg) ||
      /^legacy-copy$/i.test(seg) ||
      /^microdent-write-sandbox$/i.test(seg),
  );
}

function copyFileSafe(src, dest) {
  assertSafeSourcePath(src);
  mkdirSync(join(dest, ".."), { recursive: true });
  copyFileSync(src, dest);
}

// --- required builds ---
const desktopDist = requireDist("apps/desktop/dist", "desktop dist");
const bridgeDist = requireDist("services/bridge/dist", "bridge dist");
const webDist = requireDist("apps/web/dist", "web dist");
requireDist(join("apps", "web", "dist", "index.html"), "web index.html");
requireDist(join("services", "bridge", "dist", "server.js"), "bridge server.js");
requireDist(join("apps", "desktop", "dist", "main.js"), "desktop main.js");

if (existsSync(stageRoot)) {
  rmSync(stageRoot, { recursive: true, force: true });
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

// config/ templates only
const configDir = join(stageRoot, "config");
mkdirSync(configDir, { recursive: true });
writeFileSync(
  join(configDir, "config.example.json"),
  `${JSON.stringify(
    {
      version: 1,
      bridgePort: 17890,
      writeMode: "disabled",
      dataRoot: "C:\\ClinicData\\Microdent\\DATA",
      sqlitePath: "C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
      backupDir: "C:\\Users\\Public\\MicrodentModern\\backups",
    },
    null,
    2,
  )}\n`,
  "utf8",
);
writeFileSync(
  join(configDir, "paths.example.env"),
  [
    "# Placeholder env for bridge CLI — replace with your sandbox paths",
    "DATA_ROOT=C:\\ClinicData\\Microdent\\DATA",
    "SQLITE_PATH=C:\\Users\\Public\\MicrodentModern\\mirror\\clinic.sqlite",
    "BACKUP_DIR=C:\\Users\\Public\\MicrodentModern\\backups",
    "WRITE_MODE=disabled",
    "",
  ].join("\n"),
  "utf8",
);

// docs/ — pilot index (no PHI)
const docsDir = join(stageRoot, "docs");
mkdirSync(docsDir, { recursive: true });
for (const name of [
  "PILOT-START-HERE.md",
  "pilot-tester-guide.md",
  "pilot-acceptance-checklist.md",
  "windows-pilot-data-locations.md",
  "windows-pilot-release-layout.md",
]) {
  const src = join(repoRoot, "docs", name);
  if (existsSync(src)) {
    copyFileSafe(src, join(docsDir, name));
  }
}

writeFileSync(
  join(stageRoot, "PLACEHOLDERS.md"),
  [
    "# Operator-created folders (not shipped)",
    "",
    "Create these on the clinic machine outside the install folder:",
    "",
    "- `logs/` — optional desktop/bridge log capture",
    "- `mirror/` — directory for SQLITE_PATH file (example only)",
    "- `backups/` — BACKUP_DIR for sandbox commits",
    "",
    "Never place mirror, backups, or DATA_ROOT inside the app install directory.",
    "See docs/windows-pilot-data-locations.md in the repo or staged docs/ copy.",
    "",
  ].join("\n"),
  "utf8",
);

// Self-check staged tree for sensitive artifacts
function scanStaged(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanStaged(child);
      continue;
    }
    const name = entry.name;
    if (/^schedule\.dbf$/i.test(name)) {
      fail("staged tree must not contain SCHEDULE.DBF");
    }
    if (FORBIDDEN_FILE.test(name) && name.toLowerCase() !== "fake_tiny.dbf") {
      fail(`staged tree must not contain sensitive file: ${name}`);
    }
    const rel = relative(stageRoot, child);
    if (pathHasForbiddenSegment(rel)) {
      fail("staged tree must not contain Legacy or Write-Sandbox directory segments");
    }
  }
}
scanStaged(stageRoot);

const counts = countTree(stageRoot);
console.log(
  `[stage-pilot-release] OK — staged ${counts.files} files in ${counts.dirs} directories under dist/pilot-release/`,
);
