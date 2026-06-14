#!/usr/bin/env node
/**
 * Auto-update evidence validator.
 *
 * Validates PHI-safe summaries of signed update channel, update, rollback, and
 * privacy behavior. It does not implement or enable an updater.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const AUTO_UPDATE_EVIDENCE_SCHEMA_VERSION = "microdent-auto-update-evidence/v1";

const REQUIRED_SCENARIOS = ["update-install", "rollback"];

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

function validateScenario(scenario, index, errors) {
  if (!isObject(scenario)) {
    errors.push(`scenarios[${index}] must be an object`);
    return;
  }
  requireString(errors, scenario.name, `scenarios[${index}].name`, /^(update-install|rollback)$/);
  requirePass(errors, scenario.status, `scenarios[${index}].status`);
  requireString(errors, scenario.machineLabel, `scenarios[${index}].machineLabel`, /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
  requireString(errors, scenario.windowsVersion, `scenarios[${index}].windowsVersion`, /^Windows (10|11)\b/i);
  requireString(errors, scenario.evidence, `scenarios[${index}].evidence`);
}

export function validateAutoUpdateEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== AUTO_UPDATE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${AUTO_UPDATE_EVIDENCE_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  requireString(errors, report.build?.fromPackageVersion, "build.fromPackageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.toPackageVersion, "build.toPackageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.fromGitCommit, "build.fromGitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.build?.toGitCommit, "build.toGitCommit", /^[0-9a-f]{7,40}$/i);

  requireString(errors, report.channel?.name, "channel.name", /^(manual-it-redeploy|internal-signed-feed|hosted-signed-feed)$/);
  requireString(errors, report.channel?.feedUrlLabel, "channel.feedUrlLabel");
  requireBooleanPass(errors, report.channel?.accessControlled, "channel.accessControlled");

  requireString(errors, report.payload?.relPath, "payload.relPath", /^updates\/.+/);
  if (typeof report.payload?.relPath === "string" && (/^[A-Z]:\\/i.test(report.payload.relPath) || report.payload.relPath.startsWith("/"))) {
    errors.push("payload.relPath must be a relative support-safe path");
  }
  if (typeof report.payload?.relPath === "string" && /[A-Z]:\\Users\\/i.test(report.payload.relPath)) {
    errors.push("payload.relPath contains local user path");
  }
  requireString(errors, report.payload?.sha256, "payload.sha256", /^[0-9a-f]{64}$/i);
  requireBooleanPass(errors, report.payload?.signed, "payload.signed");
  requireString(errors, report.payload?.signedArtifactEvidencePath, "payload.signedArtifactEvidencePath", /^qa-runs\/.+signed-artifact-evidence.*\.json$/);

  if (!Array.isArray(report.scenarios) || report.scenarios.length < REQUIRED_SCENARIOS.length) {
    errors.push(`scenarios must include ${REQUIRED_SCENARIOS.join(" and ")}`);
  } else {
    for (const [index, scenario] of report.scenarios.entries()) {
      validateScenario(scenario, index, errors);
    }
    for (const scenarioName of REQUIRED_SCENARIOS) {
      if (!report.scenarios.some((scenario) => scenario?.name === scenarioName)) {
        errors.push(`scenarios must include ${scenarioName}`);
      }
    }
  }

  requireBooleanPass(errors, report.behavior?.updatePreservesData, "behavior.updatePreservesData");
  requireBooleanPass(errors, report.behavior?.rollbackProven, "behavior.rollbackProven");
  requireBooleanPass(errors, report.behavior?.restartBehaviorDocumented, "behavior.restartBehaviorDocumented");
  requireBooleanPass(errors, report.behavior?.offlineRecoveryDocumented, "behavior.offlineRecoveryDocumented");
  requireBooleanPass(errors, report.privacy?.reviewed, "privacy.reviewed");
  requireBooleanPass(errors, report.privacy?.noPhiUploaded, "privacy.noPhiUploaded");
  requireBooleanPass(errors, report.privacy?.noLocalPathsUploaded, "privacy.noLocalPathsUploaded");
  requireBooleanPass(errors, report.privacy?.operatorNoticeReady, "privacy.operatorNoticeReady");

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

export function loadAndValidateAutoUpdateEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateAutoUpdateEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/auto-update-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe signed update channel, payload, update, rollback, and privacy
evidence. This command should remain BLOCKED until a real signed update path has
been tested on Windows.
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
    result = loadAndValidateAutoUpdateEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[auto-update-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "AUTO UPDATE EVIDENCE: READY" : "AUTO UPDATE EVIDENCE: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[auto-update-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[auto-update-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
