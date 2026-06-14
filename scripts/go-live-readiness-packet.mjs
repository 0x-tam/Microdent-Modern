#!/usr/bin/env node
/**
 * Go-live readiness packet generator.
 *
 * This does not approve launch. It generates a PHI-safe final commercial
 * readiness checklist that ties field evidence, clinic pilot report, support
 * readiness, commercial readiness, and go-live approval evidence together.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CLINIC_LABEL = "CLINIC-PC-01";

const CHECKS = [
  {
    id: "LIVE-01",
    phase: "Field evidence",
    action: "Confirm package verification evidence and completed sandbox-signoff Windows field evidence are filed.",
    evidence: "Reference the non-template package verification JSON, Windows field evidence JSON with packageVerification.evidencePath, and reviewed attachment manifest.",
  },
  {
    id: "LIVE-02",
    phase: "Clinic pilot",
    action: "Confirm clinic pilot report is filed after issue triage.",
    evidence: "Reference clinic pilot report JSON and pilot feedback triage rollup; P0/P1 counts must be zero.",
  },
  {
    id: "LIVE-03",
    phase: "Support",
    action: "Confirm support readiness evidence is filed.",
    evidence: "Reference support readiness evidence covering KB, issue workflow, rollback runbook, training, and safe evidence handling.",
  },
  {
    id: "LIVE-04",
    phase: "Commercial bundle",
    action: "Confirm commercial readiness evidence validates every referenced report.",
    evidence: "Run commercial evidence status and commercial readiness with public-key verification.",
  },
  {
    id: "LIVE-05",
    phase: "Rollback",
    action: "Confirm rollback path is ready for installer/update/support scenarios.",
    evidence: "Reference support, installer, update, and go-live evidence rows instead of attaching raw logs or archives.",
  },
  {
    id: "LIVE-06",
    phase: "Approval",
    action: "Record final go/no-go approvers.",
    evidence: "Record IT lead, pilot sponsor, and support lead roles/dates in go-live evidence.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildGoLiveReadinessPacket({
  date = todayIso(),
  clinicLabel = DEFAULT_CLINIC_LABEL,
  publicKeyPath = "keys/microdent-license-public.pem",
} = {}) {
  const fieldEvidencePath = `qa-runs/${date}-windows-field-evidence-${clinicLabel}.json`;
  const clinicPilotReportPath = `qa-runs/${date}-clinic-pilot-report-${clinicLabel}.json`;
  const triageRollupPath = `qa-runs/${date}-pilot-feedback-triage.md`;
  const supportEvidencePath = `qa-runs/${date}-support-readiness-evidence.json`;
  const commercialReadinessPath = `qa-runs/${date}-commercial-readiness-evidence.json`;
  const goLiveEvidencePath = `qa-runs/${date}-go-live-evidence.json`;
  return {
    date,
    clinicLabel,
    status: "blocked-until-real-pilot-and-approvals",
    evidenceTargets: {
      fieldEvidencePath,
      clinicPilotReportPath,
      triageRollupPath,
      supportEvidencePath,
      commercialReadinessPath,
      goLiveEvidencePath,
      commercialStatusCommand: `pnpm pilot:commercial-evidence-status -- --public-key ${publicKeyPath}`,
      completionAuditCommand: `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
    },
    commands: [
      `pnpm pilot:field-evidence -- ${fieldEvidencePath}`,
      `pnpm pilot:clinic-report -- ${clinicPilotReportPath}`,
      `pnpm pilot:support-readiness -- ${supportEvidencePath}`,
      `pnpm pilot:commercial-readiness -- ${commercialReadinessPath} --public-key ${publicKeyPath}`,
      `pnpm pilot:go-live-evidence -- ${goLiveEvidencePath}`,
      "pnpm pilot:evidence-repo-guard",
      `pnpm pilot:evidence-filing-plan -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    checks: CHECKS.map((check) => ({ ...check })),
    phiRules: [
      "Do not include patient names, chart numbers, phone numbers, screenshots, DBF/SQLite rows, or raw logs.",
      "Use clinic/device labels such as `CLINIC-PC-01`; do not use staff or patient names.",
      "Keep raw attachments, issue exports, and signed approvals outside `qa-runs/`; file metadata and support-safe summaries only.",
      "Do not mark go-live ready while package verification evidence, field evidence, commercial readiness, clinic pilot, support readiness, or approvals are blocked.",
      "Prepare commercial readiness and go-live evidence together at the final gate so their cross-references match; validate commercial readiness/status with the public key for offline license proof.",
    ],
  };
}

export function renderGoLiveReadinessPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern go-live readiness packet",
    "",
    `**Date:** ${packet.date}`,
    `**Clinic/device label:** ${packet.clinicLabel}`,
    `**Status:** ${packet.status}`,
    "",
    "This packet is PHI-safe and does not approve launch. Use it after real package verification evidence, field evidence referencing it, clinic pilot outcomes, support readiness, and commercial evidence are available.",
    "",
    "## Evidence Targets",
    "",
    `- Windows field evidence: \`${packet.evidenceTargets.fieldEvidencePath}\``,
    `- Clinic pilot report: \`${packet.evidenceTargets.clinicPilotReportPath}\``,
    `- Pilot feedback triage rollup: \`${packet.evidenceTargets.triageRollupPath}\``,
    `- Support readiness evidence: \`${packet.evidenceTargets.supportEvidencePath}\``,
    `- Commercial readiness evidence: \`${packet.evidenceTargets.commercialReadinessPath}\``,
    `- Go-live evidence: \`${packet.evidenceTargets.goLiveEvidencePath}\``,
    "",
    "## Validation Commands",
    "",
    "```bash",
    ...packet.commands,
    packet.evidenceTargets.commercialStatusCommand,
    packet.evidenceTargets.completionAuditCommand,
    "```",
    "",
    "## PHI And Approval Rules",
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
    "1. File and validate package verification evidence, then Windows field evidence with `packageVerification.evidencePath`, plus attachment manifest.",
    "2. File pilot feedback triage rollup and clinic pilot report after issues are triaged.",
    "3. File support readiness evidence and every remaining commercial evidence family.",
    "4. Prepare commercial readiness and go-live evidence together after referenced reports validate, so `commercialReadinessPath` and `goLiveEvidencePath` point at the final non-template JSON files.",
    "5. Validate commercial readiness/status with `--public-key` for offline license proof, then validate go-live evidence so its referenced files are checked.",
    "6. Keep commercial readiness blocked until every command above is real and ready.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/go-live-readiness-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--clinic-label CLINIC-PC-01] [--public-key keys/microdent-license-public.pem]

Generates a PHI-safe go-live readiness packet. It does not create evidence JSON,
approve launch, or replace real clinic pilot/support/commercial evidence.
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
    console.error(`[go-live-readiness-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }
  const packet = buildGoLiveReadinessPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderGoLiveReadinessPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath ?? join("qa-runs", `${parsed.date}-go-live-readiness-packet-${parsed.clinicLabel}.md`);
    const abs = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, output, "utf8");
    console.log(`[go-live-readiness-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
