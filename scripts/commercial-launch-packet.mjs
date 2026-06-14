#!/usr/bin/env node
/**
 * Commercial launch readiness packet generator.
 *
 * This does not make Microdent Modern commercially ready. It generates a
 * PHI-safe checklist for support, distribution, pricing, marketing, offline
 * license, and commercial-readiness evidence before final go-live approval.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CLINIC_LABEL = "CLINIC-PC-01";

const CHECKS = [
  {
    id: "COMM-01",
    phase: "Support",
    action: "File support readiness evidence.",
    evidence: "Reference support KB, issue workflow, rollback runbook, training, safe evidence rules, and IT/support signoffs.",
  },
  {
    id: "COMM-02",
    phase: "Licensing",
    action: "File signed offline license evidence.",
    evidence: "Reference signed offline license JSON and verify with the public key; do not include PHI or usage telemetry.",
  },
  {
    id: "COMM-03",
    phase: "Distribution",
    action: "File commercial distribution evidence.",
    evidence: "Reference signed artifact evidence, release artifact hash, release notes, support path, claims review, and privacy/security review.",
  },
  {
    id: "COMM-04",
    phase: "Pricing",
    action: "File pricing evidence.",
    evidence: "Confirm pricing scope matches license model, support terms are defined, and pricing does not depend on PHI or telemetry.",
  },
  {
    id: "COMM-05",
    phase: "Marketing",
    action: "File marketing evidence.",
    evidence: "Confirm claims match filed evidence, unsupported features are disclosed, screenshots are synthetic, and no premature clinic-ready claims appear.",
  },
  {
    id: "COMM-06",
    phase: "Commercial readiness",
    action: "Run commercial bundle preflight and final commercial readiness validator.",
    evidence: "Use commercial evidence status before assembling final commercial readiness evidence, then run with public-key verification.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildCommercialLaunchPacket({
  date = todayIso(),
  clinicLabel = DEFAULT_CLINIC_LABEL,
  publicKeyPath = "keys/microdent-license-public.pem",
} = {}) {
  const supportEvidencePath = `qa-runs/${date}-support-readiness-evidence.json`;
  const licenseEvidencePath = `qa-runs/${date}-offline-license-${clinicLabel}.json`;
  const distributionEvidencePath = `qa-runs/${date}-distribution-evidence.json`;
  const pricingEvidencePath = `qa-runs/${date}-pricing-evidence.json`;
  const marketingEvidencePath = `qa-runs/${date}-marketing-evidence.json`;
  const commercialReadinessPath = `qa-runs/${date}-commercial-readiness-evidence.json`;
  return {
    date,
    clinicLabel,
    status: "blocked-until-commercial-evidence-filed",
    evidenceTargets: {
      supportEvidencePath,
      licenseEvidencePath,
      distributionEvidencePath,
      pricingEvidencePath,
      marketingEvidencePath,
      commercialReadinessPath,
      commercialStatusCommand: `pnpm pilot:commercial-evidence-status -- --public-key ${publicKeyPath}`,
      completionAuditCommand: `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
    },
    commands: [
      `pnpm pilot:support-readiness -- ${supportEvidencePath}`,
      `pnpm license:validate -- ${licenseEvidencePath} --public-key ${publicKeyPath}`,
      `pnpm pilot:distribution-evidence -- ${distributionEvidencePath}`,
      `pnpm pilot:pricing-evidence -- ${pricingEvidencePath}`,
      `pnpm pilot:marketing-evidence -- ${marketingEvidencePath}`,
      `pnpm pilot:commercial-readiness -- ${commercialReadinessPath} --public-key ${publicKeyPath}`,
      "pnpm pilot:evidence-repo-guard",
      `pnpm pilot:evidence-filing-plan -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    checks: CHECKS.map((check) => ({ ...check })),
    phiRules: [
      "Do not include patient names, chart numbers, phone numbers, real clinic pricing, raw screenshots, DBF/SQLite rows, or local paths.",
      "Reference internal approval records by support-safe ticket/document ID, not by local filesystem path.",
      "Keep signed licenses, screenshots, marketing packets, and raw approval exports outside `qa-runs/`; file metadata and summaries only.",
      "Do not mark commercial readiness ready until package verification, field, signing, installer, update, support, distribution, pricing, marketing, licensing, pilot, and go-live evidence all validate.",
    ],
  };
}

export function renderCommercialLaunchPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern commercial launch readiness packet",
    "",
    `**Date:** ${packet.date}`,
    `**Clinic/device label:** ${packet.clinicLabel}`,
    `**Status:** ${packet.status}`,
    "",
    "This packet is PHI-safe and does not make the product commercially ready. Use it to coordinate package verification, field references, support, licensing, distribution, pricing, marketing, and commercial readiness evidence before final go-live review.",
    "",
    "## Evidence Targets",
    "",
    `- Support readiness evidence: \`${packet.evidenceTargets.supportEvidencePath}\``,
    `- Offline license evidence: \`${packet.evidenceTargets.licenseEvidencePath}\``,
    `- Distribution evidence: \`${packet.evidenceTargets.distributionEvidencePath}\``,
    `- Pricing evidence: \`${packet.evidenceTargets.pricingEvidencePath}\``,
    `- Marketing evidence: \`${packet.evidenceTargets.marketingEvidencePath}\``,
    `- Commercial readiness evidence: \`${packet.evidenceTargets.commercialReadinessPath}\``,
    "",
    "## Validation Commands",
    "",
    "```bash",
    ...packet.commands,
    packet.evidenceTargets.commercialStatusCommand,
    packet.evidenceTargets.completionAuditCommand,
    "```",
    "",
    "## PHI And Commercial Rules",
    "",
    ...packet.phiRules.map((rule) => `- ${rule}`),
    "",
    "## Checklist",
    "",
    "| Check | Phase | Action | PHI-safe evidence to record |",
    "| --- | --- | --- | --- |",
    ...packet.checks.map((check) => `| \`${check.id}\` | ${check.phase} | ${check.action} | ${check.evidence} |`),
    "",
    "## Filing Order",
    "",
    "1. File support readiness evidence after support KB, issue workflow, rollback, and training are signed off.",
    "2. File signed offline license evidence and validate it with the public key.",
    "3. File distribution, pricing, and marketing evidence from approved support-safe records.",
    "4. Run commercial evidence status to find missing or invalid evidence families.",
    "5. File commercial readiness evidence only after every referenced report exists and validates.",
    "6. Keep roadmap completion blocked until package verification evidence, real Windows field evidence referencing it with packageVerification.evidencePath, and final commercial readiness evidence are filed.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/commercial-launch-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--clinic-label CLINIC-PC-01] [--public-key keys/microdent-license-public.pem]

Generates a PHI-safe commercial launch readiness packet. It does not create
evidence JSON, approve commercial readiness, or replace real external evidence.
`);
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    write: false,
    writePath: undefined,
    date: todayIso(),
    clinicLabel: DEFAULT_CLINIC_LABEL,
    publicKeyPath: "keys/microdent-license-public.pem",
    help: false,
  };
  const args = argv.slice(2).filter((arg) => arg !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--write") {
      parsed.write = true;
      const next = args[index + 1];
      if (next && !next.startsWith("--")) {
        parsed.writePath = next;
        index += 1;
      }
    } else if (arg === "--date") {
      parsed.date = args[index + 1];
      index += 1;
    } else if (arg === "--clinic-label") {
      parsed.clinicLabel = args[index + 1];
      index += 1;
    } else if (arg === "--public-key") {
      parsed.publicKeyPath = args[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[commercial-launch-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }
  const packet = buildCommercialLaunchPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderCommercialLaunchPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath ?? join("qa-runs", `${parsed.date}-commercial-launch-packet-${parsed.clinicLabel}.md`);
    const abs = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, output, "utf8");
    console.log(`[commercial-launch-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
