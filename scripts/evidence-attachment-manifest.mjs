#!/usr/bin/env node
/**
 * PHI-safe evidence attachment manifest validator.
 *
 * The manifest records redacted attachment metadata only: filenames, hashes,
 * source steps, and reviewer signoff. Raw screenshots/logs stay in a secure
 * internal tracker and must never be committed to this repository.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ATTACHMENT_MANIFEST_SCHEMA_VERSION = "microdent-evidence-attachment-manifest/v1";

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "redacted-screenshot",
  "redacted-log-excerpt",
  "field-result-form",
  "go-no-go-signoff",
  "validator-output",
  "issue-summary",
  "hash-manifest",
]);

const ALLOWED_EXTENSIONS = /\.(png|jpg|jpeg|pdf|txt|md|json|csv)$/i;
const FORBIDDEN_EXTENSIONS = /\.(dbf|fpt|cdx|sqlite|sqlite3|log|env|zip|7z|rar)$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const SAFE_FILE_NAME_PATTERN = /^[A-Za-z0-9._ -]+$/;

const FORBIDDEN_MANIFEST_PATTERNS = [
  { pattern: /\bPAT_NAME\b/i, label: "PAT_NAME" },
  { pattern: /\bTELEPHONE\b/i, label: "TELEPHONE" },
  { pattern: /\bCOMMENT\b\s*[:=]/i, label: "COMMENT payload" },
  { pattern: /\b(patientName|patient_name|chartNumber|chart_number|phoneNumber|phone_number)\b/i, label: "patient-identifying key" },
  { pattern: /Microdent-Legacy/i, label: "live legacy path" },
  { pattern: /\/Users\/|\/home\/|[A-Z]:\\Users/i, label: "local user path" },
  { pattern: /\bYYYY\b|<[^>]+>|TBD|TODO|abcdef1/i, label: "placeholder" },
  { pattern: /config\.json/i, label: "raw config reference" },
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

function requireBoolean(errors, value, label, expected = true) {
  if (value !== expected) {
    errors.push(`${label} must be ${expected}`);
  }
}

function validateAttachment(attachment, index, errors) {
  if (!isObject(attachment)) {
    errors.push(`attachments[${index}] must be an object`);
    return;
  }

  requireString(errors, attachment.fileName, `attachments[${index}].fileName`, SAFE_FILE_NAME_PATTERN);
  if (typeof attachment.fileName === "string") {
    if (!ALLOWED_EXTENSIONS.test(attachment.fileName)) {
      errors.push(`attachments[${index}].fileName must use a reviewable safe extension`);
    }
    if (FORBIDDEN_EXTENSIONS.test(attachment.fileName)) {
      errors.push(`attachments[${index}].fileName must not be a raw data/log/archive file`);
    }
    if (attachment.fileName.includes("/") || attachment.fileName.includes("\\")) {
      errors.push(`attachments[${index}].fileName must be a filename only, not a path`);
    }
  }

  if (!ALLOWED_ATTACHMENT_TYPES.has(attachment.type)) {
    errors.push(`attachments[${index}].type must be one of ${Array.from(ALLOWED_ATTACHMENT_TYPES).join(", ")}`);
  }
  requireString(errors, attachment.sha256, `attachments[${index}].sha256`, SHA256_PATTERN);
  requireString(errors, attachment.sourceStep, `attachments[${index}].sourceStep`, /^(EXEC-\d{2}|commercial|go-live|support|distribution|pricing|marketing)$/);
  requireString(errors, attachment.description, `attachments[${index}].description`, undefined);
  if (typeof attachment.description === "string" && attachment.description.trim().length < 12) {
    errors.push(`attachments[${index}].description must describe PHI-safe proof`);
  }

  requireBoolean(errors, attachment.redaction?.reviewed, `attachments[${index}].redaction.reviewed`);
  requireBoolean(errors, attachment.redaction?.phiObserved, `attachments[${index}].redaction.phiObserved`, false);
  requireString(errors, attachment.redaction?.reviewerRole, `attachments[${index}].redaction.reviewerRole`);
  requireString(errors, attachment.redaction?.date, `attachments[${index}].redaction.date`, /^\d{4}-\d{2}-\d{2}$/);
}

export function validateEvidenceAttachmentManifest(manifest, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(manifest)) {
    return { ok: false, status: "blocked", errors: ["manifest must be a JSON object"], warnings };
  }

  if (manifest.schemaVersion !== ATTACHMENT_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${ATTACHMENT_MANIFEST_SCHEMA_VERSION}`);
  }
  if (manifest.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }
  requireString(errors, manifest.evidenceId, "evidenceId", /^[A-Z0-9][A-Z0-9._-]{2,63}$/i);
  requireString(errors, manifest.clinicLabel, "clinicLabel", /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
  requireString(errors, manifest.createdDate, "createdDate", /^\d{4}-\d{2}-\d{2}$/);
  requireString(errors, manifest.storage?.system, "storage.system");
  requireString(errors, manifest.storage?.location, "storage.location");
  if (
    typeof manifest.storage?.location === "string"
    && (/\/Users\/|\/home\//i.test(manifest.storage.location) || /[A-Z]:\\Users/i.test(manifest.storage.location))
  ) {
    errors.push("storage.location must not be a local user path");
  }
  requireBoolean(errors, manifest.storage?.rawFilesExcludedFromRepo, "storage.rawFilesExcludedFromRepo");
  requireBoolean(errors, manifest.storage?.secureInternalTracker, "storage.secureInternalTracker");

  if (!Array.isArray(manifest.attachments) || manifest.attachments.length === 0) {
    errors.push("attachments must contain at least one reviewed item");
  } else {
    for (const [index, attachment] of manifest.attachments.entries()) {
      validateAttachment(attachment, index, errors);
    }
  }

  requireBoolean(errors, manifest.signoff?.reviewed, "signoff.reviewed");
  requireString(errors, manifest.signoff?.reviewerRole, "signoff.reviewerRole");
  requireString(errors, manifest.signoff?.date, "signoff.date", /^\d{4}-\d{2}-\d{2}$/);
  requireBoolean(errors, manifest.signoff?.phiObserved, "signoff.phiObserved", false);

  const raw = rawText || JSON.stringify(manifest);
  for (const { pattern, label } of FORBIDDEN_MANIFEST_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`manifest contains forbidden token: ${label}`);
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

export function loadAndValidateEvidenceAttachmentManifest(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const manifest = JSON.parse(rawText);
  return validateEvidenceAttachmentManifest(manifest, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/evidence-attachment-manifest.mjs <manifest.json> [--repo-root <path>]

Validates a PHI-safe attachment manifest for package-verification, field, and
commercial evidence.
The manifest records reviewed attachment metadata only; raw screenshots, logs,
and PDFs must remain in a secure internal tracker and outside this repository.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = { manifestPath: undefined, repoRoot: undefined, help: false };
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
    if (!parsed.manifestPath) {
      parsed.manifestPath = arg;
    }
  }
  return parsed;
}

function main(argv) {
  const parsed = parseArgs(argv);
  const path = parsed.manifestPath;
  if (parsed.help || !path) {
    printUsage();
    return parsed.help ? 0 : 2;
  }

  let result;
  try {
    result = loadAndValidateEvidenceAttachmentManifest(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[evidence-attachment-manifest] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "ATTACHMENT MANIFEST: READY" : "ATTACHMENT MANIFEST: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[evidence-attachment-manifest] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[evidence-attachment-manifest] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
