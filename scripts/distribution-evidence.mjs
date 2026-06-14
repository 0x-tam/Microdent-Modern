#!/usr/bin/env node
/**
 * Distribution evidence validator.
 *
 * Validates PHI-safe commercial distribution evidence for channel, integrity,
 * release notes, claims review, support path, and privacy/security review.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DISTRIBUTION_EVIDENCE_SCHEMA_VERSION = "microdent-distribution-evidence/v1";

const REQUIRED_ROWS = [
  "signedArtifact",
  "downloadIntegrity",
  "releaseNotesReady",
  "unsupportedFeaturesDisclosed",
  "marketingClaimsReviewed",
  "supportPathPublished",
  "privacySecurityReviewed",
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
  requireString(errors, row.id, `rows[${index}].id`, /^(signedArtifact|downloadIntegrity|releaseNotesReady|unsupportedFeaturesDisclosed|marketingClaimsReviewed|supportPathPublished|privacySecurityReviewed)$/);
  requireBooleanPass(errors, row.pass, `rows[${index}].pass`);
  requireString(errors, row.evidence, `rows[${index}].evidence`);
}

export function validateDistributionEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== DISTRIBUTION_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${DISTRIBUTION_EVIDENCE_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.reviewDate, "reviewDate", /^\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.channel, "channel", /^(direct-signed-download|partner-handoff|public-website)$/);
  requireString(errors, report.artifact?.relPath, "artifact.relPath", /^(installer|dist|release)\/.+/);
  if (typeof report.artifact?.relPath === "string" && (/^[A-Z]:\\/i.test(report.artifact.relPath) || report.artifact.relPath.startsWith("/"))) {
    errors.push("artifact.relPath must be a relative support-safe path");
  }
  requireString(errors, report.artifact?.sha256, "artifact.sha256", /^[0-9a-f]{64}$/i);
  requireString(errors, report.artifact?.signedArtifactEvidencePath, "artifact.signedArtifactEvidencePath", /^qa-runs\/.+signed-artifact-evidence.*\.json$/);

  requireBooleanPass(errors, report.summary?.downloadIntegrity, "summary.downloadIntegrity");
  requireBooleanPass(errors, report.summary?.releaseNotesReady, "summary.releaseNotesReady");
  requireBooleanPass(errors, report.summary?.marketingClaimsReviewed, "summary.marketingClaimsReviewed");
  requireBooleanPass(errors, report.summary?.supportPathPublished, "summary.supportPathPublished");
  requireBooleanPass(errors, report.summary?.privacySecurityReviewed, "summary.privacySecurityReviewed");

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

export function loadAndValidateDistributionEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateDistributionEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/distribution-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe commercial distribution evidence.
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
    result = loadAndValidateDistributionEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[distribution-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "DISTRIBUTION EVIDENCE: READY" : "DISTRIBUTION EVIDENCE: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[distribution-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[distribution-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
