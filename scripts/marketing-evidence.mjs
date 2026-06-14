#!/usr/bin/env node
/**
 * Marketing evidence validator.
 *
 * Validates PHI-safe sponsor/public-facing claim evidence so commercial
 * messaging cannot outrun field, signing, installer, update, and pilot proof.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MARKETING_EVIDENCE_SCHEMA_VERSION = "microdent-marketing-evidence/v1";

const REQUIRED_ROWS = [
  "claimsMatchEvidence",
  "unsupportedFeaturesDisclosed",
  "privacyClaimsReviewed",
  "websiteOrPacketApproved",
  "noClinicReadyClaimBeforeGate",
  "safeScreenshotsOnly",
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

const FORBIDDEN_PRE_READY_CLAIMS = [
  /production[- ]ready/i,
  /clinic[- ]ready/i,
  /go[- ]live ready/i,
  /safe live legacy writes/i,
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

function validateClaim(claim, index, commercialGateReady, errors) {
  if (!isObject(claim)) {
    errors.push(`claims[${index}] must be an object`);
    return;
  }
  requireString(errors, claim.text, `claims[${index}].text`);
  requireString(errors, claim.evidencePath, `claims[${index}].evidencePath`, /^(docs|qa-runs)\/.+/);
  requireBooleanPass(errors, claim.approved, `claims[${index}].approved`);
  if (claim.allowedBeforeCommercialReady !== true && claim.allowedBeforeCommercialReady !== false) {
    errors.push(`claims[${index}].allowedBeforeCommercialReady must be boolean`);
  }
  if (!commercialGateReady && claim.allowedBeforeCommercialReady !== true) {
    errors.push(`claims[${index}] is not allowed before commercial readiness`);
  }
  if (!commercialGateReady && FORBIDDEN_PRE_READY_CLAIMS.some((pattern) => pattern.test(claim.text ?? ""))) {
    errors.push(`claims[${index}].text contains a premature commercial-readiness claim`);
  }
}

function validateRow(row, index, errors) {
  if (!isObject(row)) {
    errors.push(`rows[${index}] must be an object`);
    return;
  }
  requireString(errors, row.id, `rows[${index}].id`, /^(claimsMatchEvidence|unsupportedFeaturesDisclosed|privacyClaimsReviewed|websiteOrPacketApproved|noClinicReadyClaimBeforeGate|safeScreenshotsOnly)$/);
  requireBooleanPass(errors, row.pass, `rows[${index}].pass`);
  requireString(errors, row.evidence, `rows[${index}].evidence`);
}

export function validateMarketingEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== MARKETING_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${MARKETING_EVIDENCE_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.reviewDate, "reviewDate", /^\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.packet?.type, "packet.type", /^(website|pdf|sales-packet|sponsor-deck)$/);
  requireString(errors, report.packet?.evidencePath, "packet.evidencePath", /^(docs|qa-runs)\/.+/);

  const commercialGateReady = report.commercialGateReady === true;
  requireBooleanPass(errors, report.summary?.claimsMatchEvidence, "summary.claimsMatchEvidence");
  requireBooleanPass(errors, report.summary?.unsupportedFeaturesDisclosed, "summary.unsupportedFeaturesDisclosed");
  requireBooleanPass(errors, report.summary?.privacyClaimsReviewed, "summary.privacyClaimsReviewed");
  requireBooleanPass(errors, report.summary?.websiteOrPacketReady, "summary.websiteOrPacketReady");
  requireBooleanPass(errors, report.summary?.noClinicReadyClaimBeforeGate, "summary.noClinicReadyClaimBeforeGate");
  requireBooleanPass(errors, report.summary?.safeScreenshotsOnly, "summary.safeScreenshotsOnly");

  if (!Array.isArray(report.claims) || report.claims.length < 3) {
    errors.push("claims must include at least 3 approved claim rows");
  } else {
    for (const [index, claim] of report.claims.entries()) {
      validateClaim(claim, index, commercialGateReady, errors);
    }
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

  if (!Array.isArray(report.approvers) || report.approvers.length < 2) {
    errors.push("approvers must include sponsor and privacy/security reviewer");
  } else {
    for (const [index, approver] of report.approvers.entries()) {
      requireString(errors, approver.role, `approvers[${index}].role`);
      requireString(errors, approver.name, `approvers[${index}].name`);
      requireString(errors, approver.date, `approvers[${index}].date`, /^\d{4}-\d{2}-\d{2}$/);
    }
    if (!report.approvers.some((approver) => /sponsor/i.test(approver?.role ?? ""))) {
      errors.push("approvers must include Sponsor");
    }
    if (!report.approvers.some((approver) => /(privacy|security)/i.test(approver?.role ?? ""))) {
      errors.push("approvers must include Privacy or Security reviewer");
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

export function loadAndValidateMarketingEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateMarketingEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/marketing-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe commercial marketing evidence.
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
    result = loadAndValidateMarketingEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[marketing-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "MARKETING EVIDENCE: READY" : "MARKETING EVIDENCE: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[marketing-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[marketing-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
