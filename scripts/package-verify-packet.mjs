#!/usr/bin/env node
/**
 * Windows staged-package verification packet generator.
 *
 * This does not prove Windows execution or commercial readiness. It creates a
 * PHI-safe checklist for IT to verify the staged portable package on Windows
 * before operators start the field run.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CLINIC_LABEL = "CLINIC-PC-01";
const DEFAULT_PACKAGE_PATH = "C:\\Microdent\\MicrodentModern";
const DEFAULT_PUBLIC_KEY = "keys/microdent-license-public.pem";

const CHECKS = [
  {
    id: "PKG-01",
    phase: "Layout",
    action: "Confirm the staged package root contains start/handoff docs, release manifest, app, bridge, web, docs, config templates, and placeholder folders.",
    evidence: "Record pass/fail and missing relative paths only; do not attach directory listings with user profiles or clinic paths.",
  },
  {
    id: "PKG-02",
    phase: "Manifest",
    action: "Open RELEASE-MANIFEST.json and record packageVersion, releaseChannel, appVersion, gitCommit, and unsupportedFeatures.",
    evidence: "Record manifest fields only; stop if developer paths, clinic paths, secrets, or patient data appear.",
  },
  {
    id: "PKG-03",
    phase: "Forbidden artifacts",
    action: "Search for forbidden DBF, SQLite, env, log, archive, installer, and unexpected executable artifacts in the staged tree.",
    evidence: "Record PASS/FAIL and relative file names if found; keep raw artifacts out of the repo.",
  },
  {
    id: "PKG-04",
    phase: "Config placeholders",
    action: "Verify config-templates files contain generic Windows examples only.",
    evidence: "Record PASS/FAIL for placeholders, no developer home paths, no real clinic identifiers, and no in-place operator config edits.",
  },
  {
    id: "PKG-05",
    phase: "Runtime placeholder",
    action: "Confirm node/ contains only the README placeholder or a validated runtime plus RUNTIME-MANIFEST.json.",
    evidence: "Record whether bundled runtime is absent, placeholder-only, or validated; do not record full local paths.",
  },
  {
    id: "PKG-06",
    phase: "Build metadata",
    action: "Compare web/pilot-build.json against RELEASE-MANIFEST.json.",
    evidence: "Record matching appVersion, packageVersion, releaseChannel, gitCommit, and buildTimestampUtc summary.",
  },
  {
    id: "PKG-07",
    phase: "Operator handoff",
    action: "Confirm PILOT-START-HERE.md points operators to package verification, first-run setup, field execution, support, and PHI-safe evidence rules.",
    evidence: "Record PASS/FAIL and the doc version/commit; do not include screenshots with clinic data.",
  },
  {
    id: "PKG-08",
    phase: "Decision",
    action: "Make an IT package decision before field execution starts.",
    evidence: "Record PASS, FAIL, or CONDITIONAL with approver role, date, and secure tracker reference for any raw attachments.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildPackageVerifyPacket({
  date = todayIso(),
  clinicLabel = DEFAULT_CLINIC_LABEL,
  packagePath = DEFAULT_PACKAGE_PATH,
  publicKeyPath = DEFAULT_PUBLIC_KEY,
} = {}) {
  const packagePacketPath = `qa-runs/${date}-windows-package-verify-packet-${clinicLabel}.md`;
  const packageEvidencePath = `qa-runs/${date}-windows-package-verify-evidence-${clinicLabel}.json`;
  const attachmentManifestPath = `qa-runs/${date}-evidence-attachment-manifest-${clinicLabel}.json`;
  const fieldPacketPath = `qa-runs/${date}-windows-field-packet-${clinicLabel}.md`;
  return {
    date,
    clinicLabel,
    packagePath,
    status: "blocked-until-windows-package-verified",
    packetTargets: {
      packagePacketPath,
      packageEvidencePath,
      attachmentManifestPath,
      fieldPacketPath,
    },
    commands: [
      `pnpm pilot:package-verify-evidence -- ${packageEvidencePath}`,
      `pnpm pilot:attachment-manifest -- ${attachmentManifestPath}`,
      "pnpm pilot:evidence-repo-guard",
      `pnpm pilot:windows-field-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath} --write ${fieldPacketPath}`,
      `pnpm pilot:evidence-filing-plan -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
      `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
    ],
    checks: CHECKS.map((check) => ({ ...check })),
    phiRules: [
      "Do not commit raw screenshots, PowerShell transcripts, installer binaries, archives, DBF/SQLite files, or support logs.",
      "Record relative staged-package paths only; avoid Windows usernames, mapped drives, and real clinic folder names.",
      "If IT needs screenshots or logs, store them in the approved secure tracker and reference them through the attachment manifest.",
      "This packet verifies handoff-package hygiene only; Windows field evidence must reference this package proof with packageVerification.evidencePath, and commercial readiness must remain blocked until all real evidence files validate.",
    ],
  };
}

export function renderPackageVerifyPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern Windows package verification packet",
    "",
    `**Date:** ${packet.date}`,
    `**Clinic/device label:** ${packet.clinicLabel}`,
    `**Package path to verify:** \`${packet.packagePath}\``,
    `**Status:** ${packet.status}`,
    "",
    "This packet is PHI-safe and does not prove the app works on Windows by itself. Use it before the field execution packet to confirm the staged portable package is safe to hand to operators.",
    "",
    "## Source Procedure",
    "",
    "- Follow `docs/windows-pilot-package-verify-on-windows.md` from the staged package.",
    "- Record only package hygiene and version evidence in this packet.",
    "- Continue to the Windows field execution packet only after the package decision is PASS or IT-approved CONDITIONAL.",
    "",
    "## Packet Targets",
    "",
    `- Package verification packet: \`${packet.packetTargets.packagePacketPath}\``,
    `- Package verification evidence: \`${packet.packetTargets.packageEvidencePath}\``,
    `- Attachment manifest: \`${packet.packetTargets.attachmentManifestPath}\``,
    `- Follow-up Windows field packet: \`${packet.packetTargets.fieldPacketPath}\``,
    "",
    "## Follow-Up Commands",
    "",
    "```bash",
    ...packet.commands,
    "```",
    "",
    "## PHI And Artifact Rules",
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
    "1. Extract or copy the staged package to the Windows handoff PC.",
    "2. Follow `docs/windows-pilot-package-verify-on-windows.md` from inside the package.",
    "3. Copy `qa-runs/TEMPLATE-windows-package-verify-evidence.json` to the target package evidence path and fill it from the real IT verification.",
    "4. File raw attachments only in the secure tracker and reference them through the attachment manifest.",
    "5. Run the package evidence validator and keep it blocked until every package hygiene check is real.",
    "6. Generate and run the Windows field execution packet only after package verification is complete.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/package-verify-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--clinic-label CLINIC-PC-01] [--package-path "C:\\Microdent\\MicrodentModern"] [--public-key keys/microdent-license-public.pem]

Generates a PHI-safe Windows staged-package verification packet. It does not
create field evidence JSON, prove Windows execution, or approve readiness.
`);
}

function readValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    write: false,
    writePath: undefined,
    date: todayIso(),
    clinicLabel: DEFAULT_CLINIC_LABEL,
    packagePath: DEFAULT_PACKAGE_PATH,
    publicKeyPath: DEFAULT_PUBLIC_KEY,
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
      parsed.date = readValue(args, index, "--date");
      index += 1;
    } else if (arg === "--clinic-label") {
      parsed.clinicLabel = readValue(args, index, "--clinic-label");
      index += 1;
    } else if (arg === "--package-path") {
      parsed.packagePath = readValue(args, index, "--package-path");
      index += 1;
    } else if (arg === "--public-key") {
      parsed.publicKeyPath = readValue(args, index, "--public-key");
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
    console.error(`[package-verify-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }
  const packet = buildPackageVerifyPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderPackageVerifyPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath ?? packet.packetTargets.packagePacketPath;
    const abs = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, output, "utf8");
    console.log(`[package-verify-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
