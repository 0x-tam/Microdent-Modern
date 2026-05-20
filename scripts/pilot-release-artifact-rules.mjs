/**
 * Shared pilot release artifact safety rules (stage + verify).
 * PHI-safe: no file contents logged by callers.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

/** Path segment names that must never appear in staged or source trees. */
export const FORBIDDEN_PATH_SEGMENTS = [
  /^microdent-legacy$/i,
  /^microdent-legacy-copy$/i,
  /^write-sandbox$/i,
  /^legacy-copy$/i,
  /^microdent-write-sandbox$/i,
];

/** File extensions / names forbidden in staged package (placeholders excepted). */
export const FORBIDDEN_STAGED_FILE_PATTERNS = [
  /^schedule\.dbf$/i,
  /^\.env$/i,
  /\.sqlite3?$/i,
  /\.dbf$/i,
  /\.fpt$/i,
  /\.cdx$/i,
  /\.log$/i,
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
];

/** FoxPro-related basenames (non-extension) that must not ship. */
export const FORBIDDEN_FOXPRO_BASENAMES = [
  /^foxuser\.dbf$/i,
  /^vfp\d+\.dll$/i,
  /^vfp\d+\.exe$/i,
];

export const FORBIDDEN_SOURCE_FILE = /\.(sqlite3?|dbf|log|fpt|cdx|exe|bat|cmd)$/i;
export const FORBIDDEN_ENV_FILE = /^\.env$/i;

/** Allowlisted placeholder DBF used only in bridge test fixtures at build time. */
export const ALLOWED_DBF_PLACEHOLDER = "fake_tiny.dbf";

export const FORBIDDEN_CONFIG_PATH_PATTERNS = [
  /Microdent-Legacy/i,
  /\/Users\//,
  /\/home\//i,
  /Microdent-Modern/i,
];

/** Strings that must not appear in RELEASE-MANIFEST.json body. */
export const FORBIDDEN_MANIFEST_STRINGS = [
  "/Users/",
  "/home/",
  "Microdent-Legacy",
  "Microdent-Write-Sandbox",
  "PAT_NAME",
  "TELEPHONE",
  "DATA_ROOT=",
  "SQLITE_PATH=",
];

const DOC_TOKEN_SCAN_REL_PREFIXES = ["docs/", "config-templates/"];

/** Sample-data patterns in docs/templates — not guardrail table mentions. */
const FORBIDDEN_DOC_SAMPLE_PATTERNS = [
  /LEAKED\s+SCHEDULE\s+PAT_NAME/i,
  /\bPAT_NAME\s*[:=]\s*["'][^"']{2,}/i,
  /\bTELEPHONE\s*[:=]\s*["']?\d{3}/i,
  /\bCOMMENT\s*[:=]\s*["'][^"']{2,}/i,
];

export function pathHasForbiddenSegment(relPath) {
  const segments = relPath.split(/[/\\]/);
  return segments.some((seg) =>
    FORBIDDEN_PATH_SEGMENTS.some((pattern) => pattern.test(seg)),
  );
}

export function isAllowedDbfFileName(name) {
  return name.toLowerCase() === ALLOWED_DBF_PLACEHOLDER;
}

export function isForbiddenStagedFileName(name) {
  if (isAllowedDbfFileName(name)) {
    return false;
  }
  if (FORBIDDEN_FOXPRO_BASENAMES.some((p) => p.test(name))) {
    return true;
  }
  return FORBIDDEN_STAGED_FILE_PATTERNS.some((p) => p.test(name));
}

export function assertConfigTemplateSafe(content, label) {
  for (const pattern of FORBIDDEN_CONFIG_PATH_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(`${label} contains forbidden path reference: ${pattern}`);
    }
  }
}

export function assertDocOrConfigTextSafe(content, relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  const shouldScan = DOC_TOKEN_SCAN_REL_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
  if (!shouldScan) {
    return;
  }
  for (const pattern of FORBIDDEN_DOC_SAMPLE_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(
        `${relPath} contains forbidden sample-data pattern: ${pattern}`,
      );
    }
  }
}

export function assertSafeSourceBasename(base) {
  if (FORBIDDEN_ENV_FILE.test(base)) {
    throw new Error(`forbidden sensitive file in source: ${base}`);
  }
}

export function assertSafeSourcePath(absPath, repoRoot) {
  const rel = relative(repoRoot, absPath);
  if (pathHasForbiddenSegment(rel) || pathHasForbiddenSegment(absPath)) {
    throw new Error("forbidden source path segment");
  }
  const base = basename(absPath);
  assertSafeSourceBasename(base);
  if (FORBIDDEN_SOURCE_FILE.test(absPath)) {
    if (!isAllowedDbfFileName(base)) {
      throw new Error(`forbidden sensitive file in source: ${base}`);
    }
  }
}

/**
 * Walk staged tree and invoke onFail(relPath, reason) for each violation.
 * @param {string} stageRoot - MicrodentModern root
 * @param {{ onFail: (rel: string, reason: string) => void, readText?: boolean }} options
 */
export function walkStagedArtifactRules(stageRoot, { onFail, readText = true }) {
  function walk(dir, relBase = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (pathHasForbiddenSegment(rel)) {
        onFail(rel, "forbidden path segment");
        continue;
      }
      if (entry.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (isForbiddenStagedFileName(entry.name)) {
        onFail(rel, "forbidden file name or extension");
        continue;
      }
      if (readText && /\.(md|json|env|txt)$/i.test(entry.name)) {
        try {
          const content = readFileSync(abs, "utf8");
          if (rel.startsWith("config-templates/")) {
            try {
              assertConfigTemplateSafe(content, rel);
            } catch (err) {
              onFail(rel, err.message);
            }
          }
          try {
            assertDocOrConfigTextSafe(content, rel);
          } catch (err) {
            onFail(rel, err.message);
          }
        } catch {
          onFail(rel, "unreadable text file for safety scan");
        }
      }
    }
  }
  walk(stageRoot);
}

export function assertStagedTreeSafe(stageRoot) {
  const violations = [];
  walkStagedArtifactRules(stageRoot, {
    onFail: (rel, reason) => violations.push({ rel, reason }),
  });
  if (violations.length > 0) {
    const first = violations[0];
    throw new Error(`staged artifact violation at ${first.rel}: ${first.reason}`);
  }
}

export const REQUIRED_STAGED_LAYOUT = [
  "HANDOFF-README.txt",
  "HANDOFF-README.md",
  "app/dist/main.js",
  "app/dist/bridge-supervisor.js",
  "app/dist/setup/setup.html",
  "app/package.json",
  "bridge/server.js",
  "web/index.html",
  "config-templates/config.example.json",
  "config-templates/paths.example.env",
  "docs/PILOT-START-HERE.md",
  "docs/PILOT-HANDOFF-PACK.md",
  "docs/pilot-backup-restore-audit.md",
  "docs/out-of-scope-guardrails.md",
  "docs/windows-pilot-real-machine-checklist.md",
  "docs/phase-4-mirror-import-operator.md",
  "scripts/README.txt",
  "scripts/mirror-import-pointer.txt",
  "logs/README.txt",
  "mirror/README.txt",
  "backups/README.txt",
  "RELEASE-MANIFEST.json",
];

export const FORBIDDEN_SUPERVISOR_PATTERNS = [
  /\.(bat|cmd)["']/i,
  /foxpro/i,
  /legacy-copy/i,
  /microdent-legacy/i,
];
