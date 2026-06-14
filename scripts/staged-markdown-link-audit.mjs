#!/usr/bin/env node
/**
 * Audit staged Markdown relative links.
 *
 * The staged pilot package is intentionally not a full source checkout. This
 * checker blocks unexpected broken staged links while allowing documented
 * source/deep-planning references that are useful context but not shipped.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_STAGE_ROOT = join(REPO_ROOT, "dist", "pilot-release", "MicrodentModern");

const ALLOWED_MISSING_TARGETS = new Set([
  "docs/external-field-blockers-decision-record.md -> ./ROADMAP-CONTINUATION-PLAN.md",
  "docs/out-of-scope-guardrails.md -> ../scripts/pilot-release-artifact-rules.mjs",
  "docs/phase-1b-manual-qa-checklist.md -> ./phase-1b-route-inventory.md",
  "docs/phase-1b-manual-qa-checklist.md -> ./phase-1b-ledger-payments-mapping.md",
  "docs/phase-1b-manual-qa-checklist.md -> ./phase-1b-dental-chart-mapping.md",
  "docs/phase-1b-manual-qa-checklist.md -> ./phase-2-sqlite-schema.md",
  "docs/phase-3-appointment-status-dry-run.md -> ./phase-3-dry-run-write-plan.md",
  "docs/phase-3-appointment-status-dry-run.md -> ./phase-3-appointment-write-mapping.md",
  "docs/phase-3-appointment-status-write-runbook.md -> ./phase-3-appointment-status-dry-run-ui.md",
  "docs/phase-3-appointment-status-write-runbook.md -> ./phase-3-appointment-write-mapping.md",
  "docs/phase-3-appointment-status-write-runbook.md -> ./phase-3-backup-restore-plan.md",
  "docs/phase-3-backup-cli.md -> ./phase-3-backup-restore-plan.md",
  "docs/phase-3-backup-cli.md -> ./phase-3-dry-run-write-plan.md",
  "docs/phase-3-disposable-write-sandbox.md -> phase-1a-safety-module.md",
  "docs/phase-3-disposable-write-sandbox.md -> master-build-plan.md",
  "docs/phase-3-disposable-write-sandbox.md -> legacy-system-map.md",
  "docs/phase-3-disposable-write-sandbox.md -> phase-2-sqlite-mirror-plan.md",
  "docs/phase-3-restore-cli.md -> ./phase-3-backup-restore-plan.md",
  "docs/phase-3-sandbox-guard.md -> phase-3-dry-run-write-plan.md",
  "docs/phase-3-sandbox-qa-runner.md -> ../scripts/qa-sandbox-run.mjs",
  "docs/phase-3-sandbox-qa-runner.md -> ../scripts/qa-sandbox-run.sh",
  "docs/phase-3-sandbox-qa-runner.md -> ../scripts/qa-sandbox-write-smoke.sh",
  "docs/phase-3-sandbox-qa-runner.md -> ../scripts/qa-sandbox-preflight.sh",
  "docs/phase-3-sandbox-validation.md -> ../services/bridge/src/sandbox/sandbox-validation-band.test.ts",
  "docs/phase-3-sandbox-validation.md -> ../package.json",
  "docs/phase-3-sandbox-validation.md -> ./checkpoint-workflow.md",
  "docs/phase-3-windows-readiness-audit.md -> ./phase-2-mirror-import-command.md",
  "docs/phase-3-write-mode-config.md -> ./phase-3-dry-run-write-plan.md",
  "docs/phase-3-write-mode-config.md -> ./phase-1a-safety-module.md",
  "docs/phase-3-write-mode-config.md -> ./master-build-plan.md",
  "docs/phase-5-operator-qa-runbook.md -> ../services/bridge/package.json",
  "docs/phase-5-operator-qa-runbook.md -> ../scripts/qa-sandbox-run.mjs",
  "docs/phase-5-operator-qa-runbook.md -> ../scripts/qa-sandbox-preflight.sh",
  "docs/phase-6-windows-mvp-operator-guide.md -> ../services/bridge/package.json",
  "docs/pilot-backup-restore-audit.md -> ../packages/app/src/write-operation-feedback.ts",
  "docs/windows-pilot-data-locations.md -> ../apps/desktop/src/setup/setup.html",
  "docs/windows-pilot-release-layout.md -> ../scripts/stage-pilot-release.mjs",
  "docs/windows-pilot-release-layout.md -> ../scripts/pilot-release-artifact-rules.mjs",
  "scripts/README.md -> ../docs/mac-pilot-qa-runbook.md",
]);

function walkMarkdownFiles(root) {
  const files = [];
  function walk(dir, relBase = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || rel === "node") {
          continue;
        }
        walk(abs, rel);
      } else if (entry.name.endsWith(".md")) {
        files.push(abs);
      }
    }
  }
  walk(root);
  return files;
}

function isExternalLink(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}

function linkKey(stageRoot, file, target) {
  return `${relative(stageRoot, file).replace(/\\/g, "/")} -> ${target}`;
}

export function auditStagedMarkdownLinks({
  stageRoot = DEFAULT_STAGE_ROOT,
  allowedMissingTargets = ALLOWED_MISSING_TARGETS,
} = {}) {
  if (!existsSync(stageRoot)) {
    return {
      ready: false,
      errors: [`stage root missing: ${stageRoot}`],
      broken: [],
      allowed: [],
      checkedFiles: 0,
    };
  }

  const broken = [];
  const allowed = [];
  const markdownFiles = walkMarkdownFiles(stageRoot);
  const stageRootResolved = resolve(stageRoot);
  const linkPattern = /!?(?<!\\)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const file of markdownFiles) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(linkPattern)) {
      const rawTarget = match[1].trim();
      if (!rawTarget || rawTarget.startsWith("#") || isExternalLink(rawTarget)) {
        continue;
      }
      let target = rawTarget.split("#")[0].split("?")[0];
      if (!target) {
        continue;
      }
      try {
        target = decodeURIComponent(target);
      } catch {
        // Keep the raw target if it is not URI-encoded.
      }
      const key = linkKey(stageRoot, file, target);
      const resolved = resolve(dirname(file), target);
      const missing = !resolved.startsWith(stageRootResolved) || !existsSync(resolved);
      if (!missing) {
        continue;
      }
      if (allowedMissingTargets.has(key)) {
        allowed.push(key);
      } else {
        broken.push(key);
      }
    }
  }

  return {
    ready: broken.length === 0,
    errors: broken.map((entry) => `unexpected missing staged markdown link: ${entry}`),
    broken,
    allowed,
    checkedFiles: markdownFiles.length,
  };
}

function main() {
  const result = auditStagedMarkdownLinks();
  if (!result.ready) {
    console.error("STAGED MARKDOWN LINKS: BLOCKED");
    for (const error of result.errors) {
      console.error(`[staged-markdown-link-audit] FAIL ${error}`);
    }
    return 1;
  }
  console.log("STAGED MARKDOWN LINKS: READY");
  console.log(`checked_files=${result.checkedFiles}`);
  console.log(`allowed_missing=${result.allowed.length}`);
  return 0;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main();
}
