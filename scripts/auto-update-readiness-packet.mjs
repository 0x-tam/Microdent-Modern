#!/usr/bin/env node
/**
 * Auto-update readiness packet generator.
 *
 * This does not implement or enable an updater. It generates a PHI-safe
 * checklist for signed update-channel, update install, rollback, offline
 * recovery, and privacy evidence once a real update path exists.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CHECKS = [
  {
    id: "UPD-01",
    phase: "Channel",
    action: "Choose and document update channel.",
    evidence: "Record `manual-it-redeploy`, `internal-signed-feed`, or `hosted-signed-feed`, access control, and support-safe feed label.",
  },
  {
    id: "UPD-02",
    phase: "Payload",
    action: "Verify signed update payload identity.",
    evidence: "Record relative payload path, SHA-256 hash, signed-artifact evidence path, and signed=true.",
  },
  {
    id: "UPD-03",
    phase: "Update install",
    action: "Install update from older pilot package to newer pilot package on Windows.",
    evidence: "Record machine label, Windows version, from/to package versions, app launch, and preserved config/local-copy/backup state.",
  },
  {
    id: "UPD-04",
    phase: "Rollback",
    action: "Prove rollback from failed or rejected update.",
    evidence: "Record rollback route, restored previous version, and preserved operator data without attaching raw logs.",
  },
  {
    id: "UPD-05",
    phase: "Offline recovery",
    action: "Document recovery when the clinic PC is offline or feed is unreachable.",
    evidence: "Record operator/support action, previous installer/package availability, and app behavior while offline.",
  },
  {
    id: "UPD-06",
    phase: "Privacy",
    action: "Review update checks for data leaving the clinic machine.",
    evidence: "Confirm no PHI, local paths, DBF/SQLite rows, crash dumps, or config JSON are uploaded by update checks.",
  },
  {
    id: "UPD-07",
    phase: "Operator notice",
    action: "Prepare operator-facing update notice.",
    evidence: "Record notice text/location and whether restart behavior is clearly explained.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildAutoUpdateReadinessPacket({
  date = todayIso(),
  channel = "internal-signed-feed",
  publicKeyPath = "keys/microdent-license-public.pem",
} = {}) {
  const signedArtifactEvidencePath = `qa-runs/${date}-signed-artifact-evidence.json`;
  const autoUpdateEvidencePath = `qa-runs/${date}-auto-update-evidence.json`;
  return {
    date,
    channel,
    status: "blocked-until-signed-update-channel",
    evidenceTargets: {
      signedArtifactEvidencePath,
      autoUpdateEvidencePath,
      commercialStatusCommand: `pnpm pilot:commercial-evidence-status -- --public-key ${publicKeyPath}`,
      completionAuditCommand: `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
    },
    commands: [
      `pnpm pilot:signed-artifacts -- ${signedArtifactEvidencePath}`,
      `pnpm pilot:auto-update-evidence -- ${autoUpdateEvidencePath}`,
      "pnpm pilot:evidence-repo-guard",
      `pnpm pilot:evidence-filing-plan -- --date ${date} --public-key ${publicKeyPath}`,
    ],
    checks: CHECKS.map((check) => ({ ...check })),
    phiRules: [
      "Do not paste raw update logs, Event Viewer exports, local user paths, DBF/SQLite rows, or config JSON.",
      "Use support-safe feed labels instead of private URLs or credentials.",
      "Keep update payloads, screenshots, logs, and archives out of `qa-runs/`; file metadata and hashes only.",
      "Do not mark commercial readiness ready until update evidence, installer evidence, and signing evidence all validate.",
    ],
  };
}

export function renderAutoUpdateReadinessPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern auto-update readiness packet",
    "",
    `**Date:** ${packet.date}`,
    `**Channel:** ${packet.channel}`,
    `**Status:** ${packet.status}`,
    "",
    "This packet is PHI-safe and does not implement or enable auto-update. Use it only after a real signed update channel or manual redeploy update path exists.",
    "",
    "## Evidence Targets",
    "",
    `- Signed artifact evidence: \`${packet.evidenceTargets.signedArtifactEvidencePath}\``,
    `- Auto-update evidence: \`${packet.evidenceTargets.autoUpdateEvidencePath}\``,
    "",
    "## Validation Commands",
    "",
    "```bash",
    ...packet.commands,
    packet.evidenceTargets.commercialStatusCommand,
    packet.evidenceTargets.completionAuditCommand,
    "```",
    "",
    "## PHI And Update Rules",
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
    "1. Choose the real update channel and update payload outside this packet workflow.",
    "2. Sign the update payload and file signed-artifact evidence.",
    "3. Fill `qa-runs/TEMPLATE-auto-update-evidence.json` from update install, rollback, offline recovery, restart, and privacy checks.",
    "4. Run the commands above and keep commercial readiness blocked until every referenced evidence file is real and ready.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/auto-update-readiness-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--channel manual-it-redeploy|internal-signed-feed|hosted-signed-feed] [--public-key keys/microdent-license-public.pem]

Generates a PHI-safe auto-update readiness packet. It does not create update
evidence JSON, implement update checks, or enable network update behavior.
`);
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    write: false,
    writePath: undefined,
    date: todayIso(),
    channel: "internal-signed-feed",
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
    } else if (arg === "--channel") {
      parsed.channel = args[index + 1];
      index += 1;
    } else if (arg === "--public-key") {
      parsed.publicKeyPath = args[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!/^(manual-it-redeploy|internal-signed-feed|hosted-signed-feed)$/i.test(parsed.channel)) {
    throw new Error("--channel must be manual-it-redeploy, internal-signed-feed, or hosted-signed-feed");
  }
  return parsed;
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`[auto-update-readiness-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }
  const packet = buildAutoUpdateReadinessPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderAutoUpdateReadinessPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath ?? join("qa-runs", `${parsed.date}-auto-update-readiness-packet.md`);
    const abs = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, output, "utf8");
    console.log(`[auto-update-readiness-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
