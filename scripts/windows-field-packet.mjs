#!/usr/bin/env node
/**
 * Windows field execution packet generator.
 *
 * This does not prove a field run. It generates a PHI-safe checklist with
 * target evidence filenames and validation commands so EXEC-01 through EXEC-16
 * can be captured consistently on a real Windows clinic machine.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXEC_STEPS } from "./windows-field-evidence.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CLINIC_LABEL = "CLINIC-PC-01";

const STEP_DETAILS = [
  {
    id: "EXEC-01",
    action: "Verify bundled Node 22+ or approved fallback Node 22+ on the clinic PC.",
    evidence: "Record Node/runtime version from the package manifest or `node -v`; do not paste full environment dumps.",
  },
  {
    id: "EXEC-02",
    action: "Extract or install the package and verify the expected layout.",
    evidence: "Record that root files, `app/`, `bridge/`, `web/`, `docs/`, and manifest files are present.",
  },
  {
    id: "EXEC-03",
    action: "Run first-run setup.",
    evidence: "Record that the desktop opened setup and completed without a blank panel or crash.",
  },
  {
    id: "EXEC-04",
    action: "Choose copied clinic data folder and derived paths.",
    evidence: "Record only sanitized path categories and whether data/local-copy/backup paths are outside the app folder.",
  },
  {
    id: "EXEC-05",
    action: "Confirm automatic local-copy import.",
    evidence: "Record import status, table counts if already summarized by the app, and elapsed time; do not paste DBF rows.",
  },
  {
    id: "EXEC-06",
    action: "Run read-only smoke for Today, Patients, Schedule, and Settings.",
    evidence: "Record each screen loaded and whether operator-safe empty/error states appeared.",
  },
  {
    id: "EXEC-07",
    action: "Verify clinic service health.",
    evidence: "Record Settings service status and port health only; do not paste raw config JSON.",
  },
  {
    id: "EXEC-08",
    action: "Enable sandbox writes only in a disposable sandbox.",
    evidence: "Record sandbox label and write-mode status; never point evidence at live legacy data.",
  },
  {
    id: "EXEC-09",
    action: "Test appointment status update.",
    evidence: "Record operation id and DBF readback confirmation without patient, phone, or chart values.",
  },
  {
    id: "EXEC-10",
    action: "Test appointment time move.",
    evidence: "Record operation id, before/after time category, and readback confirmation without patient identifiers.",
  },
  {
    id: "EXEC-11",
    action: "Test appointment creation.",
    evidence: "Record operation id, synthetic appointment label, and readback confirmation.",
  },
  {
    id: "EXEC-12",
    action: "Test demographics update.",
    evidence: "Record operation id and synthetic-only changed field names; do not include names, phone numbers, or chart numbers.",
  },
  {
    id: "EXEC-13",
    action: "Verify backup before writes.",
    evidence: "Record backup id/location class and restore eligibility; do not attach archive files to the repo.",
  },
  {
    id: "EXEC-14",
    action: "Verify DBF readback proof.",
    evidence: "Record sanitized readback result for each write workflow, not raw DBF payloads.",
  },
  {
    id: "EXEC-15",
    action: "Verify restore workflow.",
    evidence: "Record restore command/result and post-restore app status; may be `na` only with IT-approved reason.",
  },
  {
    id: "EXEC-16",
    action: "Complete field result form and sign-off.",
    evidence: "Record approver roles, date, issue summary path, and attachment manifest reference.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function assertStepCoverage() {
  const ids = STEP_DETAILS.map((step) => step.id);
  const missing = EXEC_STEPS.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !EXEC_STEPS.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`windows field packet step mismatch: missing=${missing.join(",")} extra=${extra.join(",")}`);
  }
}

export function buildWindowsFieldPacket({
  date = todayIso(),
  clinicLabel = DEFAULT_CLINIC_LABEL,
  publicKeyPath = "keys/microdent-license-public.pem",
} = {}) {
  assertStepCoverage();
  const attachmentManifestPath = `qa-runs/${date}-evidence-attachment-manifest-${clinicLabel}.json`;
  const packageVerifyEvidencePath = `qa-runs/${date}-windows-package-verify-evidence-${clinicLabel}.json`;
  const fieldEvidencePath = `qa-runs/${date}-windows-field-evidence-${clinicLabel}.json`;
  const compatibilityEvidencePath = `qa-runs/${date}-windows-compatibility-evidence.json`;
  return {
    date,
    clinicLabel,
    status: "blocked-until-field-run",
    evidenceTargets: {
      attachmentManifestPath,
      packageVerifyEvidencePath,
      fieldEvidencePath,
      compatibilityEvidencePath,
      commercialStatusCommand: `pnpm pilot:commercial-evidence-status -- --public-key ${publicKeyPath}`,
      completionAuditCommand: `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
    },
    commands: [
      "pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip",
      `pnpm pilot:package-verify-evidence -- ${packageVerifyEvidencePath}`,
      `pnpm pilot:attachment-manifest -- ${attachmentManifestPath}`,
      "pnpm pilot:evidence-repo-guard",
      `pnpm pilot:field-evidence -- ${fieldEvidencePath}`,
      `pnpm pilot:windows-compatibility -- ${compatibilityEvidencePath}`,
      `pnpm pilot:evidence-filing-plan -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    steps: STEP_DETAILS.map((step) => ({ ...step })),
    phiRules: [
      "Do not paste patient names, chart numbers, phone numbers, comments, or raw DBF/SQLite rows.",
      "Keep raw screenshots, PDFs, logs, archives, and DBF/SQLite files outside the repository.",
      "Use the attachment manifest for redacted attachment metadata and secure tracker references.",
      "Intake returned `MicrodentModern-safe-results.zip` with `pnpm pilot:intake-safe-results`; read-only smoke stays `READ_ONLY_READY` and does not prove sandbox signoff or go-live.",
      "Run the repository guard before committing or sharing the evidence bundle.",
    ],
  };
}

export function renderWindowsFieldPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern Windows field execution packet",
    "",
    `**Date:** ${packet.date}`,
    `**Clinic/device label:** ${packet.clinicLabel}`,
    `**Status:** ${packet.status}`,
    "",
    "This packet is PHI-safe and does not prove field execution by itself. Fill it from a real Windows clinic-machine run, then file the evidence JSON reports and validator outputs.",
    "",
    "## Evidence Targets",
    "",
    `- Attachment manifest: \`${packet.evidenceTargets.attachmentManifestPath}\``,
    `- Package verification evidence: \`${packet.evidenceTargets.packageVerifyEvidencePath}\``,
    `- Windows field evidence: \`${packet.evidenceTargets.fieldEvidencePath}\``,
    `- Windows compatibility evidence: \`${packet.evidenceTargets.compatibilityEvidencePath}\``,
    "",
    "## Validation Commands",
    "",
    "```bash",
    ...packet.commands,
    packet.evidenceTargets.commercialStatusCommand,
    packet.evidenceTargets.completionAuditCommand,
    "```",
    "",
    "## PHI Rules",
    "",
    ...packet.phiRules.map((rule) => `- ${rule}`),
    "",
    "## EXEC Checklist",
    "",
    "| Step | Action | PHI-safe evidence to record |",
    "| --- | --- | --- |",
    ...packet.steps.map((step) => `| \`${step.id}\` | ${step.action} | ${step.evidence} |`),
    "",
    "## Filing Order",
    "",
    "1. Intake the returned read-only smoke bundle with `pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip` if the operator used the double-click helper.",
    "2. Redact/store screenshots and long notes in the secure internal tracker.",
    "3. Copy `qa-runs/TEMPLATE-windows-package-verify-evidence.json` to the target package verification path and validate it before field execution.",
    "4. Copy `qa-runs/TEMPLATE-evidence-attachment-manifest.json` to the target attachment manifest path and fill metadata only.",
    "5. Copy `qa-runs/TEMPLATE-windows-field-evidence.json` to the target field evidence path, set `packageVerification.evidencePath`, and summarize EXEC-01 through EXEC-16.",
    "6. Copy `qa-runs/TEMPLATE-windows-compatibility-evidence.json` to the target compatibility path after Windows 10/11 and endpoint checks.",
    "7. Run every command above and keep `ROADMAP COMPLETION: BLOCKED` until all commercial evidence is real and filed.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/windows-field-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--clinic-label CLINIC-PC-01] [--public-key keys/microdent-license-public.pem]

Generates a PHI-safe Windows field execution packet. It does not create field
evidence JSON and does not prove Windows execution.
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
    console.error(`[windows-field-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }
  const packet = buildWindowsFieldPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderWindowsFieldPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath
      ?? join("qa-runs", `${parsed.date}-windows-field-packet-${parsed.clinicLabel}.md`);
    const abs = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, output, "utf8");
    console.log(`[windows-field-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
