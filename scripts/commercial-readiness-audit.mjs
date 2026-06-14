#!/usr/bin/env node
/**
 * Commercial readiness evidence validator.
 *
 * This is deliberately stricter than pilot release signoff. It only returns
 * READY when the external sellable-product evidence exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAutoUpdateEvidence,
} from "./auto-update-evidence.mjs";
import {
  validateClinicPilotReportEvidence,
} from "./clinic-pilot-report-evidence.mjs";
import {
  validateDistributionEvidence,
} from "./distribution-evidence.mjs";
import {
  validateGoLiveEvidence,
} from "./go-live-evidence.mjs";
import {
  validateInstallerEvidence,
} from "./installer-evidence.mjs";
import {
  validateMarketingEvidence,
} from "./marketing-evidence.mjs";
import {
  validateOfflineLicense,
} from "./offline-license-validate.mjs";
import {
  validatePricingEvidence,
} from "./pricing-evidence.mjs";
import {
  validateSignedArtifactEvidence,
} from "./signed-artifact-evidence.mjs";
import {
  validateSupportReadinessEvidence,
} from "./support-readiness-evidence.mjs";
import {
  validateFieldEvidenceReport,
} from "./windows-field-evidence.mjs";
import {
  validateWindowsCompatibilityEvidence,
} from "./windows-compatibility-evidence.mjs";

export const COMMERCIAL_READINESS_SCHEMA_VERSION = "microdent-commercial-readiness/v1";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_EVIDENCE_PATTERNS = [
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

function requireBooleanPass(errors, value, label) {
  if (value !== true) {
    errors.push(`${label} must be true`);
  }
}

function requireArray(errors, value, label, min) {
  if (!Array.isArray(value) || value.length < min) {
    errors.push(`${label} must contain at least ${min} item${min === 1 ? "" : "s"}`);
    return [];
  }
  return value;
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

function loadJsonEvidence(errors, report, relPath, label, repoRoot) {
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

function requireReferencedJson(errors, report, {
  relPath,
  label,
  repoRoot,
  validator,
  okPredicate = (result) => result.ok === true,
  publicKeyPem,
  validatorOptions = {},
}) {
  const loaded = loadJsonEvidence(errors, report, relPath, label, repoRoot);
  if (!loaded) {
    return undefined;
  }
  const options = { ...validatorOptions, rawText: loaded.rawText };
  if (publicKeyPem) {
    options.publicKeyPem = publicKeyPem;
  }
  const result = validator(loaded.json, options);
  if (!okPredicate(result)) {
    errors.push(`${label} is not ready`);
    for (const error of result.errors ?? []) {
      errors.push(`${label}: ${error}`);
    }
  }
  return { ...loaded, result };
}

function normalizeRelPath(value) {
  return typeof value === "string" ? normalize(value).replace(/\\/g, "/") : "";
}

function normalizeEvidencePath(value, repoRoot) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }
  if (!isAbsolute(value)) {
    return normalizeRelPath(value);
  }
  return normalizeRelPath(relative(repoRoot, resolve(value)));
}

function requireMatchingPath(errors, left, right, leftLabel, rightLabel) {
  if (!left || !right) {
    return;
  }
  if (normalizeRelPath(left) !== normalizeRelPath(right)) {
    errors.push(`${leftLabel} must match ${rightLabel}`);
  }
}

function requireMatchingValue(errors, left, right, leftLabel, rightLabel) {
  if (left === undefined || right === undefined) {
    return;
  }
  if (left !== right) {
    errors.push(`${leftLabel} must match ${rightLabel}`);
  }
}

function validateCommercialReadinessReferences(report, errors, {
  repoRoot = REPO_ROOT,
  publicKeyPem = process.env.MICRODENT_LICENSE_PUBLIC_KEY,
  currentCommercialReadinessPath,
} = {}) {
  const refs = {};

  refs.fieldEvidence = requireReferencedJson(errors, report, {
    relPath: report.fieldEvidence?.reportPath,
    label: "fieldEvidence.reportPath",
    repoRoot,
    validator: validateFieldEvidenceReport,
    validatorOptions: {
      verifyReferences: true,
      repoRoot,
    },
    okPredicate: (result) => result.tier3Ready === true,
  });
  refs.windowsCompatibility = requireReferencedJson(errors, report, {
    relPath: report.windowsValidation?.compatibilityReportPath,
    label: "windowsValidation.compatibilityReportPath",
    repoRoot,
    validator: validateWindowsCompatibilityEvidence,
  });
  refs.signing = requireReferencedJson(errors, report, {
    relPath: report.signing?.signedArtifactEvidencePath,
    label: "signing.signedArtifactEvidencePath",
    repoRoot,
    validator: validateSignedArtifactEvidence,
  });
  refs.installer = requireReferencedJson(errors, report, {
    relPath: report.installer?.installerEvidencePath,
    label: "installer.installerEvidencePath",
    repoRoot,
    validator: validateInstallerEvidence,
  });
  refs.autoUpdate = requireReferencedJson(errors, report, {
    relPath: report.autoUpdate?.autoUpdateEvidencePath,
    label: "autoUpdate.autoUpdateEvidencePath",
    repoRoot,
    validator: validateAutoUpdateEvidence,
  });
  refs.pilotReports = [];
  for (const [index, pilot] of (Array.isArray(report.pilotReports) ? report.pilotReports : []).entries()) {
    refs.pilotReports[index] = requireReferencedJson(errors, report, {
      relPath: pilot?.reportPath,
      label: `pilotReports[${index}].reportPath`,
      repoRoot,
      validator: validateClinicPilotReportEvidence,
    });
  }
  refs.support = requireReferencedJson(errors, report, {
    relPath: report.supportReadiness?.supportEvidencePath,
    label: "supportReadiness.supportEvidencePath",
    repoRoot,
    validator: validateSupportReadinessEvidence,
  });
  refs.license = requireReferencedJson(errors, report, {
    relPath: report.licensing?.licenseEvidencePath,
    label: "licensing.licenseEvidencePath",
    repoRoot,
    validator: validateOfflineLicense,
    publicKeyPem,
  });
  refs.distribution = requireReferencedJson(errors, report, {
    relPath: report.distribution?.distributionEvidencePath,
    label: "distribution.distributionEvidencePath",
    repoRoot,
    validator: validateDistributionEvidence,
  });
  refs.pricing = requireReferencedJson(errors, report, {
    relPath: report.pricing?.pricingEvidencePath,
    label: "pricing.pricingEvidencePath",
    repoRoot,
    validator: validatePricingEvidence,
  });
  refs.marketing = requireReferencedJson(errors, report, {
    relPath: report.marketing?.marketingEvidencePath,
    label: "marketing.marketingEvidencePath",
    repoRoot,
    validator: validateMarketingEvidence,
  });
  refs.goLive = requireReferencedJson(errors, report, {
    relPath: report.goLive?.goLiveEvidencePath,
    label: "goLive.goLiveEvidencePath",
    repoRoot,
    validator: validateGoLiveEvidence,
    validatorOptions: {
      verifyReferences: true,
      repoRoot,
    },
  });

  requireMatchingPath(
    errors,
    refs.fieldEvidence?.json?.packageVerification?.evidencePath,
    report.fieldEvidence?.packageVerificationEvidencePath,
    "field evidence packageVerification.evidencePath",
    "fieldEvidence.packageVerificationEvidencePath",
  );
  requireMatchingPath(
    errors,
    refs.installer?.json?.installer?.signedArtifactEvidencePath,
    report.signing?.signedArtifactEvidencePath,
    "installer evidence signedArtifactEvidencePath",
    "signing.signedArtifactEvidencePath",
  );
  requireMatchingPath(
    errors,
    refs.autoUpdate?.json?.payload?.signedArtifactEvidencePath,
    report.signing?.signedArtifactEvidencePath,
    "auto-update evidence signedArtifactEvidencePath",
    "signing.signedArtifactEvidencePath",
  );
  requireMatchingPath(
    errors,
    refs.distribution?.json?.artifact?.signedArtifactEvidencePath,
    report.signing?.signedArtifactEvidencePath,
    "distribution evidence signedArtifactEvidencePath",
    "signing.signedArtifactEvidencePath",
  );
  requireMatchingPath(
    errors,
    refs.pricing?.json?.licenseEvidencePath,
    report.licensing?.licenseEvidencePath,
    "pricing evidence licenseEvidencePath",
    "licensing.licenseEvidencePath",
  );
  requireMatchingValue(
    errors,
    refs.pricing?.json?.licenseModel,
    report.licensing?.model,
    "pricing evidence licenseModel",
    "licensing.model",
  );
  requireMatchingValue(
    errors,
    refs.pricing?.json?.model,
    report.pricing?.model,
    "pricing evidence model",
    "pricing.model",
  );
  requireMatchingValue(
    errors,
    refs.distribution?.json?.channel,
    report.distribution?.channel,
    "distribution evidence channel",
    "distribution.channel",
  );
  for (const [index, pilotRef] of refs.pilotReports.entries()) {
    requireMatchingPath(
      errors,
      pilotRef?.json?.packageVerificationEvidencePath,
      report.fieldEvidence?.packageVerificationEvidencePath,
      `pilotReports[${index}] packageVerificationEvidencePath`,
      "fieldEvidence.packageVerificationEvidencePath",
    );
    requireMatchingPath(
      errors,
      pilotRef?.json?.fieldEvidencePath,
      report.fieldEvidence?.reportPath,
      `pilotReports[${index}] fieldEvidencePath`,
      "fieldEvidence.reportPath",
    );
  }
  requireMatchingPath(
    errors,
    refs.goLive?.json?.evidencePaths?.packageVerificationEvidencePath,
    report.fieldEvidence?.packageVerificationEvidencePath,
    "go-live evidence packageVerificationEvidencePath",
    "fieldEvidence.packageVerificationEvidencePath",
  );
  requireMatchingPath(
    errors,
    refs.goLive?.json?.evidencePaths?.fieldEvidencePath,
    report.fieldEvidence?.reportPath,
    "go-live evidence fieldEvidencePath",
    "fieldEvidence.reportPath",
  );
  if (currentCommercialReadinessPath && refs.goLive?.json?.evidencePaths?.commercialReadinessPath) {
    const goLiveCommercialPath = normalizeEvidencePath(
      refs.goLive.json.evidencePaths.commercialReadinessPath,
      repoRoot,
    );
    const currentPath = normalizeEvidencePath(currentCommercialReadinessPath, repoRoot);
    if (goLiveCommercialPath !== currentPath) {
      errors.push("go-live evidence commercialReadinessPath must match the commercial readiness report being validated");
    }
  }
  requireMatchingPath(
    errors,
    refs.goLive?.json?.evidencePaths?.clinicPilotReportPath,
    report.pilotReports?.[0]?.reportPath,
    "go-live evidence clinicPilotReportPath",
    "pilotReports[0].reportPath",
  );
  requireMatchingPath(
    errors,
    refs.goLive?.json?.evidencePaths?.supportEvidencePath,
    report.supportReadiness?.supportEvidencePath,
    "go-live evidence supportEvidencePath",
    "supportReadiness.supportEvidencePath",
  );
}

export function validateCommercialReadinessEvidence(report, {
  rawText = "",
  verifyReferences = false,
  repoRoot = REPO_ROOT,
  publicKeyPem = process.env.MICRODENT_LICENSE_PUBLIC_KEY,
  currentCommercialReadinessPath,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(report)) {
    return { ok: false, status: "blocked", errors: ["report must be a JSON object"], warnings };
  }

  if (report.schemaVersion !== COMMERCIAL_READINESS_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${COMMERCIAL_READINESS_SCHEMA_VERSION}`);
  }
  if (report.phiStatement !== "no-real-patient-data") {
    errors.push("phiStatement must be no-real-patient-data");
  }

  requireString(errors, report.build?.packageVersion, "build.packageVersion", /^pilot-\d{4}-\d{2}-\d{2}$/);
  requireString(errors, report.build?.gitCommit, "build.gitCommit", /^[0-9a-f]{7,40}$/i);
  requirePass(errors, report.macSignoff?.strictSignoff, "macSignoff.strictSignoff");
  requireBooleanPass(errors, report.macSignoff?.manifestVerified, "macSignoff.manifestVerified");

  requirePass(errors, report.fieldEvidence?.status, "fieldEvidence.status");
  requireString(errors, report.fieldEvidence?.packageVerificationEvidencePath, "fieldEvidence.packageVerificationEvidencePath", /^qa-runs\/.+windows-package-verify-evidence.*\.json$/);
  requireString(errors, report.fieldEvidence?.reportPath, "fieldEvidence.reportPath", /^qa-runs\/.+windows-field-evidence.*\.json$/);

  requirePass(errors, report.windowsValidation?.windows10, "windowsValidation.windows10");
  requirePass(errors, report.windowsValidation?.windows11, "windowsValidation.windows11");
  requirePass(errors, report.windowsValidation?.antivirusEndpoint, "windowsValidation.antivirusEndpoint");
  requireString(errors, report.windowsValidation?.compatibilityReportPath, "windowsValidation.compatibilityReportPath", /^qa-runs\/.+windows-compatibility-evidence.*\.json$/);

  requirePass(errors, report.signing?.certificate, "signing.certificate");
  requirePass(errors, report.signing?.appExecutableVerified, "signing.appExecutableVerified");
  requirePass(errors, report.signing?.installerVerified, "signing.installerVerified");
  requireString(errors, report.signing?.signedArtifactEvidencePath, "signing.signedArtifactEvidencePath", /^qa-runs\/.+signed-artifact-evidence.*\.json$/);
  requireString(errors, report.signing?.verificationTool, "signing.verificationTool");

  requirePass(errors, report.installer?.status, "installer.status");
  requireString(errors, report.installer?.target, "installer.target", /^(nsis|msi)$/i);
  requireString(errors, report.installer?.installerEvidencePath, "installer.installerEvidencePath", /^qa-runs\/.+installer-evidence.*\.json$/);
  requireBooleanPass(errors, report.installer?.cleanInstall, "installer.cleanInstall");
  requireBooleanPass(errors, report.installer?.upgradeInstall, "installer.upgradeInstall");
  requireBooleanPass(errors, report.installer?.uninstallPreservesData, "installer.uninstallPreservesData");
  requireBooleanPass(errors, report.installer?.shortcutCreated, "installer.shortcutCreated");

  requirePass(errors, report.autoUpdate?.status, "autoUpdate.status");
  requireString(errors, report.autoUpdate?.channel, "autoUpdate.channel");
  requireString(errors, report.autoUpdate?.autoUpdateEvidencePath, "autoUpdate.autoUpdateEvidencePath", /^qa-runs\/.+auto-update-evidence.*\.json$/);
  requireBooleanPass(errors, report.autoUpdate?.signedPayload, "autoUpdate.signedPayload");
  requireBooleanPass(errors, report.autoUpdate?.updatePreservesData, "autoUpdate.updatePreservesData");
  requireBooleanPass(errors, report.autoUpdate?.rollbackProven, "autoUpdate.rollbackProven");
  requireBooleanPass(errors, report.autoUpdate?.privacyReviewed, "autoUpdate.privacyReviewed");

  const pilotReports = requireArray(errors, report.pilotReports, "pilotReports", 1);
  if (pilotReports.length < 3) {
    warnings.push("roadmap target is 1-3 clinic pilot reports; fewer than 3 is acceptable only for first commercial review");
  }
  for (const [index, pilot] of pilotReports.entries()) {
    requireString(errors, pilot.clinicLabel, `pilotReports[${index}].clinicLabel`, /^[A-Z0-9][A-Z0-9._-]{2,31}$/i);
    requireString(errors, pilot.reportPath, `pilotReports[${index}].reportPath`, /^qa-runs\/.+clinic-pilot-report.*\.json$/);
    requirePass(errors, pilot.outcome, `pilotReports[${index}].outcome`);
    requireBooleanPass(errors, pilot.issuesTriaged, `pilotReports[${index}].issuesTriaged`);
    if (pilot.phiObserved !== false) {
      errors.push(`pilotReports[${index}].phiObserved must be false`);
    }
  }

  requireBooleanPass(errors, report.supportReadiness?.knowledgeBaseReady, "supportReadiness.knowledgeBaseReady");
  requireBooleanPass(errors, report.supportReadiness?.issueWorkflowReady, "supportReadiness.issueWorkflowReady");
  requireBooleanPass(errors, report.supportReadiness?.rollbackRunbookReady, "supportReadiness.rollbackRunbookReady");
  requireString(errors, report.supportReadiness?.supportEvidencePath, "supportReadiness.supportEvidencePath", /^qa-runs\/.+support-readiness-evidence.*\.json$/);

  requirePass(errors, report.licensing?.status, "licensing.status");
  requireString(errors, report.licensing?.model, "licensing.model", /^(per-clinic-perpetual|annual-subscription|tiered-subscription)$/i);
  requireString(errors, report.licensing?.licenseEvidencePath, "licensing.licenseEvidencePath", /^qa-runs\/.+offline-license.*\.json$/);
  requireBooleanPass(errors, report.licensing?.offlineValidation, "licensing.offlineValidation");
  requireBooleanPass(errors, report.licensing?.noPhiTransmission, "licensing.noPhiTransmission");
  requireBooleanPass(errors, report.licensing?.gracefulExpiry, "licensing.gracefulExpiry");
  requireBooleanPass(errors, report.licensing?.safetyReviewed, "licensing.safetyReviewed");

  requirePass(errors, report.distribution?.status, "distribution.status");
  requireString(errors, report.distribution?.channel, "distribution.channel");
  requireString(errors, report.distribution?.distributionEvidencePath, "distribution.distributionEvidencePath", /^qa-runs\/.+distribution-evidence.*\.json$/);
  requireBooleanPass(errors, report.distribution?.downloadIntegrity, "distribution.downloadIntegrity");
  requireBooleanPass(errors, report.distribution?.releaseNotesReady, "distribution.releaseNotesReady");
  requireBooleanPass(errors, report.distribution?.marketingClaimsReviewed, "distribution.marketingClaimsReviewed");
  requireBooleanPass(errors, report.distribution?.supportPathPublished, "distribution.supportPathPublished");

  requirePass(errors, report.pricing?.status, "pricing.status");
  requireString(errors, report.pricing?.model, "pricing.model", /^(per-clinic|subscription|tiered)$/i);
  requireString(errors, report.pricing?.pricingEvidencePath, "pricing.pricingEvidencePath", /^qa-runs\/.+pricing-evidence.*\.json$/);
  requireBooleanPass(errors, report.pricing?.scopeMatchesLicense, "pricing.scopeMatchesLicense");
  requireBooleanPass(errors, report.pricing?.supportTermsDefined, "pricing.supportTermsDefined");
  requireBooleanPass(errors, report.pricing?.noUsageTelemetryDependency, "pricing.noUsageTelemetryDependency");
  requireBooleanPass(errors, report.pricing?.sponsorApproved, "pricing.sponsorApproved");

  requirePass(errors, report.marketing?.status, "marketing.status");
  requireString(errors, report.marketing?.marketingEvidencePath, "marketing.marketingEvidencePath", /^qa-runs\/.+marketing-evidence.*\.json$/);
  requireBooleanPass(errors, report.marketing?.claimsMatchEvidence, "marketing.claimsMatchEvidence");
  requireBooleanPass(errors, report.marketing?.unsupportedFeaturesDisclosed, "marketing.unsupportedFeaturesDisclosed");
  requireBooleanPass(errors, report.marketing?.privacyClaimsReviewed, "marketing.privacyClaimsReviewed");
  requireBooleanPass(errors, report.marketing?.websiteOrPacketReady, "marketing.websiteOrPacketReady");
  requireBooleanPass(errors, report.marketing?.noClinicReadyClaimBeforeGate, "marketing.noClinicReadyClaimBeforeGate");

  requirePass(errors, report.goLive?.outcome, "goLive.outcome");
  requireString(errors, report.goLive?.goLiveEvidencePath, "goLive.goLiveEvidencePath", /^qa-runs\/.+go-live-evidence.*\.json$/);
  const approvers = requireArray(errors, report.goLive?.approvers, "goLive.approvers", 2);
  for (const [index, approver] of approvers.entries()) {
    requireString(errors, approver.role, `goLive.approvers[${index}].role`);
    requireString(errors, approver.name, `goLive.approvers[${index}].name`);
    requireString(errors, approver.date, `goLive.approvers[${index}].date`, /^\d{4}-\d{2}-\d{2}$/);
  }

  const raw = rawText || JSON.stringify(report);
  for (const { pattern, label } of FORBIDDEN_EVIDENCE_PATTERNS) {
    if (pattern.test(raw)) {
      errors.push(`report contains forbidden token: ${label}`);
    }
  }

  if (verifyReferences) {
    validateCommercialReadinessReferences(report, errors, {
      repoRoot,
      publicKeyPem,
      currentCommercialReadinessPath,
    });
  }

  const ok = errors.length === 0;
  return {
    ok,
    status: ok ? "ready" : "blocked",
    errors,
    warnings,
  };
}

export function loadAndValidateCommercialReadinessEvidence(path, options = {}) {
  const evidenceReadPath = isAbsolute(path) ? path : join(options.repoRoot ?? process.cwd(), path);
  const rawText = readFileSync(evidenceReadPath, "utf8");
  const report = JSON.parse(rawText);
  return validateCommercialReadinessEvidence(report, {
    verifyReferences: true,
    ...options,
    currentCommercialReadinessPath: options.currentCommercialReadinessPath ?? path,
    rawText,
  });
}

function printUsage() {
  console.log(`Usage: node scripts/commercial-readiness-audit.mjs <evidence.json> [--repo-root <path>] [--public-key <public-key.pem>]

Validates the evidence needed to call Microdent Modern commercially ready,
including every referenced non-template evidence report. This command should
remain BLOCKED until external Windows, signing, installer, update, support,
pilot, distribution, pricing, marketing, licensing, and go-live evidence exists.

The offline license evidence signature is verified with --public-key or
MICRODENT_LICENSE_PUBLIC_KEY.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = { evidencePath: undefined, publicKeyPath: undefined, publicKeyPem: undefined, repoRoot: undefined };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
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
  if (parsed.publicKeyPath) {
    const publicKeyReadPath = isAbsolute(parsed.publicKeyPath)
      ? parsed.publicKeyPath
      : join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath);
    if (existsSync(publicKeyReadPath)) {
      parsed.publicKeyPem = readFileSync(publicKeyReadPath, "utf8");
    }
  }
  return parsed;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[commercial-readiness-audit] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  if (parsed.help || !parsed.evidencePath) {
    printUsage();
    return parsed.help ? 0 : 2;
  }

  let result;
  try {
    result = loadAndValidateCommercialReadinessEvidence(parsed.evidencePath, {
      repoRoot: parsed.repoRoot,
      publicKeyPem: parsed.publicKeyPem,
    });
  } catch (err) {
    console.error(`[commercial-readiness-audit] FAIL: ${basename(parsed.evidencePath)} could not be read as JSON`);
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  console.log(result.ok ? "COMMERCIAL READINESS: READY" : "COMMERCIAL READINESS: BLOCKED");
  for (const warning of result.warnings) {
    console.warn(`[commercial-readiness-audit] WARN: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`[commercial-readiness-audit] FAIL: ${error}`);
  }
  return result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
