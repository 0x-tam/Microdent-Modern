#!/usr/bin/env node
/**
 * Signed artifact evidence validator.
 *
 * This validates PHI-safe summaries of Windows Authenticode verification. It
 * does not sign artifacts and does not accept raw logs or local machine paths.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SIGNED_ARTIFACT_EVIDENCE_SCHEMA_VERSION = "microdent-signed-artifact-evidence/v1";

const REQUIRED_ARTIFACT_KINDS = ["app-executable", "installer"];

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
  return value === true || value === "pass" || value === "ready" || value === "valid";
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
    errors.push(`${label} must be pass/ready/valid`);
  }
}

function requireBooleanPass(errors, value, label) {
  if (value !== true) {
    errors.push(`${label} must be true`);
  }
}

function parseDate(value, label, errors) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${label} must be YYYY-MM-DD`);
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} must be a valid date`);
    return null;
  }
  return date;
}

function validateCertificate(report, errors) {
  requireString(errors, report.certificate?.subject, "certificate.subject");
  requireString(errors, report.certificate?.issuer, "certificate.issuer");
  requireString(errors, report.certificate?.sha256Thumbprint, "certificate.sha256Thumbprint", /^[0-9a-f]{64}$/i);
  requirePass(errors, report.certificate?.chainStatus, "certificate.chainStatus");
  const validFrom = parseDate(report.certificate?.validFrom, "certificate.validFrom", errors);
  const validTo = parseDate(report.certificate?.validTo, "certificate.validTo", errors);
  if (validFrom && validTo && validFrom >= validTo) {
    errors.push("certificate.validTo must be after certificate.validFrom");
  }
}

function validateArtifact(artifact, index, errors) {
  if (!isObject(artifact)) {
    errors.push(`artifacts[${index}] must be an object`);
    return;
  }
  requireString(errors, artifact.kind, `artifacts[${index}].kind`, /^(app-executable|installer)$/);
  requireString(errors, artifact.relPath, `artifacts[${index}].relPath`, /^(app|installer|dist)\/.+/);
  if (typeof artifact.relPath === "string" && (/^[A-Z]:\\/i.test(artifact.relPath) || artifact.relPath.startsWith("/"))) {
    errors.push(`artifacts[${index}].relPath must be a relative support-safe path`);
  }
  if (typeof artifact.relPath === "string" && /[A-Z]:\\Users\\/i.test(artifact.relPath)) {
    errors.push(`artifacts[${index}].relPath contains local user path`);
  }
  requireString(errors, artifact.sha256, `artifacts[${index}].sha256`, /^[0-9a-f]{64}$/i);
  requirePass(errors, artifact.signatureStatus, `artifacts[${index}].signatureStatus`);
  requireBooleanPass(errors, artifact.publisherVerified, `artifacts[${index}].publisherVerified`);
  requireBooleanPass(errors, artifact.timestampVerified, `artifacts[${index}].timestampVerified`);
  requireString(errors, artifact.verificationTool, `artifacts[${index}].verificationTool`, /^signtool verify/i);
  requireString(errors, artifact.verificationSummary, `artifacts[${index}].verificationSummary`);
}

export function validateSignedArtifactEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== SIGNED_ARTIFACT_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SIGNED_ARTIFACT_EVIDENCE_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);

  validateCertificate(report, errors);

  if (!Array.isArray(report.artifacts) || report.artifacts.length < REQUIRED_ARTIFACT_KINDS.length) {
    errors.push(`artifacts must include ${REQUIRED_ARTIFACT_KINDS.join(" and ")}`);
  } else {
    for (const [index, artifact] of report.artifacts.entries()) {
      validateArtifact(artifact, index, errors);
    }
    for (const kind of REQUIRED_ARTIFACT_KINDS) {
      if (!report.artifacts.some((artifact) => artifact?.kind === kind)) {
        errors.push(`artifacts must include ${kind}`);
      }
    }
  }

  requireBooleanPass(errors, report.timestamping?.rfc3161, "timestamping.rfc3161");
  requireString(errors, report.timestamping?.authority, "timestamping.authority");
  requireBooleanPass(errors, report.smartScreen?.submittedOrReputationReviewed, "smartScreen.submittedOrReputationReviewed");
  requireString(errors, report.smartScreen?.notes, "smartScreen.notes");
  if (report.rawLogsAttached !== false) {
    errors.push("rawLogsAttached must be false");
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

export function loadAndValidateSignedArtifactEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateSignedArtifactEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/signed-artifact-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe Windows Authenticode signing evidence for the app executable
and installer. This command should remain BLOCKED until real signed artifacts
and Windows signtool verification exist.
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
    result = loadAndValidateSignedArtifactEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[signed-artifact-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "SIGNED ARTIFACTS: READY" : "SIGNED ARTIFACTS: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[signed-artifact-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[signed-artifact-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
