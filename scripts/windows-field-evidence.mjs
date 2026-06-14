#!/usr/bin/env node
/**
 * PHI-safe Windows field evidence validator.
 *
 * This does not run a Windows test. It validates the completed field-run report
 * so tier 3 evidence is explicit, reviewable, and hard to over-claim.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateEvidenceAttachmentManifest,
} from "./evidence-attachment-manifest.mjs";
import {
  validatePackageVerifyEvidence,
} from "./package-verify-evidence.mjs";

export const FIELD_EVIDENCE_SCHEMA_VERSION = "microdent-windows-field-evidence/v1";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const EXEC_STEPS = Array.from({ length: 16 }, (_, index) => {
  const id = `EXEC-${String(index + 1).padStart(2, "0")}`;
  return id;
});

const VALID_MODES = new Set(["sandbox-signoff", "read-only"]);
const VALID_STATUSES = new Set(["pass", "fail", "na"]);
const OPTIONAL_READ_ONLY_STEPS = new Set(["EXEC-12", "EXEC-13", "EXEC-15"]);
const OPTIONAL_SANDBOX_STEPS = new Set(["EXEC-15"]);
const READ_ONLY_REDACTED_PATHS = {
  packageRoot: "portable-handoff-folder",
  dataRoot: "copied-local-test-folder",
  sqlitePath: "generated-local-mirror",
  backupDir: "generated-local-backups",
};

const FORBIDDEN_REPORT_PATTERNS = [
  { pattern: /\bPAT_NAME\b/i, label: "PAT_NAME" },
  { pattern: /\bTELEPHONE\b/i, label: "TELEPHONE" },
  { pattern: /\bCOMMENT\b\s*[:=]/i, label: "COMMENT payload" },
  { pattern: /\b(patientName|patient_name|chartNumber|chart_number|phoneNumber|phone_number)\b/i, label: "patient-identifying key" },
  { pattern: /Microdent-Legacy/i, label: "live legacy path" },
  { pattern: /\/Users\/|\/home\/|[A-Z]:\\Users\\/i, label: "local user path" },
  { pattern: /"configJson"\s*:/i, label: "raw config JSON" },
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushIfMissing(errors, condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function validateTextField(errors, object, key, label, { pattern, minLength = 1 } = {}) {
  const value = object?.[key];
  pushIfMissing(errors, typeof value === "string" && value.trim().length >= minLength, `${label} is required`);
  if (typeof value === "string" && pattern && !pattern.test(value.trim())) {
    errors.push(`${label} has unexpected format`);
  }
}

function validateFieldPath(errors, paths, key, mode) {
  const label = `paths.${key}`;
  const value = paths?.[key];
  const redactedValue = READ_ONLY_REDACTED_PATHS[key];
  if (mode === "read-only" && value === redactedValue) {
    return;
  }
  validateTextField(errors, paths, key, label, { pattern: /^[A-Z]:\\/i });
}

function requiredStepsForMode(mode) {
  const optional = mode === "read-only" ? OPTIONAL_READ_ONLY_STEPS : OPTIONAL_SANDBOX_STEPS;
  return EXEC_STEPS.filter((step) => !optional.has(step));
}

function requireStepEvidenceIncludes(errors, steps, stepId, requiredTokens) {
  const evidence = typeof steps?.[stepId]?.evidence === "string" ? steps[stepId].evidence : "";
  for (const { label, pattern } of requiredTokens) {
    if (!pattern.test(evidence)) {
      errors.push(`${stepId}.evidence must mention ${label}`);
    }
  }
}

function safeRepoPath(relPath, errors, label, repoRoot = REPO_ROOT) {
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

function validateAttachmentManifestReference(report, errors, repoRoot) {
  const abs = safeRepoPath(report.attachments?.manifestPath, errors, "attachments.manifestPath", repoRoot);
  if (!abs) {
    return;
  }
  if (!existsSync(abs)) {
    errors.push(`attachments.manifestPath does not exist: ${report.attachments?.manifestPath}`);
    return;
  }
  try {
    const manifestRawText = readFileSync(abs, "utf8");
    const manifest = JSON.parse(manifestRawText);
    const result = validateEvidenceAttachmentManifest(manifest, { rawText: manifestRawText });
    if (!result.ok) {
      errors.push("attachments.manifestPath is not ready");
      for (const error of result.errors ?? []) {
        errors.push(`attachments.manifestPath: ${error}`);
      }
    }
    if (
      typeof manifest.clinicLabel === "string"
      && typeof report.machine?.label === "string"
      && manifest.clinicLabel !== report.machine.label
    ) {
      errors.push("attachments.manifestPath clinicLabel must match machine.label");
    }
    if (
      typeof manifest.evidenceId === "string"
      && typeof report.machine?.label === "string"
      && !manifest.evidenceId.includes(report.machine.label)
    ) {
      errors.push("attachments.manifestPath evidenceId must include machine.label");
    }
  } catch (err) {
    errors.push(`attachments.manifestPath could not be read as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function validatePackageVerificationReference(report, errors, repoRoot) {
  const abs = safeRepoPath(report.packageVerification?.evidencePath, errors, "packageVerification.evidencePath", repoRoot);
  if (!abs) {
    return;
  }
  if (!existsSync(abs)) {
    errors.push(`packageVerification.evidencePath does not exist: ${report.packageVerification?.evidencePath}`);
    return;
  }
  try {
    const rawText = readFileSync(abs, "utf8");
    const evidence = JSON.parse(rawText);
    const result = validatePackageVerifyEvidence(evidence, { rawText });
    if (!result.ok) {
      errors.push("packageVerification.evidencePath is not ready");
      for (const error of result.errors ?? []) {
        errors.push(`packageVerification.evidencePath: ${error}`);
      }
    }
    if (
      typeof evidence.machine?.label === "string"
      && typeof report.machine?.label === "string"
      && evidence.machine.label !== report.machine.label
    ) {
      errors.push("packageVerification.evidencePath machine.label must match field machine.label");
    }
    if (
      typeof evidence.build?.packageVersion === "string"
      && typeof report.build?.packageVersion === "string"
      && evidence.build.packageVersion !== report.build.packageVersion
    ) {
      errors.push("packageVerification.evidencePath build.packageVersion must match field build.packageVersion");
    }
    if (
      typeof evidence.build?.gitCommit === "string"
      && typeof report.build?.gitCommit === "string"
      && evidence.build.gitCommit !== report.build.gitCommit
    ) {
      errors.push("packageVerification.evidencePath build.gitCommit must match field build.gitCommit");
    }
    if (
      typeof evidence.build?.appVersion === "string"
      && typeof report.build?.appVersion === "string"
      && evidence.build.appVersion !== report.build.appVersion
    ) {
      errors.push("packageVerification.evidencePath build.appVersion must match field build.appVersion");
    }
    if (
      typeof evidence.build?.releaseChannel === "string"
      && typeof report.build?.releaseChannel === "string"
      && evidence.build.releaseChannel !== report.build.releaseChannel
    ) {
      errors.push("packageVerification.evidencePath build.releaseChannel must match field build.releaseChannel");
    }
  } catch (err) {
    errors.push(`packageVerification.evidencePath could not be read as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function validateFieldEvidenceReport(report, {
  rawText = "",
  verifyReferences = false,
  repoRoot = REPO_ROOT,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(report)) {
    return {
      ok: false,
      status: "invalid",
      mode: "unknown",
      tier3Ready: false,
      errors: ["report must be a JSON object"],
      warnings,
      requiredSteps: [],
      passedSteps: [],
      optionalSteps: [],
    };
  }

  validateTextField(errors, report, "schemaVersion", "schemaVersion");
  if (report.schemaVersion !== FIELD_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${FIELD_EVIDENCE_SCHEMA_VERSION}`);
  }

  const mode = report.mode;
  pushIfMissing(errors, VALID_MODES.has(mode), "mode must be sandbox-signoff or read-only");

  const build = report.build;
  pushIfMissing(errors, isPlainObject(build), "build object is required");
  validateTextField(errors, build, "packageVersion", "build.packageVersion", { pattern: /^pilot-\d{4}-\d{2}-\d{2}$/ });
  validateTextField(errors, build, "appVersion", "build.appVersion", { pattern: /^\d+\.\d+\.\d+/ });
  validateTextField(errors, build, "gitCommit", "build.gitCommit", { pattern: /^[0-9a-f]{7,40}$/i });
  validateTextField(errors, build, "releaseChannel", "build.releaseChannel", { pattern: /^pilot$/ });

  const machine = report.machine;
  pushIfMissing(errors, isPlainObject(machine), "machine object is required");
  validateTextField(errors, machine, "label", "machine.label", { pattern: /^[A-Z0-9][A-Z0-9._-]{2,31}$/i });
  validateTextField(errors, machine, "windowsVersion", "machine.windowsVersion", { pattern: /Windows\s+(10|11)/i });
  validateTextField(errors, machine, "nodeVersion", "machine.nodeVersion", { pattern: /^v?2[2-9]\./i });

  const paths = report.paths;
  pushIfMissing(errors, isPlainObject(paths), "paths object is required");
  validateFieldPath(errors, paths, "packageRoot", mode);
  validateFieldPath(errors, paths, "dataRoot", mode);
  validateFieldPath(errors, paths, "sqlitePath", mode);
  validateFieldPath(errors, paths, "backupDir", mode);

  if (typeof paths?.dataRoot === "string" && /MicrodentModern/i.test(paths.dataRoot)) {
    errors.push("paths.dataRoot must be outside the install/package folder");
  }
  if (typeof paths?.sqlitePath === "string" && /MicrodentModern\\(app|bridge|web|docs)?/i.test(paths.sqlitePath)) {
    errors.push("paths.sqlitePath must be outside the install/package runtime tree");
  }
  if (typeof paths?.backupDir === "string" && /MicrodentModern\\(app|bridge|web|docs)?/i.test(paths.backupDir)) {
    errors.push("paths.backupDir must be outside the install/package runtime tree");
  }

  const steps = report.steps;
  pushIfMissing(errors, isPlainObject(steps), "steps object is required");
  const requiredSteps = VALID_MODES.has(mode) ? requiredStepsForMode(mode) : [];
  const optionalSteps = VALID_MODES.has(mode)
    ? EXEC_STEPS.filter((step) => !requiredSteps.includes(step))
    : [];
  const passedSteps = [];

  for (const stepId of EXEC_STEPS) {
    const step = steps?.[stepId];
    if (!isPlainObject(step)) {
      errors.push(`${stepId} result is required`);
      continue;
    }
    if (!VALID_STATUSES.has(step.status)) {
      errors.push(`${stepId}.status must be pass, fail, or na`);
    }
    if (typeof step.evidence !== "string" || step.evidence.trim().length < 8) {
      errors.push(`${stepId}.evidence must describe PHI-safe proof`);
    }
    if (step.status === "pass") {
      passedSteps.push(stepId);
    }
    if (requiredSteps.includes(stepId) && step.status !== "pass") {
      errors.push(`${stepId} must pass for ${mode} field evidence`);
    }
    if (step.status === "fail") {
      errors.push(`${stepId} is marked fail`);
    }
  }

  if (mode === "read-only") {
    warnings.push("read-only field evidence does not prove sandbox write/restore readiness or clinic go-live");
  }
  if (mode === "sandbox-signoff") {
    requireStepEvidenceIncludes(errors, steps, "EXEC-12", [
      { label: "appointment status update", pattern: /\b(status|status update)\b/i },
      { label: "appointment time move", pattern: /\b(time move|time shift|moved appointment|appointment move|rescheduled appointment|reschedule)\b/i },
      { label: "appointment creation", pattern: /\b(create|created|creation|new appointment|appointment added)\b/i },
      { label: "patient demographics update", pattern: /\b(demographics?|patient update|patient edit|patient details updated|patient details)\b/i },
      { label: "operation IDs", pattern: /\b(operationId|operation ID|operation IDs|op IDs?|opids?)\b/i },
    ]);
    requireStepEvidenceIncludes(errors, steps, "EXEC-13", [
      { label: "backup", pattern: /\bbackup\b/i },
      { label: "restore", pattern: /\brestore|restored\b/i },
    ]);
  }

  const raw = rawText || JSON.stringify(report);
  if (/\bYYYY\b|<MACHINE>|abcdef1/i.test(raw)) {
    errors.push("report contains template placeholder values");
  }
  for (const { pattern, label } of FORBIDDEN_REPORT_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`report contains forbidden PHI-sensitive token: ${label}`);
    }
  }

  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  if (report.goNoGo?.phiObserved !== false) {
    errors.push("goNoGo.phiObserved must be false");
  }
  if (report.goNoGo?.unsupportedWritesAttempted !== false) {
    errors.push("goNoGo.unsupportedWritesAttempted must be false");
  }

  const attachments = report.attachments;
  pushIfMissing(errors, isPlainObject(attachments), "attachments object is required");
  validateTextField(errors, attachments, "manifestPath", "attachments.manifestPath", {
    pattern: /^qa-runs\/.+evidence-attachment-manifest.*\.json$/,
  });
  if (attachments?.redactionReviewed !== true) {
    errors.push("attachments.redactionReviewed must be true");
  }
  if (attachments?.rawAttachmentsCommitted !== false) {
    errors.push("attachments.rawAttachmentsCommitted must be false");
  }

  const packageVerification = report.packageVerification;
  pushIfMissing(errors, isPlainObject(packageVerification), "packageVerification object is required");
  validateTextField(errors, packageVerification, "evidencePath", "packageVerification.evidencePath", {
    pattern: /^qa-runs\/.+windows-package-verify-evidence.*\.json$/,
  });
  if (packageVerification?.verifiedBeforeFieldRun !== true) {
    errors.push("packageVerification.verifiedBeforeFieldRun must be true");
  }

  if (verifyReferences) {
    validatePackageVerificationReference(report, errors, repoRoot);
    validateAttachmentManifestReference(report, errors, repoRoot);
  }

  const ok = errors.length === 0;
  const tier3Ready = ok && mode === "sandbox-signoff";
  const status = tier3Ready ? "ready" : ok ? "read-only-ready" : "blocked";

  return {
    ok,
    status,
    mode: VALID_MODES.has(mode) ? mode : "unknown",
    tier3Ready,
    errors,
    warnings,
    requiredSteps,
    passedSteps,
    optionalSteps,
  };
}

export function loadAndValidateFieldEvidenceReport(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateFieldEvidenceReport(report, {
    verifyReferences: true,
    ...options,
    rawText,
  });
}

function printUsage() {
  console.log(`Usage: node scripts/windows-field-evidence.mjs <report.json> [--repo-root <path>]

Validates a PHI-safe Windows field evidence report.

Status:
  FIELD EVIDENCE: READY              sandbox-signoff report proves tier 3 locally reviewable evidence
  FIELD EVIDENCE: READ_ONLY_READY    read-only Windows report is valid, but go-live remains blocked
  FIELD EVIDENCE: BLOCKED            missing, failing, unsafe, or incomplete evidence
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = { reportPath: undefined, repoRoot: undefined, help: false };
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
    if (!parsed.reportPath) {
      parsed.reportPath = arg;
    }
  }
  return parsed;
}

function main(argv) {
  const parsed = parseArgs(argv);
  const path = parsed.reportPath;
  if (parsed.help || !path) {
    printUsage();
    return parsed.help ? 0 : 2;
  }

  let result;
  try {
    result = loadAndValidateFieldEvidenceReport(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[windows-field-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (result.tier3Ready) {
    console.log("FIELD EVIDENCE: READY");
  } else if (result.ok) {
    console.log("FIELD EVIDENCE: READ_ONLY_READY");
  } else {
    console.log("FIELD EVIDENCE: BLOCKED");
  }
  console.log(`mode=${result.mode}`);
  console.log(`required_steps=${result.requiredSteps.length}`);
  console.log(`passed_steps=${result.passedSteps.length}`);

  for (const warning of result.warnings) {
    console.warn(`[windows-field-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[windows-field-evidence] FAIL: ${error}`);
  }

  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
