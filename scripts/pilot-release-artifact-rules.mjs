/**
 * Shared pilot release artifact safety rules (stage + verify).
 * PHI-safe: no file contents logged by callers.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
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
export const WINDOWS_TEST_RUNNER = "DOUBLE-CLICK-WINDOWS-TEST.cmd";
export const WINDOWS_AUTO_TEST_RUNNER = "DOUBLE-CLICK-AUTO-TEST.cmd";

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

const COMPILED_SCAN_PREFIXES = ["app/dist/", "bridge/", "sqlite-mirror/", "web/"];

/** Placeholder strings allowed in compiled setup HTML / dist (see out-of-scope-guardrails.md). */
const ALLOWED_COMPILED_PATH_EXAMPLES = [
  "%AppData%\\Microdent\\config.json",
  "%AppData%\\Microdent\\logs\\",
  "C:\\\\ClinicData\\\\Microdent\\\\DATA",
  "C:\\\\Users\\\\Public\\\\MicrodentModern\\\\",
];

const FORBIDDEN_COMPILED_PATH_PATTERNS = [
  { pattern: /\/Users\//, label: "/Users/" },
  { pattern: /\/home\//i, label: "/home/" },
  { pattern: /Microdent-Legacy/i, label: "Microdent-Legacy" },
  { pattern: /Microdent-Write-Sandbox/i, label: "Microdent-Write-Sandbox" },
  { pattern: /Microdent-Modern/i, label: "Microdent-Modern" },
  { pattern: /\/tmp\//i, label: "/tmp/" },
  { pattern: /\\Temp\\/i, label: "\\Temp\\" },
  { pattern: /\bTMP=/i, label: "TMP=" },
  { pattern: /\bTEMP=/i, label: "TEMP=" },
];

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

function isAllowedNodeRuntimeBinary(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  return normalized === "node/node.exe" || normalized === "node/node" || normalized === "node/bin/node";
}

function isAllowedWindowsTestRunner(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  return normalized === WINDOWS_TEST_RUNNER || normalized === WINDOWS_AUTO_TEST_RUNNER;
}

export function assertConfigTemplateSafe(content, label) {
  for (const pattern of FORBIDDEN_CONFIG_PATH_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(`${label} contains forbidden path reference: ${pattern}`);
    }
  }
}

export function assertCompiledArtifactTextSafe(content, relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  const inCompiledTree = COMPILED_SCAN_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
  if (!inCompiledTree) {
    return;
  }
  if (!/\.(js|mjs|cjs|html)$/i.test(normalized)) {
    return;
  }
  let scrubbed = content;
  for (const allowed of ALLOWED_COMPILED_PATH_EXAMPLES) {
    scrubbed = scrubbed.split(allowed).join("");
  }
  for (const { pattern, label } of FORBIDDEN_COMPILED_PATH_PATTERNS) {
    if (pattern.test(scrubbed)) {
      throw new Error(`${relPath} contains forbidden compiled path literal: ${label}`);
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
      if (
        isForbiddenStagedFileName(entry.name)
        && !isAllowedNodeRuntimeBinary(rel)
        && !isAllowedWindowsTestRunner(rel)
      ) {
        onFail(rel, "forbidden file name or extension");
        continue;
      }
      if (rel.startsWith("logs/") && /\.log$/i.test(entry.name)) {
        try {
          if (statSync(abs).size > 0) {
            onFail(rel, "non-empty log file under logs/");
          }
        } catch {
          onFail(rel, "unreadable log file under logs/");
        }
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
      if (readText && /\.(js|mjs|cjs|html)$/i.test(entry.name)) {
        try {
          const content = readFileSync(abs, "utf8");
          try {
            assertCompiledArtifactTextSafe(content, rel);
          } catch (err) {
            onFail(rel, err.message);
          }
        } catch {
          onFail(rel, "unreadable compiled artifact for path scan");
        }
      }
    }
  }
  walk(stageRoot);
}

/**
 * Full staged-tree safety scan (layout walk + compiled path leaks + logs/).
 * @param {string} stageRoot - MicrodentModern root
 */
export function scanStagedArtifacts(stageRoot) {
  const violations = [];
  walkStagedArtifactRules(stageRoot, {
    onFail: (rel, reason) => violations.push({ rel, reason }),
  });
  if (violations.length > 0) {
    const first = violations[0];
    throw new Error(`staged artifact violation at ${first.rel}: ${first.reason}`);
  }
}

export function assertStagedTreeSafe(stageRoot) {
  scanStagedArtifacts(stageRoot);
}

export const REQUIRED_STAGED_LAYOUT = [
  WINDOWS_TEST_RUNNER,
  WINDOWS_AUTO_TEST_RUNNER,
  "PILOT-START-HERE.md",
  "HANDOFF-README.txt",
  "HANDOFF-README.md",
  "clinic-data-copy/DATA/README.txt",
  "qa-runs/README.txt",
  "qa-runs/TEMPLATE-auto-update-evidence.json",
  "qa-runs/TEMPLATE-batch-report.md",
  "qa-runs/TEMPLATE-clinic-pilot-report.json",
  "qa-runs/TEMPLATE-commercial-readiness-evidence.json",
  "qa-runs/TEMPLATE-distribution-evidence.json",
  "qa-runs/TEMPLATE-distribution-readiness.md",
  "qa-runs/TEMPLATE-evidence-attachment-manifest.json",
  "qa-runs/TEMPLATE-go-live-evidence.json",
  "qa-runs/TEMPLATE-installer-evidence.json",
  "qa-runs/TEMPLATE-licensing-readiness.md",
  "qa-runs/TEMPLATE-marketing-evidence.json",
  "qa-runs/TEMPLATE-marketing-readiness.md",
  "qa-runs/TEMPLATE-offline-license.json",
  "qa-runs/TEMPLATE-pilot-feedback-triage.md",
  "qa-runs/TEMPLATE-pricing-evidence.json",
  "qa-runs/TEMPLATE-pricing-readiness.md",
  "qa-runs/TEMPLATE-signed-artifact-evidence.json",
  "qa-runs/TEMPLATE-support-readiness.md",
  "qa-runs/TEMPLATE-support-readiness-evidence.json",
  "qa-runs/TEMPLATE-windows-compatibility-evidence.json",
  "qa-runs/TEMPLATE-windows-package-verify-evidence.json",
  "qa-runs/TEMPLATE-windows-field-evidence.json",
  "qa-runs/TEMPLATE-windows-field-run.md",
  "app/dist/main.js",
  "app/dist/main-app-preload.cjs",
  "app/dist/bridge-supervisor.js",
  "app/dist/setup/setup.html",
  "app/package.json",
  "apps/desktop/README.md",
  "bridge/package.json",
  "bridge/server.js",
  "scripts/windows-oneclick-check.ps1",
  "scripts/import-copied-data.mjs",
  "scripts/serve-web.mjs",
  "scripts/write-smoke-evidence.mjs",
  "sql/migrations/001_initial.sql",
  "sqlite-mirror/package.json",
  "sqlite-mirror/index.js",
  "web/index.html",
  "web/pilot-build.json",
  "config-templates/config.example.json",
  "config-templates/paths.example.env",
  "docs/PILOT-START-HERE.md",
  "docs/PILOT-HANDOFF-PACK.md",
  "docs/operator-manual.md",
  "docs/auto-update-evidence.md",
  "docs/clinic-pilot-report-evidence.md",
  "docs/data-privacy-review.md",
  "docs/support-knowledge-base.md",
  "docs/support-readiness-evidence.md",
  "docs/pilot-feedback-triage-workflow.md",
  "docs/support-readiness-checklist.md",
  "docs/licensing-readiness.md",
  "docs/distribution-readiness.md",
  "docs/distribution-evidence.md",
  "docs/pricing-readiness.md",
  "docs/pricing-evidence.md",
  "docs/marketing-readiness.md",
  "docs/marketing-evidence.md",
  "docs/go-live-evidence.md",
  "docs/offline-license-mechanism.md",
  "docs/FIELD-TEST-START-HERE.md",
  "docs/evidence-collection-packet.md",
  "docs/evidence-attachment-manifest.md",
  "docs/windows-field-evidence-report.md",
  "docs/windows-compatibility-evidence.md",
  "docs/windows-package-verify-evidence.md",
  "docs/commercial-readiness-evidence.md",
  "docs/installer-evidence.md",
  "docs/pilot-tester-guide.md",
  "docs/pilot-acceptance-checklist.md",
  "docs/pilot-backup-restore-audit.md",
  "docs/out-of-scope-guardrails.md",
  "docs/pilot-issue-template.md",
  "docs/windows-pilot-data-locations.md",
  "docs/windows-ci-oneclick.md",
  "docs/windows-pilot-release-layout.md",
  "docs/windows-pilot-runbook.md",
  "docs/windows-pilot-packaging-gap-report.md",
  "docs/windows-pilot-pre-installer-checklist.md",
  "docs/windows-dev-dry-run.md",
  "docs/phase-3-desktop-packaging-plan.md",
  "docs/phase-3-appointment-status-write-runbook.md",
  "docs/phase-3-appointment-status-dry-run.md",
  "docs/phase-3-audit-log-schema.md",
  "docs/phase-3-backup-cli.md",
  "docs/phase-3-disposable-write-sandbox.md",
  "docs/phase-3-restore-cli.md",
  "docs/phase-3-sandbox-guard.md",
  "docs/phase-3-sandbox-qa-runner.md",
  "docs/phase-3-sandbox-validation.md",
  "docs/phase-3-write-safe-qa-checklist.md",
  "docs/phase-3-write-mode-config.md",
  "docs/phase-3-windows-readiness-audit.md",
  "docs/phase-4-windows-operator-quickstart.md",
  "docs/phase-5-operator-qa-runbook.md",
  "docs/phase-6-windows-mvp-operator-guide.md",
  "docs/phase-7-sandbox-pilot-qa-runbook.md",
  "docs/phase-8-log-redaction-review.md",
  "docs/phase-1b-read-only-smoke-tests.md",
  "docs/phase-1b-manual-qa-checklist.md",
  "docs/windows-pilot-installer-decision-record.md",
  "docs/installer-deferral-decision-record.md",
  "docs/code-signing-deferral-decision-record.md",
  "docs/auto-update-deferral-decision-record.md",
  "docs/telemetry-deferral-decision-record.md",
  "docs/external-field-blockers-decision-record.md",
  "docs/signed-artifact-evidence.md",
  "docs/windows-pilot-real-machine-checklist.md",
  "docs/windows-pilot-field-execution-script.md",
  "docs/windows-pilot-field-result-form.md",
  "docs/windows-pilot-package-verify-on-windows.md",
  "docs/windows-pilot-permission-and-path-risks.md",
  "docs/windows-pilot-troubleshooting-pack.md",
  "docs/windows-pilot-go-no-go-checklist.md",
  "docs/windows-pilot-release-notes.md",
  "docs/phase-4-mirror-import-operator.md",
  "scripts/README.txt",
  "scripts/README.md",
  "scripts/mirror-import-pointer.txt",
  "node/README.txt",
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
