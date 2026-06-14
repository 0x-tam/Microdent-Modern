#!/usr/bin/env node
/**
 * Offline Microdent Modern license validator.
 *
 * PHI-safe by design: licenses are clinic-scoped labels and feature flags only.
 * The signature input is canonical JSON with the top-level signature removed.
 */
import { createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const OFFLINE_LICENSE_SCHEMA_VERSION = "microdent-offline-license/v1";
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const LICENSE_ID_PATTERN = /^LIC-[A-Z0-9][A-Z0-9-]{7,63}$/;
const CLINIC_LABEL_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,31}$/i;
const ALLOWED_TIERS = new Set(["read-only-free", "sandbox-pro", "clinic-enterprise"]);
const REQUIRED_FEATURES = ["readOnly", "sandboxWrites", "localCopyRefresh", "supportExport"];

const FORBIDDEN_LICENSE_PATTERNS = [
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

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalizeLicensePayload(license) {
  const { signature, ...payload } = license;
  return canonicalJson(payload);
}

function parseIsoDate(value, label, errors) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    errors.push(`${label} must be an ISO UTC timestamp`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} must be a valid date`);
    return null;
  }
  return date;
}

function requireBooleanFeature(errors, features, key) {
  if (typeof features?.[key] !== "boolean") {
    errors.push(`features.${key} must be boolean`);
  }
}

function verifySignature(license, publicKeyPem, errors) {
  if (typeof publicKeyPem !== "string" || publicKeyPem.trim().length === 0) {
    errors.push("public key is required via --public-key or MICRODENT_LICENSE_PUBLIC_KEY");
    return;
  }
  if (typeof license.signature !== "string" || !/^[A-Za-z0-9+/=]+$/.test(license.signature)) {
    errors.push("signature must be base64");
    return;
  }

  try {
    const publicKey = createPublicKey(publicKeyPem);
    const ok = verify(
      null,
      Buffer.from(canonicalizeLicensePayload(license), "utf8"),
      publicKey,
      Buffer.from(license.signature, "base64"),
    );
    if (!ok) {
      errors.push("signature verification failed");
    }
  } catch (err) {
    errors.push(`signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function validateOfflineLicense(license, {
  publicKeyPem = process.env.MICRODENT_LICENSE_PUBLIC_KEY,
  now = new Date(),
  rawText = "",
} = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(license)) {
    return { ok: false, status: "blocked", errors: ["license must be a JSON object"], warnings };
  }

  if (license.schemaVersion !== OFFLINE_LICENSE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${OFFLINE_LICENSE_SCHEMA_VERSION}`);
  }
  if (license.product !== "microdent-modern") {
    errors.push("product must be microdent-modern");
  }
  if (typeof license.licenseId !== "string" || !LICENSE_ID_PATTERN.test(license.licenseId)) {
    errors.push("licenseId must match LIC-* support-safe format");
  }
  if (typeof license.clinicLabel !== "string" || !CLINIC_LABEL_PATTERN.test(license.clinicLabel)) {
    errors.push("clinicLabel must be a support-safe clinic label");
  }
  if (!ALLOWED_TIERS.has(license.tier)) {
    errors.push(`tier must be one of ${Array.from(ALLOWED_TIERS).join(", ")}`);
  }
  if (!Number.isInteger(license.seats) || license.seats < 1 || license.seats > 999) {
    errors.push("seats must be an integer between 1 and 999");
  }
  if (!isObject(license.features)) {
    errors.push("features must be an object");
  }
  for (const feature of REQUIRED_FEATURES) {
    requireBooleanFeature(errors, license.features, feature);
  }
  if (license.noPhiStatement !== "no-real-patient-data") {
    errors.push("noPhiStatement must be no-real-patient-data");
  }
  if (license.expiryBehavior !== "graceful-read-only") {
    errors.push("expiryBehavior must be graceful-read-only");
  }
  if (!Number.isInteger(license.graceDays) || license.graceDays < 0 || license.graceDays > 90) {
    errors.push("graceDays must be an integer from 0 to 90");
  }

  const issuedAt = parseIsoDate(license.issuedAt, "issuedAt", errors);
  const expiresAt = parseIsoDate(license.expiresAt, "expiresAt", errors);
  if (issuedAt && expiresAt && issuedAt >= expiresAt) {
    errors.push("expiresAt must be after issuedAt");
  }
  if (expiresAt && now.getTime() > expiresAt.getTime()) {
    errors.push("license is expired; app must fall back to graceful read-only behavior");
  }

  const raw = rawText || JSON.stringify(license);
  for (const { pattern, label } of FORBIDDEN_LICENSE_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`license contains forbidden token: ${label}`);
    }
  }

  if (errors.length === 0) {
    verifySignature(license, publicKeyPem, errors);
  }

  const ok = errors.length === 0;
  return {
    ok,
    status: ok ? "ready" : "blocked",
    errors,
    warnings,
    signedPayload: canonicalizeLicensePayload(license),
  };
}

export function loadAndValidateOfflineLicense(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const license = JSON.parse(rawText);
  return validateOfflineLicense(license, { ...options, rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/offline-license-validate.mjs <license.json> [--repo-root <path>] --public-key <public-key.pem>

Validates a PHI-safe Microdent Modern offline license file.
The license signature is verified over canonical JSON excluding the top-level
signature field. The public key may also be supplied through
MICRODENT_LICENSE_PUBLIC_KEY.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = { licensePath: undefined, publicKeyPem: undefined, publicKeyPath: undefined, repoRoot: undefined };
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
    if (arg === "--public-key") {
      const next = args[i + 1];
      if (next) {
        parsed.publicKeyPath = next;
        i += 1;
      }
      continue;
    }
    if (!parsed.licensePath) {
      parsed.licensePath = arg;
    }
  }
  if (parsed.publicKeyPath) {
    const publicKeyPath = isAbsolute(parsed.publicKeyPath)
      ? parsed.publicKeyPath
      : join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath);
    if (existsSync(publicKeyPath)) {
      parsed.publicKeyPem = readFileSync(publicKeyPath, "utf8");
    }
  }
  return parsed;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[offline-license-validate] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help || !parsed.licensePath) {
    printUsage();
    return parsed.help ? 0 : 2;
  }

  let result;
  try {
    result = loadAndValidateOfflineLicense(parsed.licensePath, {
      repoRoot: parsed.repoRoot,
      publicKeyPem: parsed.publicKeyPem,
    });
  } catch (err) {
    console.error(`[offline-license-validate] FAIL: ${basename(parsed.licensePath)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "OFFLINE LICENSE: READY" : "OFFLINE LICENSE: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[offline-license-validate] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[offline-license-validate] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
