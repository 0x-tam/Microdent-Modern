#!/usr/bin/env node
/**
 * Evidence filing plan generator.
 *
 * This does not create evidence JSONs. It produces a PHI-safe checklist with
 * recommended non-template filenames, source templates, and validator commands
 * so package-verification, field, and commercial evidence can be filed
 * consistently.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditCommercialEvidenceStatus,
} from "./commercial-evidence-status.mjs";
import {
  auditRoadmapCompletion,
} from "./roadmap-completion-audit.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CLINIC_LABEL = "CLINIC-PC-01";

const EVIDENCE_ITEMS = [
  {
    id: "package-verification",
    phase: "Tier 3 Windows execution",
    label: "Windows package verification evidence",
    templatePath: "qa-runs/TEMPLATE-windows-package-verify-evidence.json",
    targetName: ({ date, clinicLabel }) => `${date}-windows-package-verify-evidence-${clinicLabel}.json`,
    command: ({ targetPath }) => `pnpm pilot:package-verify-evidence -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:package-verify-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Create after IT verifies the staged package on Windows, before field execution begins.",
  },
  {
    id: "attachment-manifest",
    phase: "Tier 3 Windows execution",
    label: "Evidence attachment manifest",
    templatePath: "qa-runs/TEMPLATE-evidence-attachment-manifest.json",
    targetName: ({ date, clinicLabel }) => `${date}-evidence-attachment-manifest-${clinicLabel}.json`,
    command: ({ targetPath }) => `pnpm pilot:attachment-manifest -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:windows-field-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Create after screenshots/signoff outputs are redacted, hashed, and stored in a secure internal tracker.",
  },
  {
    id: "windows-field-evidence",
    phase: "Tier 3 Windows execution",
    label: "Windows field execution evidence",
    templatePath: "qa-runs/TEMPLATE-windows-field-evidence.json",
    targetName: ({ date, clinicLabel }) => `${date}-windows-field-evidence-${clinicLabel}.json`,
    command: ({ targetPath }) => `pnpm pilot:field-evidence -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:windows-field-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Create from the completed EXEC-01 through EXEC-16 field run after package verification passes; set packageVerification.evidencePath and do not paste raw logs or patient details.",
  },
  {
    id: "windows-compatibility",
    phase: "Commercial evidence",
    label: "Windows 10/11 and endpoint compatibility evidence",
    templatePath: "qa-runs/TEMPLATE-windows-compatibility-evidence.json",
    targetName: ({ date }) => `${date}-windows-compatibility-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:windows-compatibility -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:windows-field-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "File once Windows 10, Windows 11, and endpoint/AV checks are complete.",
  },
  {
    id: "signed-artifacts",
    phase: "Commercial evidence",
    label: "Signed artifact evidence",
    templatePath: "qa-runs/TEMPLATE-signed-artifact-evidence.json",
    targetName: ({ date }) => `${date}-signed-artifact-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:signed-artifacts -- ${targetPath}`,
    packetCommands: ({ date, publicKeyPath }) => [
      `pnpm pilot:installer-packet -- --date ${date} --target nsis --public-key ${publicKeyPath}`,
      `pnpm pilot:auto-update-packet -- --date ${date} --channel internal-signed-feed --public-key ${publicKeyPath}`,
    ],
    notes: "Requires real Authenticode signing verification for app and installer artifacts.",
  },
  {
    id: "installer",
    phase: "Commercial evidence",
    label: "Installer behavior evidence",
    templatePath: "qa-runs/TEMPLATE-installer-evidence.json",
    targetName: ({ date }) => `${date}-installer-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:installer-evidence -- ${targetPath}`,
    packetCommands: ({ date, publicKeyPath }) => [
      `pnpm pilot:installer-packet -- --date ${date} --target nsis --public-key ${publicKeyPath}`,
    ],
    notes: "Requires clean install, upgrade, uninstall/data-preservation, shortcuts, and first-run proof.",
  },
  {
    id: "auto-update",
    phase: "Commercial evidence",
    label: "Auto-update evidence",
    templatePath: "qa-runs/TEMPLATE-auto-update-evidence.json",
    targetName: ({ date }) => `${date}-auto-update-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:auto-update-evidence -- ${targetPath}`,
    packetCommands: ({ date, publicKeyPath }) => [
      `pnpm pilot:auto-update-packet -- --date ${date} --channel internal-signed-feed --public-key ${publicKeyPath}`,
    ],
    notes: "Requires signed update payload, update preservation, rollback, offline recovery, and privacy proof.",
  },
  {
    id: "clinic-pilot-report",
    phase: "Commercial evidence",
    label: "Clinic pilot report",
    templatePath: "qa-runs/TEMPLATE-clinic-pilot-report.json",
    targetName: ({ date, clinicLabel }) => `${date}-clinic-pilot-report-${clinicLabel}.json`,
    command: ({ targetPath }) => `pnpm pilot:clinic-report -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:go-live-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "File one report per clinic/device label after pilot issues are triaged.",
  },
  {
    id: "support-readiness",
    phase: "Commercial evidence",
    label: "Support readiness evidence",
    templatePath: "qa-runs/TEMPLATE-support-readiness-evidence.json",
    targetName: ({ date }) => `${date}-support-readiness-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:support-readiness -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
      `pnpm pilot:go-live-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Requires support KB, issue workflow, rollback/training, safe evidence, and lead signoff.",
  },
  {
    id: "offline-license",
    phase: "Commercial evidence",
    label: "Offline license evidence",
    templatePath: "qa-runs/TEMPLATE-offline-license.json",
    targetName: ({ date, clinicLabel }) => `${date}-offline-license-${clinicLabel}.json`,
    command: ({ targetPath, publicKeyPath }) =>
      `pnpm license:validate -- ${targetPath}${publicKeyPath ? ` --public-key ${publicKeyPath}` : " --public-key keys/microdent-license-public.pem"}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Requires a real signed offline license and matching public key.",
  },
  {
    id: "distribution",
    phase: "Commercial evidence",
    label: "Distribution evidence",
    templatePath: "qa-runs/TEMPLATE-distribution-evidence.json",
    targetName: ({ date }) => `${date}-distribution-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:distribution-evidence -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Requires channel, artifact integrity, release notes, support path, claims, and privacy/security review.",
  },
  {
    id: "pricing",
    phase: "Commercial evidence",
    label: "Pricing evidence",
    templatePath: "qa-runs/TEMPLATE-pricing-evidence.json",
    targetName: ({ date }) => `${date}-pricing-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:pricing-evidence -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Requires license alignment, support terms, telemetry independence, and sponsor approval.",
  },
  {
    id: "marketing",
    phase: "Commercial evidence",
    label: "Marketing evidence",
    templatePath: "qa-runs/TEMPLATE-marketing-evidence.json",
    targetName: ({ date }) => `${date}-marketing-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:marketing-evidence -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Requires claim evidence, disclosures, privacy review, packet approval, and safe screenshots.",
  },
  {
    id: "go-live",
    phase: "Commercial evidence",
    label: "Go-live approval evidence",
    templatePath: "qa-runs/TEMPLATE-go-live-evidence.json",
    targetName: ({ date }) => `${date}-go-live-evidence.json`,
    command: ({ targetPath }) => `pnpm pilot:go-live-evidence -- ${targetPath}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:go-live-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Requires final go/no-go approval, issue triage, support path, rollback path, operator approval, and referenced package/field/clinic/support/commercial readiness files. Validate commercial readiness/status with --public-key for offline license proof.",
  },
  {
    id: "commercial-readiness",
    phase: "Final commercial gate",
    label: "Commercial readiness evidence",
    templatePath: "qa-runs/TEMPLATE-commercial-readiness-evidence.json",
    targetName: ({ date }) => `${date}-commercial-readiness-evidence.json`,
    command: ({ targetPath, publicKeyPath }) =>
      `pnpm pilot:commercial-readiness -- ${targetPath}${publicKeyPath ? ` --public-key ${publicKeyPath}` : " --public-key keys/microdent-license-public.pem"}`,
    packetCommands: ({ date, clinicLabel, publicKeyPath }) => [
      `pnpm pilot:commercial-launch-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
      `pnpm pilot:go-live-packet -- --date ${date} --clinic-label ${clinicLabel} --public-key ${publicKeyPath}`,
    ],
    notes: "Prepare alongside go-live evidence at the final gate, then validate after every referenced evidence JSON exists and validates; use --public-key for offline license proof.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusForItem(item, commercialStatus, roadmapStatus) {
  if (item.id === "windows-field-evidence") {
    return roadmapStatus.tier3Ready ? "ready" : "blocked";
  }
  const component = commercialStatus.components.find((entry) => entry.id === item.id);
  return component?.status ?? "blocked";
}

function errorsForItem(item, commercialStatus, roadmapStatus) {
  if (item.id === "package-verification") {
    if (roadmapStatus.packageVerificationEvidence.length === 0) {
      return ["no completed non-template windows package verification evidence is filed under qa-runs/"];
    }
    return roadmapStatus.packageVerificationEvidence
      .filter(({ result }) => result.ok !== true)
      .flatMap(({ path, result }) => (result.errors ?? []).map((error) => `${basename(path)}: ${error}`));
  }
  if (item.id === "windows-field-evidence") {
    if (roadmapStatus.fieldEvidence.length === 0) {
      return ["no completed non-template windows field evidence with packageVerification.evidencePath is filed under qa-runs/"];
    }
    return roadmapStatus.fieldEvidence
      .filter(({ result }) => result.tier3Ready !== true)
      .flatMap(({ path, result }) => (result.errors ?? []).map((error) => `${basename(path)}: ${error}`));
  }
  return commercialStatus.components.find((entry) => entry.id === item.id)?.errors ?? [];
}

export function buildEvidenceFilingPlan({
  repoRoot = REPO_ROOT,
  date = todayIso(),
  clinicLabel = DEFAULT_CLINIC_LABEL,
  publicKeyPem = process.env.MICRODENT_LICENSE_PUBLIC_KEY,
  publicKeyPath = "keys/microdent-license-public.pem",
} = {}) {
  const commercialStatus = auditCommercialEvidenceStatus({ repoRoot, publicKeyPem });
  const roadmapStatus = auditRoadmapCompletion({ repoRoot, publicKeyPem });
  const items = EVIDENCE_ITEMS.map((item) => {
    const targetPath = `qa-runs/${item.targetName({ date, clinicLabel })}`;
    const command = item.command({ targetPath, publicKeyPath });
    const packetCommands = item.packetCommands
      ? item.packetCommands({ date, clinicLabel, publicKeyPath })
      : [];
    const status = statusForItem(item, commercialStatus, roadmapStatus);
    return {
      id: item.id,
      phase: item.phase,
      label: item.label,
      status,
      templatePath: item.templatePath,
      targetPath,
      command,
      packetCommands,
      notes: item.notes,
      errors: errorsForItem(item, commercialStatus, roadmapStatus),
    };
  });
  const ready = items.every((item) => item.status === "ready");
  return {
    ready,
    status: ready ? "ready" : "blocked",
    date,
    clinicLabel,
    items,
    summary: {
      total: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      blocked: items.filter((item) => item.status !== "ready").length,
    },
  };
}

export function renderEvidenceFilingPlanMarkdown(plan) {
  const lines = [
    "# Microdent Modern evidence filing plan",
    "",
    `**Status:** ${plan.status.toUpperCase()}`,
    `**Date prefix:** ${plan.date}`,
    `**Clinic label:** ${plan.clinicLabel}`,
    "",
    "This plan is PHI-safe and does not prove field execution by itself. Copy package verification evidence first, then field evidence with `packageVerification.evidencePath`, then fill the remaining templates from real external evidence. At the final gate, prepare commercial readiness and go-live evidence together so their cross-references match, then run each validator before claiming commercial readiness.",
    "",
    "## Summary",
    "",
    `- Total evidence files: ${plan.summary.total}`,
    `- Ready: ${plan.summary.ready}`,
    `- Blocked or missing: ${plan.summary.blocked}`,
    "",
    "## Filing Order",
    "",
  ];

  for (const item of plan.items) {
    lines.push(`### ${item.label}`);
    lines.push("");
    lines.push(`- Phase: ${item.phase}`);
    lines.push(`- Status: ${item.status}`);
    lines.push(`- Copy from: \`${item.templatePath}\``);
    lines.push(`- File as: \`${item.targetPath}\``);
    if (item.packetCommands.length > 0) {
      lines.push("- Prepare with:");
      for (const packetCommand of item.packetCommands) {
        lines.push(`  - \`${packetCommand}\``);
      }
    }
    lines.push(`- Validate: \`${item.command}\``);
    lines.push(`- Notes: ${item.notes}`);
    if (item.errors.length > 0) {
      lines.push("- Current blockers:");
      for (const error of item.errors) {
        lines.push(`  - ${error}`);
      }
    }
    lines.push("");
  }

  lines.push("## Final Checks");
  lines.push("");
  lines.push("- If the Windows double-click helper returned `MicrodentModern-safe-results.zip`, run `pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip`; read-only smoke stays `READ_ONLY_READY` and does not prove sandbox signoff or go-live.");
  lines.push("- Run `pnpm pilot:commercial-evidence-status -- --public-key keys/microdent-license-public.pem` before final readiness.");
  lines.push("- Run `pnpm roadmap:completion-audit -- --public-key keys/microdent-license-public.pem` only after package verification, field evidence referencing it, and commercial evidence files are complete.");
  lines.push("- Do not include patient names, chart numbers, phone numbers, raw DBF rows, raw logs, or full local config paths.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function printUsage() {
  console.log(`Usage: node scripts/evidence-filing-plan.mjs [--json] [--write [path]] [--repo-root <path>] [--date YYYY-MM-DD] [--clinic-label CLINIC-PC-01] [--public-key <public-key.pem>]

Builds a PHI-safe filing plan for Windows package verification, field, and commercial evidence.
It does not create evidence JSONs; operators must copy templates, fill them
from real evidence, and validate each report.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const parsed = {
    json: false,
    write: false,
    writePath: undefined,
    date: todayIso(),
    clinicLabel: DEFAULT_CLINIC_LABEL,
    publicKeyPem: undefined,
    publicKeyPath: "keys/microdent-license-public.pem",
    publicKeySupplied: false,
    repoRoot: undefined,
  };
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
    if (arg === "--write") {
      parsed.write = true;
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed.writePath = next;
        i += 1;
      }
      continue;
    }
    if (arg === "--date") {
      parsed.date = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--clinic-label") {
      parsed.clinicLabel = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--public-key") {
      parsed.publicKeyPath = args[i + 1];
      parsed.publicKeySupplied = true;
      i += 1;
      continue;
    }
    if (arg === "--repo-root") {
      parsed.repoRoot = args[i + 1];
      i += 1;
      continue;
    }
  }
  if (parsed.publicKeySupplied && parsed.publicKeyPath) {
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
    console.error(`[evidence-filing-plan] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (parsed.help) {
    printUsage();
    return 0;
  }

  const plan = buildEvidenceFilingPlan({
    repoRoot: parsed.repoRoot,
    date: parsed.date,
    clinicLabel: parsed.clinicLabel,
    publicKeyPem: parsed.publicKeyPem,
    publicKeyPath: parsed.publicKeyPath,
  });
  if (parsed.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    const markdown = renderEvidenceFilingPlanMarkdown(plan);
    if (parsed.write) {
      const path = parsed.writePath ?? join("qa-runs", `${parsed.date}-evidence-filing-plan.md`);
      const writeOutputPath = isAbsolute(path) ? path : join(parsed.repoRoot ?? REPO_ROOT, path);
      mkdirSync(dirname(writeOutputPath), { recursive: true });
      writeFileSync(writeOutputPath, markdown, "utf8");
      console.log(`[evidence-filing-plan] wrote ${path}`);
    } else {
      process.stdout.write(markdown);
    }
  }
  return plan.ready ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
