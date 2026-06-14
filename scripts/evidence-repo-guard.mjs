#!/usr/bin/env node
/**
 * qa-runs repository guard.
 *
 * Raw screenshots, PDFs, logs, DBF/SQLite files, and archives belong in a
 * secure internal tracker, not in this repo. qa-runs should contain PHI-safe
 * templates, Markdown summaries, TSV/CSV summaries, scripts, and JSON evidence.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_QA_RUNS_FILE_PATTERNS = [
  { pattern: /\.(png|jpg|jpeg|gif|bmp|webp)$/i, reason: "raw screenshot/image file" },
  { pattern: /\.pdf$/i, reason: "raw PDF attachment" },
  { pattern: /\.log$/i, reason: "raw log file" },
  { pattern: /\.(dbf|fpt|cdx)$/i, reason: "raw FoxPro data file" },
  { pattern: /\.sqlite3?$/i, reason: "raw SQLite data file" },
  { pattern: /\.(zip|7z|rar|tar|gz)$/i, reason: "raw attachment archive" },
  { pattern: /^\.env$/i, reason: "environment secret file" },
  { pattern: /\.(exe|bat|cmd|ps1)$/i, reason: "executable/script attachment" },
];

const FORBIDDEN_QA_RUNS_SEGMENTS = [
  /^attachments$/i,
  /^screenshots$/i,
  /^raw-logs$/i,
  /^exports$/i,
  /^microdent-legacy$/i,
  /^microdent-write-sandbox$/i,
];

function walkFiles(root, dir = root) {
  const files = [];
  if (!existsSync(dir)) {
    return files;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(root, abs));
      continue;
    }
    if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function hasForbiddenSegment(relPath) {
  return relPath.split(/[/\\]/).some((segment) =>
    FORBIDDEN_QA_RUNS_SEGMENTS.some((pattern) => pattern.test(segment)),
  );
}

function forbiddenFileReason(fileName) {
  return FORBIDDEN_QA_RUNS_FILE_PATTERNS.find(({ pattern }) => pattern.test(fileName))?.reason;
}

export function auditEvidenceRepoGuard({ repoRoot = REPO_ROOT } = {}) {
  const qaRunsRoot = join(repoRoot, "qa-runs");
  const violations = [];
  const files = walkFiles(qaRunsRoot);

  for (const abs of files) {
    const rel = relative(repoRoot, abs).replace(/\\/g, "/");
    if (hasForbiddenSegment(rel)) {
      violations.push({ path: rel, reason: "raw attachment/data directory segment" });
      continue;
    }
    const reason = forbiddenFileReason(abs.split(/[/\\]/).at(-1) ?? "");
    if (reason) {
      violations.push({ path: rel, reason });
    }
  }

  return {
    ok: violations.length === 0,
    status: violations.length === 0 ? "ready" : "blocked",
    checkedFiles: files.length,
    violations,
  };
}

function printUsage() {
  console.log(`Usage: node scripts/evidence-repo-guard.mjs

Scans qa-runs/ for raw attachments or data files that must stay outside the
repository. This guard is PHI-safe and prints only relative paths/reasons.
`);
}

function main(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  if (args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return 0;
  }

  const result = auditEvidenceRepoGuard();
  console.log(result.ok ? "EVIDENCE REPO GUARD: READY" : "EVIDENCE REPO GUARD: BLOCKED");
  console.log(`checked_files=${result.checkedFiles}`);
  for (const violation of result.violations) {
    console.error(`[evidence-repo-guard] FAIL ${violation.path}: ${violation.reason}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
