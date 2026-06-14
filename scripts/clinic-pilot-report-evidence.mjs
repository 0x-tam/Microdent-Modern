#!/usr/bin/env node
/**
 * Clinic pilot report evidence validator.
 *
 * Validates PHI-safe commercial pilot report summaries. It references package
 * verification evidence, field evidence, and triage rollups rather than
 * duplicating screenshots/logs.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CLINIC_PILOT_REPORT_SCHEMA_VERSION = "microdent-clinic-pilot-report/v1";

const REQUIRED_SAFETY_FLAGS = [
  "phiObserved",
  "liveLegacyTouched",
  "unsupportedWritesAttempted",
  "restoreFailed",
  "openP0Issues",
  "openP1Issues",
];

const FORBIDDEN_EVIDENCE_PATTERNS = [
  { pattern: /\bPAT_NAME\b/i, label: "PAT_NAME" },
  { pattern: /\bTELEPHONE\b/i, label: "TELEPHONE" },
  { pattern: /\bCOMMENT\b\s*[:=]/i, label: "COMMENT payload" },
  { pattern: /\b(patientName|patient_name|chartNumber|chart_number|phoneNumber|phone_number)\b/i, label: "patient-identifying key" },
  { pattern: /Microdent-Legacy/i, label: "live legacy path" },
  { pattern: /\/Users\/|\/home\/|[A-Z]:\\Users\\/i, label: "local user path" },
  { pattern: /\bYYYY\b|<[^>]+>|TBD|TODO|abcdef1/i, label: "placeholder" },
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

function requireBooleanPass(errors, value, label) {
  if (value !== true) {
    errors.push(`${label} must be true`);
  }
}

function requireFalse(errors, value, label) {
  if (value !== false) {
    errors.push(`${label} must be false`);
  }
}

function requireNonNegativeInteger(errors, value, label) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${label} must be a non-negative integer`);
  }
}

export function validateClinicPilotReportEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== CLINIC_PILOT_REPORT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CLINIC_PILOT_REPORT_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }

  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.clinicLabel, "clinicLabel", /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
  requireString(errors, report.machineLabel, "machineLabel", /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
  requireString(errors, report.windowsVersion, "windowsVersion", /^Windows (10|11)\b/i);
  requireString(errors, report.packageVerificationEvidencePath, "packageVerificationEvidencePath", /^qa-runs\/.+windows-package-verify-evidence.*\.json$/);
  requireString(errors, report.fieldEvidencePath, "fieldEvidencePath", /^qa-runs\/.+windows-field-evidence.*\.json$/);
  requireString(errors, report.triageRollupPath, "triageRollupPath", /^qa-runs\/.+pilot-feedback-triage.*\.md$/);
  requirePass(errors, report.outcome, "outcome");
  requireBooleanPass(errors, report.issuesTriaged, "issuesTriaged");
  requireBooleanPass(errors, report.operatorAcceptedWorkflow, "operatorAcceptedWorkflow");
  requireBooleanPass(errors, report.supportPathExercised, "supportPathExercised");
  requireString(errors, report.sponsorSignoff?.role, "sponsorSignoff.role");
  requireString(errors, report.sponsorSignoff?.date, "sponsorSignoff.date", /^\d{4}-\d{2}-\d{2}$/);

  for (const flag of REQUIRED_SAFETY_FLAGS) {
    requireFalse(errors, report.safety?.[flag], `safety.${flag}`);
  }

  requireNonNegativeInteger(errors, report.issueSummary?.p0, "issueSummary.p0");
  requireNonNegativeInteger(errors, report.issueSummary?.p1, "issueSummary.p1");
  requireNonNegativeInteger(errors, report.issueSummary?.p2, "issueSummary.p2");
  requireNonNegativeInteger(errors, report.issueSummary?.p3, "issueSummary.p3");
  requireNonNegativeInteger(errors, report.issueSummary?.closed, "issueSummary.closed");
  if ((report.issueSummary?.p0 ?? 1) !== 0) {
    errors.push("issueSummary.p0 must be 0 for commercial readiness");
  }
  if ((report.issueSummary?.p1 ?? 1) !== 0) {
    errors.push("issueSummary.p1 must be 0 for commercial readiness");
  }

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

export function loadAndValidateClinicPilotReportEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateClinicPilotReportEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/clinic-pilot-report-evidence.mjs <evidence.json> [--repo-root <path>]

Validates a PHI-safe commercial clinic pilot summary. This command should remain
BLOCKED until package verification evidence, field evidence with
packageVerification.evidencePath, triage rollup, and sponsor signoff exist.
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
    result = loadAndValidateClinicPilotReportEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[clinic-pilot-report] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "CLINIC PILOT REPORT: READY" : "CLINIC PILOT REPORT: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[clinic-pilot-report] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[clinic-pilot-report] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
