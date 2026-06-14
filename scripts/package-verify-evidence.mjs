#!/usr/bin/env node
/**
 * Windows staged-package verification evidence validator.
 *
 * Validates PHI-safe summaries of the no-pnpm Windows package verification
 * step. It does not run Windows checks and does not prove field execution.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_VERIFY_EVIDENCE_SCHEMA_VERSION = "microdent-windows-package-verify/v1";

const REQUIRED_CHECKS = [
  "layoutPresent",
  "manifestFieldsRecorded",
  "manifestSafe",
  "forbiddenArtifactsAbsent",
  "configTemplatesPlaceholders",
  "placeholderFoldersClean",
  "pilotBuildMatchesManifest",
  "operatorDocsPresent",
  "unsupportedFeaturesRecorded",
];

const FORBIDDEN_EVIDENCE_PATTERNS = [
  { pattern: /\bPAT_NAME\b/i, label: "PAT_NAME" },
  { pattern: /\bTELEPHONE\b/i, label: "TELEPHONE" },
  { pattern: /\bCOMMENT\b\s*[:=]/i, label: "COMMENT payload" },
  { pattern: /\b(patientName|patient_name|chartNumber|chart_number|phoneNumber|phone_number)\b/i, label: "patient-identifying key" },
  { pattern: /Microdent-Legacy/i, label: "live legacy path" },
  { pattern: /\/Users\/|\/home\/|[A-Z]:\\Users\\/i, label: "local user path" },
  { pattern: /\bYYYY\b|<[^>]+>|TBD|TODO|abcdef1/i, label: "placeholder" },
  { pattern: /\.(dbf|fpt|cdx|sqlite|sqlite3|env|log)\b/i, label: "raw data/log artifact reference" },
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pass(value) {
  return value === true || value === "pass" || value === "ready" || value === "go";
}

function requireString(errors, value, label, pattern) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} is required`);
    return;
  }
  if (pattern && !pattern.test(value.trim())) {
    errors.push(`${label} has unexpected format`);
  }
}

function requirePass(errors, value, label) {
  if (!pass(value)) {
    errors.push(`${label} must be pass/ready/go`);
  }
}

function requireFalse(errors, value, label) {
  if (value !== false) {
    errors.push(`${label} must be false`);
  }
}

export function validatePackageVerifyEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== PACKAGE_VERIFY_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PACKAGE_VERIFY_EVIDENCE_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }

  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.appVersion, "build.appVersion", /^\d+\.\d+\.\d+/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.build?.releaseChannel, "build.releaseChannel", /^pilot$/);

  requireString(errors, report.machine?.label, "machine.label", /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
  requireString(errors, report.machine?.windowsVersion, "machine.windowsVersion", /^Windows (10|11)\b/i);
  requireString(errors, report.machine?.verifierRole, "machine.verifierRole");

  requireString(errors, report.package?.rootCategory, "package.rootCategory", /^(portable-handoff|installer-candidate|clinic-handoff)$/);
  requireString(errors, report.package?.manifestPath, "package.manifestPath", /^RELEASE-MANIFEST\.json$/);
  requireString(errors, report.package?.pilotBuildPath, "package.pilotBuildPath", /^web\/pilot-build\.json$/);
  requireString(errors, report.package?.verificationDoc, "package.verificationDoc", /^docs\/windows-pilot-package-verify-on-windows\.md$/);

  if (!isObject(report.checks)) {
    errors.push("checks object is required");
  } else {
    for (const check of REQUIRED_CHECKS) {
      requirePass(errors, report.checks[check], `checks.${check}`);
    }
  }

  requireString(errors, report.nodeRuntimeState, "nodeRuntimeState", /^(placeholder-only|validated-runtime|not-bundled)$/);
  requireString(errors, report.decision?.status, "decision.status", /^(pass|conditional)$/);
  requireString(errors, report.decision?.approverRole, "decision.approverRole");
  requireString(errors, report.decision?.date, "decision.date", /^\d{4}-\d{2}-\d{2}$/);
  requireString(
    errors,
    report.decision?.attachmentManifestPath,
    "decision.attachmentManifestPath",
    /^qa-runs\/.+evidence-attachment-manifest.*\.json$/,
  );

  requireFalse(errors, report.rawArtifactsCommitted, "rawArtifactsCommitted");
  requireFalse(errors, report.rawLogsAttached, "rawLogsAttached");
  requireFalse(errors, report.phiObserved, "phiObserved");

  const raw = rawText || JSON.stringify(report);
  for (const { pattern, label } of FORBIDDEN_EVIDENCE_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`report contains forbidden token: ${label}`);
    }
  }

  const ok = errors.length === 0;
  return {
    ok,
    status: ok ? "ready" : "blocked",
    errors,
    warnings,
  };
}

export function loadAndValidatePackageVerifyEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validatePackageVerifyEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/package-verify-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe Windows staged-package verification evidence. Expected
template state is PACKAGE VERIFY: BLOCKED until real Windows IT package
verification is filed.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = { evidencePath: undefined, repoRoot: undefined, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--repo-root") {
      const next = args[i + 1];
      if (next) {
        parsed.repoRoot = next;
        i += 1;
      }
      continue;
    }
    if (!parsed.evidencePath) {
      parsed.evidencePath = arg;
    }
  }
  return parsed;
}

function main(argv) {
  const parsed = parseArgs(argv);
  const path = parsed.evidencePath;
  if (parsed.help || !path) {
    printUsage();
    return parsed.help ? 0 : 2;
  }

  let result;
  try {
    result = loadAndValidatePackageVerifyEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[package-verify-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "PACKAGE VERIFY: READY" : "PACKAGE VERIFY: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[package-verify-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[package-verify-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
