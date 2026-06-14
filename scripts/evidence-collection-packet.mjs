#!/usr/bin/env node
/**
 * Master evidence collection packet.
 *
 * This coordinates the PHI-safe packet generators and final audit commands. It
 * does not create evidence JSON, prove Windows execution, or approve launch.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CLINIC_LABEL = "CLINIC-PC-01";
const DEFAULT_PUBLIC_KEY = "keys/microdent-license-public.pem";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildEvidenceCollectionPacket({
  date = todayIso(),
  clinicLabel = DEFAULT_CLINIC_LABEL,
  publicKeyPath = DEFAULT_PUBLIC_KEY,
  installerTarget = "nsis",
  updateChannel = "internal-signed-feed",
} = {}) {
  const packetTargets = {
    packageVerifyPacketPath: `qa-runs/${date}-windows-package-verify-packet-${clinicLabel}.md`,
    windowsFieldPacketPath: `qa-runs/${date}-windows-field-packet-${clinicLabel}.md`,
    installerPacketPath: `qa-runs/${date}-installer-readiness-packet.md`,
    autoUpdatePacketPath: `qa-runs/${date}-auto-update-readiness-packet.md`,
    commercialLaunchPacketPath: `qa-runs/${date}-commercial-launch-packet-${clinicLabel}.md`,
    goLivePacketPath: `qa-runs/${date}-go-live-readiness-packet-${clinicLabel}.md`,
    evidenceFilingPlanPath: `qa-runs/${date}-evidence-filing-plan.md`,
  };

  const commands = [
    {
      phase: "Windows package verification",
      command: `pnpm pilot:package-verify-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath} --write ${packetTargets.packageVerifyPacketPath}`,
      output: packetTargets.packageVerifyPacketPath,
    },
    {
      phase: "Tier 3 Windows field run",
      command: `pnpm pilot:windows-field-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath} --write ${packetTargets.windowsFieldPacketPath}`,
      output: packetTargets.windowsFieldPacketPath,
    },
    {
      phase: "Signed installer readiness",
      command: `pnpm pilot:installer-packet -- --date ${date} --target ${installerTarget} --public-key ${publicKeyPath} --write ${packetTargets.installerPacketPath}`,
      output: packetTargets.installerPacketPath,
    },
    {
      phase: "Signed update readiness",
      command: `pnpm pilot:auto-update-packet -- --date ${date} --channel ${updateChannel} --public-key ${publicKeyPath} --write ${packetTargets.autoUpdatePacketPath}`,
      output: packetTargets.autoUpdatePacketPath,
    },
    {
      phase: "Commercial launch evidence",
      command: `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath} --write ${packetTargets.commercialLaunchPacketPath}`,
      output: packetTargets.commercialLaunchPacketPath,
    },
    {
      phase: "Go-live approval evidence",
      command: `pnpm pilot:go-live-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath} --write ${packetTargets.goLivePacketPath}`,
      output: packetTargets.goLivePacketPath,
    },
    {
      phase: "Master filing checklist",
      command: `pnpm pilot:evidence-filing-plan -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath} --write ${packetTargets.evidenceFilingPlanPath}`,
      output: packetTargets.evidenceFilingPlanPath,
    },
    {
      phase: "Returned safe-results intake",
      command: "pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip",
      output: "qa-runs/ validated JSON only",
    },
    {
      phase: "Repository PHI guard",
      command: "pnpm pilot:evidence-repo-guard",
      output: undefined,
    },
    {
      phase: "Commercial evidence status",
      command: `pnpm pilot:commercial-evidence-status -- --public-key ${publicKeyPath}`,
      output: undefined,
    },
    {
      phase: "Strict roadmap completion audit",
      command: `pnpm roadmap:completion-audit -- --public-key ${publicKeyPath}`,
      output: undefined,
    },
  ];

  return {
    date,
    clinicLabel,
    status: "blocked-until-real-evidence-filed",
    publicKeyPath,
    installerTarget,
    updateChannel,
    packetTargets,
    commands,
    phiRules: [
      "Do not commit raw screenshots, PDFs, logs, DBF/SQLite files, archives, signed license payloads, installer binaries, or raw clinic exports.",
      "Use packet Markdown and evidence JSON summaries only; keep raw materials in the approved secure internal tracker.",
      "Use `pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip` for the returned Windows smoke bundle; read-only smoke evidence stays `READ_ONLY_READY` and does not prove sandbox signoff or go-live.",
      "Attachment manifests may reference secure tracker IDs and hashes, but not patient names, chart numbers, phone numbers, comments, or local full paths.",
      "Completion must remain blocked until package verification evidence, non-template Windows field evidence referencing it, and commercial readiness evidence all validate.",
    ],
  };
}

export function renderEvidenceCollectionPacketMarkdown(packet) {
  const lines = [
    "# Microdent Modern master evidence collection packet",
    "",
    `**Date:** ${packet.date}`,
    `**Clinic/device label:** ${packet.clinicLabel}`,
    `**Status:** ${packet.status}`,
    "",
    "This packet is a PHI-safe coordinator for real Windows package verification, field, and commercial evidence collection. It does not create evidence JSON, prove field execution, approve commercial readiness, or replace validator output.",
    "",
    "## Packet Outputs",
    "",
    ...Object.values(packet.packetTargets).map((target) => `- \`${target}\``),
    "",
    "## Command Sequence",
    "",
    "| Phase | Command | Output |",
    "| --- | --- | --- |",
    ...packet.commands.map((entry) => `| ${entry.phase} | \`${entry.command}\` | ${entry.output ? `\`${entry.output}\`` : "console"} |`),
    "",
    "## Copy/Paste Commands",
    "",
    "```bash",
    ...packet.commands.map((entry) => entry.command),
    "```",
    "",
    "## PHI And Evidence Rules",
    "",
    ...packet.phiRules.map((rule) => `- ${rule}`),
    "",
    "## Completion Rule",
    "",
    "The final command must keep reporting `ROADMAP COMPLETION: BLOCKED` until package verification evidence, real non-template Windows field evidence referencing it, and commercial readiness evidence are filed and pass their validators.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/evidence-collection-packet.mjs [--json] [--write [path]] [--date YYYY-MM-DD] [--clinic-label CLINIC-PC-01] [--public-key keys/microdent-license-public.pem] [--installer-target nsis] [--update-channel internal-signed-feed]

Generates a PHI-safe master evidence collection packet. It does not create
evidence JSON, prove Windows execution, or approve commercial readiness.
`);
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    write: false,
    writePath: undefined,
    date: todayIso(),
    clinicLabel: DEFAULT_CLINIC_LABEL,
    publicKeyPath: DEFAULT_PUBLIC_KEY,
    installerTarget: "nsis",
    updateChannel: "internal-signed-feed",
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
    } else if (arg === "--installer-target") {
      parsed.installerTarget = args[index + 1];
      index += 1;
    } else if (arg === "--update-channel") {
      parsed.updateChannel = args[index + 1];
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
    console.error(`[evidence-collection-packet] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }

  const packet = buildEvidenceCollectionPacket(parsed);
  const output = parsed.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : renderEvidenceCollectionPacketMarkdown(packet);

  if (parsed.write) {
    const outPath = parsed.writePath ?? join("qa-runs", `${parsed.date}-evidence-collection-packet-${parsed.clinicLabel}.md`);
    const writeOutputPath = isAbsolute(outPath) ? outPath : join(REPO_ROOT, outPath);
    mkdirSync(dirname(writeOutputPath), { recursive: true });
    writeFileSync(writeOutputPath, output, "utf8");
    console.log(`[evidence-collection-packet] wrote ${outPath}`);
    return 0;
  }

  process.stdout.write(output);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
