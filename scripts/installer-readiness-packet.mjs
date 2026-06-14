#!/usr/bin/env node
/**
 * Signed installer readiness packet generator.
 *
 * This does not build, sign, or validate an installer. It generates a PHI-safe
 * checklist that coordinates Authenticode and installer behavior evidence once
 * a real NSIS/MSI candidate exists.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHECKS = [
  {
    id: "SIGN-01",
    phase: "Signing",
    action: "Verify Authenticode certificate identity, chain, and validity dates.",
    evidence: "Record subject, issuer, SHA-256 thumbprint, validity dates, and chain status in signed-artifact evidence.",
  },
  {
    id: "SIGN-02",
    phase: "Signing",
    action: "Verify signed app executable.",
    evidence: "Record relative app executable path, SHA-256 hash, `signtool verify /pa /tw`, publisher, timestamp, and summary.",
  },
  {
    id: "SIGN-03",
    phase: "Signing",
    action: "Verify signed installer artifact.",
    evidence: "Record relative installer path, SHA-256 hash, `signtool verify /pa /tw`, publisher, timestamp, and summary.",
  },
  {
    id: "SIGN-04",
    phase: "Signing",
    action: "Record SmartScreen or reputation review.",
    evidence: "Summarize review/submission status without raw local paths or user names.",
  },
  {
    id: "INST-01",
    phase: "Installer",
    action: "Run clean install on Windows 10 or Windows 11.",
    evidence: "Record machine label, Windows version, install target, Add/Remove Programs entry, shortcut, first-run setup, and app launch.",
  },
  {
    id: "INST-02",
    phase: "Installer",
    action: "Run upgrade install over an older candidate.",
    evidence: "Record preserved config/local-copy/backup locations and successful app launch after upgrade.",
  },
  {
    id: "INST-03",
    phase: "Installer",
    action: "Run uninstall.",
    evidence: "Record app removal and confirm operator data, local copy, backups, and config are preserved unless explicitly removed.",
  },
  {
    id: "INST-04",
    phase: "Installer",
    action: "Verify data boundaries.",
    evidence: "Confirm clinic data, mirror SQLite, backups, logs, and config stay outside the install tree.",
  },
  {
    id: "INST-05",
    phase: "Installer",
    action: "Verify rollback installer availability.",
    evidence: "Record relative rollback artifact path/hash or approved rollback channel reference.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildInstallerReadinessPacket({
  date = todayIso(),
  installerTarget = "nsis",
  publicKeyPath = "keys/microdent-license-public.pem",
} = {}) {
  const signedArtifactEvidencePath = `qa-runs/${date}-signed-artifact-evidence.json`;
  const installerEvidencePath = `qa-runs/${date}-installer-evidence.json`;
  return {
    date,
    installerTarget,
    status: "blocked-until-signed-installer-candidate",
    evidenceTargets: {
      signedArtifactEvidencePath,
      installerEvidencePath,
      commercialStatusCommand: `pnpm pilot:commercial-evidence-status -- --public-key ${publicKeyPath}`,
      completionAuditCommand: `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
    },
    commands: [
      `pnpm pilot:signed-artifacts -- ${signedArtifactEvidencePath}`,
      `pnpm pilot:installer-evidence -- ${installerEvidencePath}`,
      "pnpm pilot:evidence-repo-guard",
      `pnpm pilot:evidence-filing-plan -- --date ${date} --public-key ${publicKeyPath}`,
    ],
    checks: CHECKS.map((check) => ({ ...check })),
    phiRules: [
      "Do not paste raw signtool, installer, or Windows Event Viewer logs if they contain local user paths.",
      "Use relative artifact paths such as `installer/MicrodentModernSetup.exe`.",
      "Keep installer logs, screenshots, and signed binaries out of `qa-runs/`; file metadata and hashes only.",
      "Do not mark commercial readiness ready until signed-artifact and installer evidence both validate.",
    ],
  };
}

export function renderInstallerReadinessPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern signed installer readiness packet",
    "",
    `**Date:** ${packet.date}`,
    `**Installer target:** ${packet.installerTarget}`,
    `**Status:** ${packet.status}`,
    "",
    "This packet is PHI-safe and does not build, sign, or validate an installer by itself. Use it once a real NSIS/MSI candidate and Authenticode certificate are available.",
    "",
    "## Evidence Targets",
    "",
    `- Signed artifact evidence: \`${packet.evidenceTargets.signedArtifactEvidencePath}\``,
    `- Installer behavior evidence: \`${packet.evidenceTargets.installerEvidencePath}\``,
    "",
    "## Validation Commands",
    "",
    "```bash",
    ...packet.commands,
    packet.evidenceTargets.commercialStatusCommand,
    packet.evidenceTargets.completionAuditCommand,
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
    "1. Build the real installer candidate outside this packet workflow.",
    "2. Sign the app executable and installer with the approved Authenticode certificate.",
    "3. Fill `qa-runs/TEMPLATE-signed-artifact-evidence.json` from Windows `signtool` verification summaries.",
    "4. Fill `qa-runs/TEMPLATE-installer-evidence.json` from clean install, upgrade, uninstall, data-boundary, and rollback checks.",
    "5. Run the commands above and keep commercial readiness blocked until every referenced evidence file is real and ready.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/installer-readiness-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--target nsis|msi] [--public-key keys/microdent-license-public.pem]

Generates a PHI-safe signed installer readiness packet. It does not create
installer evidence JSON, build installers, or sign artifacts.
`);
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    write: false,
    writePath: undefined,
    date: todayIso(),
    installerTarget: "nsis",
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
    } else if (arg === "--target") {
      parsed.installerTarget = args[index + 1];
      index += 1;
    } else if (arg === "--public-key") {
      parsed.publicKeyPath = args[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!/^(nsis|msi)$/i.test(parsed.installerTarget)) {
    throw new Error("--target must be nsis or msi");
  }
  return parsed;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[installer-readiness-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }
  const packet = buildInstallerReadinessPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderInstallerReadinessPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath ?? join("qa-runs", `${parsed.date}-installer-readiness-packet.md`);
    const abs = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, output, "utf8");
    console.log(`[installer-readiness-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
