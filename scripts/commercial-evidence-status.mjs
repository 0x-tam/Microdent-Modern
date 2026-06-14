#!/usr/bin/env node
/**
 * Commercial evidence status scanner.
 *
 * This is a preflight for the final commercial readiness gate. It scans filed
 * non-template qa-runs JSON reports and shows which evidence families are
 * missing or invalid before operators assemble the final readiness JSON.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAutoUpdateEvidence,
} from "./auto-update-evidence.mjs";
import {
  validateClinicPilotReportEvidence,
} from "./clinic-pilot-report-evidence.mjs";
import {
  validateCommercialReadinessEvidence,
} from "./commercial-readiness-audit.mjs";
import {
  validateDistributionEvidence,
} from "./distribution-evidence.mjs";
import {
  validateEvidenceAttachmentManifest,
} from "./evidence-attachment-manifest.mjs";
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
  validatePackageVerifyEvidence,
} from "./package-verify-evidence.mjs";
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

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const COMPONENTS = [
  {
    id: "package-verification",
    label: "Windows package verification evidence",
    filenameIncludes: "windows-package-verify-evidence",
    validator: validatePackageVerifyEvidence,
  },
  {
    id: "attachment-manifest",
    label: "Evidence attachment manifest",
    filenameIncludes: "evidence-attachment-manifest",
    validator: validateEvidenceAttachmentManifest,
  },
  {
    id: "windows-field-evidence",
    label: "Windows field evidence",
    filenameIncludes: "windows-field-evidence",
    validator: validateFieldEvidenceReport,
    options: ({ repoRoot, rawText }) => ({ rawText, verifyReferences: true, repoRoot }),
    ready: (result) => result.tier3Ready === true,
  },
  {
    id: "windows-compatibility",
    label: "Windows compatibility matrix",
    filenameIncludes: "windows-compatibility-evidence",
    validator: validateWindowsCompatibilityEvidence,
  },
  {
    id: "signed-artifacts",
    label: "Signed artifact evidence",
    filenameIncludes: "signed-artifact-evidence",
    validator: validateSignedArtifactEvidence,
  },
  {
    id: "installer",
    label: "Installer evidence",
    filenameIncludes: "installer-evidence",
    validator: validateInstallerEvidence,
  },
  {
    id: "auto-update",
    label: "Auto-update evidence",
    filenameIncludes: "auto-update-evidence",
    validator: validateAutoUpdateEvidence,
  },
  {
    id: "clinic-pilot-report",
    label: "Clinic pilot report",
    filenameIncludes: "clinic-pilot-report",
    validator: validateClinicPilotReportEvidence,
  },
  {
    id: "support-readiness",
    label: "Support readiness evidence",
    filenameIncludes: "support-readiness-evidence",
    validator: validateSupportReadinessEvidence,
  },
  {
    id: "offline-license",
    label: "Offline license evidence",
    filenameIncludes: "offline-license",
    validator: validateOfflineLicense,
    needsPublicKey: true,
  },
  {
    id: "distribution",
    label: "Distribution evidence",
    filenameIncludes: "distribution-evidence",
    validator: validateDistributionEvidence,
  },
  {
    id: "pricing",
    label: "Pricing evidence",
    filenameIncludes: "pricing-evidence",
    validator: validatePricingEvidence,
  },
  {
    id: "marketing",
    label: "Marketing evidence",
    filenameIncludes: "marketing-evidence",
    validator: validateMarketingEvidence,
  },
  {
    id: "go-live",
    label: "Go-live evidence",
    filenameIncludes: "go-live-evidence",
    validator: validateGoLiveEvidence,
    options: ({ repoRoot, rawText }) => ({
      rawText,
      verifyReferences: true,
      repoRoot,
    }),
  },
  {
    id: "commercial-readiness",
    label: "Commercial readiness evidence",
    filenameIncludes: "commercial-readiness",
    validator: validateCommercialReadinessEvidence,
    options: ({ repoRoot, publicKeyPem, rawText }) => ({
      rawText,
      verifyReferences: true,
      repoRoot,
      publicKeyPem,
    }),
  },
];

function candidateFiles(repoRoot) {
  const qaRunsDir = join(repoRoot, "qa-runs");
  if (!existsSync(qaRunsDir)) {
    return [];
  }
  return readdirSync(qaRunsDir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("TEMPLATE-"))
    .map((name) => join(qaRunsDir, name))
    .filter((path) => statSync(path).isFile())
    .sort();
}

function defaultOptions({ rawText, publicKeyPem }) {
  return publicKeyPem ? { rawText, publicKeyPem } : { rawText };
}

function validateCandidate(path, component, { repoRoot, publicKeyPem }) {
  try {
    const rawText = readFileSync(path, "utf8");
    const report = JSON.parse(rawText);
    const options = component.options
      ? component.options({ repoRoot, publicKeyPem, rawText })
      : defaultOptions({ rawText, publicKeyPem: component.needsPublicKey ? publicKeyPem : undefined });
    const result = component.validator(report, options);
    const ready = component.ready ? component.ready(result) : result.ok === true;
    return {
      path,
      file: basename(path),
      ready,
      status: ready ? "ready" : "blocked",
      resultStatus: result.status ?? (ready ? "ready" : "blocked"),
      errors: result.errors ?? [],
      warnings: result.warnings ?? [],
    };
  } catch (err) {
    return {
      path,
      file: basename(path),
      ready: false,
      status: "blocked",
      resultStatus: "invalid",
      errors: [err instanceof Error ? err.message : String(err)],
      warnings: [],
    };
  }
}

export function auditCommercialEvidenceStatus({
  repoRoot = REPO_ROOT,
  publicKeyPem = process.env.MICRODENT_LICENSE_PUBLIC_KEY,
} = {}) {
  const files = candidateFiles(repoRoot);
  const components = COMPONENTS.map((component) => {
    const matchingFiles = files.filter((path) => basename(path).includes(component.filenameIncludes));
    const candidates = matchingFiles.map((path) => validateCandidate(path, component, { repoRoot, publicKeyPem }));
    const readyCandidates = candidates.filter((candidate) => candidate.ready);
    const errors = [];
    if (candidates.length === 0) {
      errors.push(`no non-template qa-runs/*${component.filenameIncludes}*.json found`);
    }
    for (const candidate of candidates) {
      if (!candidate.ready) {
        for (const error of candidate.errors) {
          errors.push(`${candidate.file}: ${error}`);
        }
      }
    }
    const ready = readyCandidates.length > 0;
    return {
      id: component.id,
      label: component.label,
      status: ready ? "ready" : "blocked",
      candidates,
      candidateCount: candidates.length,
      readyCandidateCount: readyCandidates.length,
      errors,
    };
  });

  const ready = components.every((component) => component.status === "ready");
  return {
    ready,
    status: ready ? "ready" : "blocked",
    components,
  };
}

function printUsage() {
  console.log(`Usage: node scripts/commercial-evidence-status.mjs [--json] [--repo-root <path>] [--public-key <public-key.pem>]

Scans non-template qa-runs/*.json files and reports which commercial launch
evidence components are ready or blocked, starting with package verification
evidence and field evidence that references packageVerification.evidencePath.
This is a preflight for pnpm pilot:commercial-readiness, not a substitute for
final go-live signoff.

Pass --public-key or set MICRODENT_LICENSE_PUBLIC_KEY so offline license
evidence can be signature-verified.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = { json: false, publicKeyPath: undefined, publicKeyPem: undefined, repoRoot: undefined };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
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

function printText(result) {
  console.log(result.ready ? "COMMERCIAL EVIDENCE STATUS: READY" : "COMMERCIAL EVIDENCE STATUS: BLOCKED");
  for (const component of result.components) {
    console.log(
      `[${component.status}] ${component.label} candidates=${component.candidateCount} ready=${component.readyCandidateCount}`,
    );
    for (const error of component.errors) {
      console.error(`[commercial-evidence-status] FAIL ${component.id}: ${error}`);
    }
    for (const candidate of component.candidates) {
      for (const warning of candidate.warnings) {
        console.warn(`[commercial-evidence-status] WARN ${component.id}/${candidate.file}: ${warning}`);
      }
    }
  }
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[commercial-evidence-status] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  if (parsed.help) {
    printUsage();
    return 0;
  }

  const result = auditCommercialEvidenceStatus({
    repoRoot: parsed.repoRoot,
    publicKeyPem: parsed.publicKeyPem,
  });
  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }
  return result.ready ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
