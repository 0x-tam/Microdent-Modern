#!/usr/bin/env node
/**
 * PHI-safe Windows compatibility evidence validator.
 *
 * This validates the Windows 10/11 and antivirus/endpoint matrix required
 * before commercial readiness can be claimed.
 */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WINDOWS_COMPATIBILITY_SCHEMA_VERSION = "microdent-windows-compatibility/v1";

const FORBIDDEN_COMPATIBILITY_PATTERNS = [
  { pattern: /\bPAT_NAME\b/i, label: "PAT_NAME" },
  { pattern: /\bTELEPHONE\b/i, label: "TELEPHONE" },
  { pattern: /\bCOMMENT\b\s*[:=]/i, label: "COMMENT payload" },
  { pattern: /\b(patientName|patient_name|chartNumber|chart_number|phoneNumber|phone_number)\b/i, label: "patient-identifying key" },
  { pattern: /Microdent-Legacy/i, label: "live legacy path" },
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

function requireBoolean(errors, value, label) {
  if (typeof value !== "boolean") {
    errors.push(`${label} must be boolean`);
  }
}

function requireFalse(errors, value, label) {
  if (value !== false) {
    errors.push(`${label} must be false`);
  }
}

function windowsFamily(version) {
  if (typeof version !== "string") return "";
  if (/Windows\s+10/i.test(version)) return "windows10";
  if (/Windows\s+11/i.test(version)) return "windows11";
  return "";
}

export function validateWindowsCompatibilityEvidence(report, { rawText = "" } = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== WINDOWS_COMPATIBILITY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${WINDOWS_COMPATIBILITY_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }

  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requireString(errors, report.build?.releaseChannel, "build.releaseChannel");

  if (!Array.isArray(report.matrix) || report.matrix.length < 2) {
    errors.push("matrix must contain at least Windows 10 and Windows 11 entries");
  }

  const families = new Set();
  for (const [index, entry] of (Array.isArray(report.matrix) ? report.matrix : []).entries()) {
    if (!isObject(entry)) {
      errors.push(`matrix[${index}] must be an object`);
      continue;
    }
    requireString(errors, entry.machineLabel, `matrix[${index}].machineLabel`, /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
    requireString(errors, entry.windowsVersion, `matrix[${index}].windowsVersion`, /Windows\s+(10|11)/i);
    requireString(errors, entry.architecture, `matrix[${index}].architecture`, /^(x64|arm64)$/i);
    requireString(errors, entry.nodeVersion, `matrix[${index}].nodeVersion`, /^v?2[2-9]\./i);

    const family = windowsFamily(entry.windowsVersion);
    if (family) families.add(family);

    requirePass(errors, entry.packageLayoutVerified, `matrix[${index}].packageLayoutVerified`);
    requirePass(errors, entry.desktopLaunch, `matrix[${index}].desktopLaunch`);
    requirePass(errors, entry.firstRunSetup, `matrix[${index}].firstRunSetup`);
    requirePass(errors, entry.localCopyImport, `matrix[${index}].localCopyImport`);
    requirePass(errors, entry.readOnlySmoke, `matrix[${index}].readOnlySmoke`);
    requirePass(errors, entry.sandboxQa, `matrix[${index}].sandboxQa`);
    requirePass(errors, entry.supportExport, `matrix[${index}].supportExport`);

    const av = entry.antivirusEndpoint;
    if (!isObject(av)) {
      errors.push(`matrix[${index}].antivirusEndpoint object is required`);
    } else {
      requireString(errors, av.product, `matrix[${index}].antivirusEndpoint.product`);
      requirePass(errors, av.status, `matrix[${index}].antivirusEndpoint.status`);
      requireBoolean(errors, av.exclusionsRequired, `matrix[${index}].antivirusEndpoint.exclusionsRequired`);
      requireString(errors, av.notes, `matrix[${index}].antivirusEndpoint.notes`);
    }

    requireFalse(errors, entry.phiObserved, `matrix[${index}].phiObserved`);
    requireFalse(errors, entry.liveLegacyTouched, `matrix[${index}].liveLegacyTouched`);
  }

  if (!families.has("windows10")) {
    errors.push("matrix must include a passing Windows 10 entry");
  }
  if (!families.has("windows11")) {
    errors.push("matrix must include a passing Windows 11 entry");
  }

  requirePass(errors, report.summary?.windows10, "summary.windows10");
  requirePass(errors, report.summary?.windows11, "summary.windows11");
  requirePass(errors, report.summary?.antivirusEndpoint, "summary.antivirusEndpoint");
  requireFalse(errors, report.summary?.phiObserved, "summary.phiObserved");
  requireFalse(errors, report.summary?.liveLegacyTouched, "summary.liveLegacyTouched");

  const raw = rawText || JSON.stringify(report);
  for (const { pattern, label } of FORBIDDEN_COMPATIBILITY_PATTERNS) {
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

export function loadAndValidateWindowsCompatibilityEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateWindowsCompatibilityEvidence(report, { rawText });
}

function printUsage() {
  console.log(`Usage: node scripts/windows-compatibility-evidence.mjs <evidence.json> [--repo-root <path>]

Validates PHI-safe Windows 10/11 and antivirus/endpoint compatibility evidence.
Expected current template state is WINDOWS COMPATIBILITY: BLOCKED until real
Windows matrix evidence is filed.
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
    result = loadAndValidateWindowsCompatibilityEvidence(path, {
      repoRoot: parsed.repoRoot,
    });
  } catch (err) {
    console.error(`[windows-compatibility-evidence] FAIL: ${basename(path)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "WINDOWS COMPATIBILITY: READY" : "WINDOWS COMPATIBILITY: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[windows-compatibility-evidence] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[windows-compatibility-evidence] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
