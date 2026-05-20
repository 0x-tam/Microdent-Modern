#!/usr/bin/env node
/**
 * Verify staged pilot release layout (post stage-pilot-release).
 * PHI-safe: no path contents logged.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const stageRoot = join(repoRoot, "dist", "pilot-release");

const REQUIRED = [
  "app/dist/main.js",
  "app/dist/bridge-supervisor.js",
  "app/dist/setup/setup.html",
  "app/package.json",
  "bridge/server.js",
  "web/index.html",
  "config/config.example.json",
  "config/paths.example.env",
  "docs/PILOT-START-HERE.md",
  "PLACEHOLDERS.md",
];

const FORBIDDEN_NAMES = [
  /^schedule\.dbf$/i,
  /\.sqlite3?$/i,
  /\.dbf$/i,
];
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
const FORBIDDEN_SUPERVISOR = [/\.(bat|cmd)["']/i, /foxpro/i, /legacy-copy/i, /microdent-legacy/i];

function fail(message) {
  console.error(`[verify-pilot-release] FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(stageRoot)) {
  fail("dist/pilot-release/ missing — run pnpm stage:pilot-release first");
}

for (const rel of REQUIRED) {
  if (!existsSync(join(stageRoot, rel))) {
    fail(`missing staged artifact: ${rel}`);
  }
}

function walk(dir, relBase = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const abs = join(dir, entry.name);
    if (pathHasForbiddenSegment(rel)) {
      fail(`forbidden path segment in staged tree: ${rel}`);
    }
    if (entry.isDirectory()) {
      walk(abs, rel);
      continue;
    }
    for (const pattern of FORBIDDEN_NAMES) {
      if (pattern.test(entry.name) && entry.name.toLowerCase() !== "fake_tiny.dbf") {
        fail(`forbidden staged file: ${rel}`);
      }
    }
  }
}
walk(stageRoot);

const supervisor = readFileSync(join(stageRoot, "app/dist/bridge-supervisor.js"), "utf8");
if (!/server\.js/.test(supervisor)) {
  fail("staged bridge-supervisor must reference server.js");
}
if (!/spawn\([^,]+,\s*\[this\.bridgeEntry\]/.test(supervisor)) {
  fail("staged bridge-supervisor must spawn with bridgeEntry argv only");
}
for (const pattern of FORBIDDEN_SUPERVISOR) {
  if (pattern.test(supervisor)) {
    fail(`staged bridge-supervisor contains forbidden pattern: ${pattern}`);
  }
}

const exampleConfig = readFileSync(join(stageRoot, "config/config.example.json"), "utf8");
if (/Microdent-Legacy/i.test(exampleConfig)) {
  fail("config template must not reference Microdent-Legacy");
}

console.log("[verify-pilot-release] staged layout, supervisor invariants, and sensitive-artifact guards OK");
