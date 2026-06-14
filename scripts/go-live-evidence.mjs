#!/usr/bin/env node
/**
 * Go-live evidence validator.
 *
 * Validates PHI-safe final go/no-go approval evidence for a limited commercial
 * launch after package verification, field, pilot, support, distribution,
 * pricing, marketing, and license evidence have been filed.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateClinicPilotReportEvidence,
} from "./clinic-pilot-report-evidence.mjs";
import {
  validatePackageVerifyEvidence,
} from "./package-verify-evidence.mjs";
import {
  validateSupportReadinessEvidence,
} from "./support-readiness-evidence.mjs";
import {
  validateFieldEvidenceReport,
} from "./windows-field-evidence.mjs";

export const GO_LIVE_EVIDENCE_SCHEMA_VERSION = "microdent-go-live-evidence/v1";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMERCIAL_READINESS_SCHEMA_VERSION = "microdent-commercial-readiness/v1";

const REQUIRED_ROWS = [
  "fieldEvidenceReady",
  "commercialReadinessReady",
  "pilotIssuesTriaged",
  "supportPathReady",
  "rollbackPathReady",
  "operatorApproval",
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

function requireString(errors, value, label, pattern) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} is required`);
    return;
  }
  if (pattern && !pattern.test(value.trim())) {
    errors.push(`${label} has unexpected format`);
  }
}

function requireBooleanPass(errors, value, label) {
  if (value !== true) {
    errors.push(`${label} must be true`);
  }
}

function validateRow(row, index, errors) {
  if (!isObject(row)) {
    errors.push(`rows[${index}] must be an object`);
    return;
  }
  requireString(errors, row.id, `rows[${index}].id`, /^(fieldEvidenceReady|commercialReadinessReady|pilotIssuesTriaged|supportPathReady|rollbackPathReady|operatorApproval)$/);
  requireBooleanPass(errors, row.pass, `rows[${index}].pass`);
  requireString(errors, row.evidence, `rows[${index}].evidence`);
}

function safeRepoPath(relPath, repoRoot, errors, label) {
  if (typeof relPath !== "string" || relPath.trim().length === 0) {
    return undefined;
  }
  if (relPath.startsWith("/") || /^[A-Z]:\\/i.test(relPath)) {
    errors.push(`${label} must be a repository-relative evidence path`);
    return undefined;
  }
  const normalized = normalize(relPath).replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized === "..") {
    errors.push(`${label} must not traverse outside the repository`);
    return undefined;
  }
  return resolve(repoRoot, normalized);
}

function loadJsonEvidence(errors, relPath, label, repoRoot) {
  const abs = safeRepoPath(relPath, repoRoot, errors, label);
  if (!abs) {
    return undefined;
  }
  if (!existsSync(abs)) {
    errors.push(`${label} does not exist: ${relPath}`);
    return undefined;
  }
  try {
    const rawText = readFileSync(abs, "utf8");
    return { rawText, json: JSON.parse(rawText) };
  } catch (err) {
    errors.push(`${label} could not be read as JSON: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

function requireReferencedJson(errors, {
  relPath,
  label,
  repoRoot,
  validator,
  validatorOptions = {},
  okPredicate = (result) => result.ok === true,
}) {
  const loaded = loadJsonEvidence(errors, relPath, label, repoRoot);
  if (!loaded) {
    return undefined;
  }
  const result = validator(loaded.json, { ...validatorOptions, rawText: loaded.rawText });
  if (!okPredicate(result)) {
    errors.push(`${label} is not ready`);
    for (const error of result.errors ?? []) {
      errors.push(`${label}: ${error}`);
    }
  }
  return { ...loaded, result };
}

function validateGoLiveReferences(report, errors, { repoRoot = REPO_ROOT } = {}) {
  requireReferencedJson(errors, {
    relPath: report.evidencePaths?.packageVerificationEvidencePath,
    label: "evidencePaths.packageVerificationEvidencePath",
    repoRoot,
    validator: validatePackageVerifyEvidence,
  });
  requireReferencedJson(errors, {
    relPath: report.evidencePaths?.fieldEvidencePath,
    label: "evidencePaths.fieldEvidencePath",
    repoRoot,
    validator: validateFieldEvidenceReport,
    validatorOptions: {
      verifyReferences: true,
      repoRoot,
    },
    okPredicate: (result) => result.tier3Ready === true,
  });
  const commercial = loadJsonEvidence(
    errors,
    report.evidencePaths?.commercialReadinessPath,
    "evidencePaths.commercialReadinessPath",
    repoRoot,
  );
  if (commercial?.json?.schemaVersion !== COMMERCIAL_READINESS_SCHEMA_VERSION) {
    errors.push(`evidencePaths.commercialReadinessPath schemaVersion must be ${COMMERCIAL_READINESS_SCHEMA_VERSION}`);
  }
  requireReferencedJson(errors, {
    relPath: report.evidencePaths?.clinicPilotReportPath,
    label: "evidencePaths.clinicPilotReportPath",
    repoRoot,
    validator: validateClinicPilotReportEvidence,
  });
  requireReferencedJson(errors, {
    relPath: report.evidencePaths?.supportEvidencePath,
    label: "evidencePaths.supportEvidencePath",
    repoRoot,
    validator: validateSupportReadinessEvidence,
  });
}

export function validateGoLiveEvidence(report, {
  rawText = "",
  verifyReferences = false,
  repoRoot = REPO_ROOT,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== GO_LIVE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${GO_LIVE_EVIDENCE_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.reviewDate, "reviewDate", /^\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.outcome, "outcome", /^(go|go-limited-sandbox)$/);

  requireString(errors, report.evidencePaths?.packageVerificationEvidencePath, "evidencePaths.packageVerificationEvidencePath", /^qa-runs\/.+windows-package-verify-evidence.*\.json$/);
  requireString(errors, report.evidencePaths?.fieldEvidencePath, "evidencePaths.fieldEvidencePath", /^qa-runs\/.+windows-field-evidence.*\.json$/);
  requireString(errors, report.evidencePaths?.commercialReadinessPath, "evidencePaths.commercialReadinessPath", /^qa-runs\/.+commercial-readiness.*\.json$/);
  requireString(errors, report.evidencePaths?.clinicPilotReportPath, "evidencePaths.clinicPilotReportPath", /^qa-runs\/.+clinic-pilot-report.*\.json$/);
  requireString(errors, report.evidencePaths?.supportEvidencePath, "evidencePaths.supportEvidencePath", /^qa-runs\/.+support-readiness-evidence.*\.json$/);

  requireBooleanPass(errors, report.summary?.fieldEvidenceReady, "summary.fieldEvidenceReady");
  requireBooleanPass(errors, report.summary?.commercialReadinessReady, "summary.commercialReadinessReady");
  requireBooleanPass(errors, report.summary?.pilotIssuesTriaged, "summary.pilotIssuesTriaged");
  requireBooleanPass(errors, report.summary?.noP0P1Issues, "summary.noP0P1Issues");
  requireBooleanPass(errors, report.summary?.supportPathReady, "summary.supportPathReady");
  requireBooleanPass(errors, report.summary?.rollbackPathReady, "summary.rollbackPathReady");
  requireBooleanPass(errors, report.summary?.operatorApprovalRecorded, "summary.operatorApprovalRecorded");
  if (report.summary?.phiObserved !== false) {
    errors.push("summary.phiObserved must be false");
  }

  if (!Array.isArray(report.rows) || report.rows.length < REQUIRED_ROWS.length) {
    errors.push(`rows must include ${REQUIRED_ROWS.join(", ")}`);
  } else {
    for (const [index, row] of report.rows.entries()) {
      validateRow(row, index, errors);
    }
    for (const rowId of REQUIRED_ROWS) {
      if (!report.rows.some((row) => row?.id === rowId)) {
        errors.push(`rows must include ${rowId}`);
      }
    }
  }

  if (!Array.isArray(report.approvers) || report.approvers.length < 3) {
    errors.push("approvers must include IT lead, pilot sponsor, and support lead");
  } else {
    for (const [index, approver] of report.approvers.entries()) {
      requireString(errors, approver.role, `approvers[${index}].role`);
      requireString(errors, approver.name, `approvers[${index}].name`);
      requireString(errors, approver.date, `approvers[${index}].date`, /^\d{4}-\d{2}-\d{2}$/);
    }
    if (!report.approvers.some((approver) => /IT lead/i.test(approver?.role ?? ""))) {
      errors.push("approvers must include IT lead");
    }
    if (!report.approvers.some((approver) => /sponsor/i.test(approver?.role ?? ""))) {
      errors.push("approvers must include Sponsor");
    }
    if (!report.approvers.some((approver) => /support lead/i.test(approver?.role ?? ""))) {
      errors.push("approvers must include Support lead");
    }
  }

  const raw = rawText || JSON.stringify(report);
  for (const { pattern, label } of FORBIDDEN_EVIDENCE_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`report contains forbidden token: ${label}`);
    }
  }

  if (verifyReferences) {
    validateGoLiveReferences(report, errors, { repoRoot });
  }

  const ok = errors.length === 0;
  return {
    ok,
    status: ok ? "ready" : "blocked",
    errors,
    warnings,
  };
}

export function loadAndValidateGoLiveEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateGoLiveEvidence(report, {
    verifyReferences: true,
    ...options,
    rawText,
  });
}

function printUsage() {
  console.log(`Usage: node scripts/go-live-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe final go-live approval evidence after package verification
evidence, field evidence with packageVerification.evidencePath, clinic pilot,
support, and commercial readiness evidence are filed.
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
    result = loadAndValidateGoLiveEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[go-live-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "GO-LIVE EVIDENCE: READY" : "GO-LIVE EVIDENCE: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[go-live-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[go-live-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
