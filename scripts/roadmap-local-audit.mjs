#!/usr/bin/env node
/**
 * Local roadmap audit — non-destructive release/evidence checks.
 *
 * Cross-platform Node entrypoint for the roadmap local audit. It proves the
 * staged handoff pack and local evidence gates are wired while confirming
 * external package verification, field, and commercial evidence remains
 * blocked until filed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function log(message) {
  console.log(`[roadmap-local-audit] ${message}`);
}

function fail(message) {
  console.error(`[roadmap-local-audit] FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function run(command, args, { stdio = "inherit", expectCode = 0 } = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
    stdio,
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== expectCode) {
    if (stdio === "pipe") {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    fail(`${command} ${args.join(" ")} exited ${result.status}`);
  }
  return result;
}

function runPnpm(args, options = {}) {
  return run(PNPM, args, options);
}

function expectBlocked(label, expectedPattern, command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  if (result.error) {
    fail(result.error.message);
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status === 0) {
    process.stderr.write(output);
    fail(`${label} unexpectedly passed`);
  }
  if (!expectedPattern.test(output)) {
    process.stderr.write(output);
    fail(`${label} did not print ${expectedPattern}`);
  }
  log(`${label}: expected blocked`);
}

function templateNames(templateDir) {
  if (!existsSync(templateDir)) {
    return [];
  }
  return readdirSync(templateDir)
    .filter((name) => name.startsWith("TEMPLATE-"))
    .filter((name) => statSync(join(templateDir, name)).isFile())
    .sort();
}

function assertStagedTemplatesMatchSource() {
  const sourceTemplateDir = join(REPO_ROOT, "qa-runs");
  const stagedTemplateDir = join(REPO_ROOT, "dist", "pilot-release", "MicrodentModern", "qa-runs");
  const sourceTemplates = templateNames(sourceTemplateDir);
  const stagedTemplates = templateNames(stagedTemplateDir);
  const missing = sourceTemplates.filter((name) => !stagedTemplates.includes(name));
  const extra = stagedTemplates.filter((name) => !sourceTemplates.includes(name));

  if (missing.length > 0 || extra.length > 0) {
    const details = [
      missing.length > 0 ? `missing staged qa-runs templates: ${missing.join(", ")}` : "",
      extra.length > 0 ? `unexpected staged qa-runs templates: ${extra.join(", ")}` : "",
    ].filter(Boolean).join("; ");
    fail(details);
  }

  return { sourceTemplates, stagedTemplates };
}

function main() {
  log("git diff --check");
  run("git", ["diff", "--check"]);

  log("pnpm pilot:evidence-repo-guard");
  runPnpm(["pilot:evidence-repo-guard"]);

  log("pnpm pilot:package-verify-packet");
  runPnpm(["pilot:package-verify-packet", "--", "--date", "2026-06-06", "--clinic-label", "CLINIC-PC-01", "--json"], {
    stdio: "ignore",
  });

  log("pnpm pilot:windows-field-packet");
  runPnpm(["pilot:windows-field-packet", "--", "--date", "2026-06-06", "--clinic-label", "CLINIC-PC-01", "--json"], {
    stdio: "ignore",
  });

  log("pnpm pilot:installer-packet");
  runPnpm(["pilot:installer-packet", "--", "--date", "2026-06-06", "--target", "nsis", "--json"], {
    stdio: "ignore",
  });

  log("pnpm pilot:auto-update-packet");
  runPnpm(["pilot:auto-update-packet", "--", "--date", "2026-06-06", "--channel", "internal-signed-feed", "--json"], {
    stdio: "ignore",
  });

  log("pnpm pilot:go-live-packet");
  runPnpm(["pilot:go-live-packet", "--", "--date", "2026-06-06", "--clinic-label", "CLINIC-PC-01", "--json"], {
    stdio: "ignore",
  });

  log("pnpm pilot:commercial-launch-packet");
  runPnpm(["pilot:commercial-launch-packet", "--", "--date", "2026-06-06", "--clinic-label", "CLINIC-PC-01", "--json"], {
    stdio: "ignore",
  });

  log("pnpm pilot:evidence-collection-packet");
  runPnpm(["pilot:evidence-collection-packet", "--", "--date", "2026-06-06", "--clinic-label", "CLINIC-PC-01", "--json"], {
    stdio: "ignore",
  });

  log("pnpm test:pilot-artifacts");
  runPnpm(["test:pilot-artifacts"]);

  log("pnpm stage:pilot-release");
  runPnpm(["stage:pilot-release"]);

  log("pnpm pilot:verify-release");
  runPnpm(["pilot:verify-release"]);

  log("pnpm pilot:verify-manifest");
  runPnpm(["pilot:verify-manifest"]);

  log("pnpm pilot:staged-link-audit");
  runPnpm(["pilot:staged-link-audit"]);

  log("checking staged qa-runs templates");
  const { sourceTemplates, stagedTemplates } = assertStagedTemplatesMatchSource();
  if (sourceTemplates.length !== 23 || stagedTemplates.length !== 23) {
    fail(
      `expected 23 source qa-runs templates and 23 staged qa-runs templates, `
        + `found source=${sourceTemplates.length} staged=${stagedTemplates.length}`,
    );
  }

  expectBlocked("package verification template", /PACKAGE VERIFY: BLOCKED/, PNPM, [
    "pilot:package-verify-evidence",
    "--",
    "qa-runs/TEMPLATE-windows-package-verify-evidence.json",
  ]);
  expectBlocked("attachment manifest template", /ATTACHMENT MANIFEST: BLOCKED/, PNPM, [
    "pilot:attachment-manifest",
    "--",
    "qa-runs/TEMPLATE-evidence-attachment-manifest.json",
  ]);
  expectBlocked("field evidence template", /FIELD EVIDENCE: BLOCKED/, PNPM, [
    "pilot:field-evidence",
    "--",
    "qa-runs/TEMPLATE-windows-field-evidence.json",
  ]);
  expectBlocked("windows compatibility template", /WINDOWS COMPATIBILITY: BLOCKED/, PNPM, [
    "pilot:windows-compatibility",
    "--",
    "qa-runs/TEMPLATE-windows-compatibility-evidence.json",
  ]);
  expectBlocked("offline license template", /OFFLINE LICENSE: BLOCKED/, PNPM, [
    "license:validate",
    "--",
    "qa-runs/TEMPLATE-offline-license.json",
  ]);
  expectBlocked("signed artifact template", /SIGNED ARTIFACTS: BLOCKED/, PNPM, [
    "pilot:signed-artifacts",
    "--",
    "qa-runs/TEMPLATE-signed-artifact-evidence.json",
  ]);
  expectBlocked("installer evidence template", /INSTALLER EVIDENCE: BLOCKED/, PNPM, [
    "pilot:installer-evidence",
    "--",
    "qa-runs/TEMPLATE-installer-evidence.json",
  ]);
  expectBlocked("auto-update evidence template", /AUTO UPDATE EVIDENCE: BLOCKED/, PNPM, [
    "pilot:auto-update-evidence",
    "--",
    "qa-runs/TEMPLATE-auto-update-evidence.json",
  ]);
  expectBlocked("clinic pilot report template", /CLINIC PILOT REPORT: BLOCKED/, PNPM, [
    "pilot:clinic-report",
    "--",
    "qa-runs/TEMPLATE-clinic-pilot-report.json",
  ]);
  expectBlocked("support readiness template", /SUPPORT READINESS: BLOCKED/, PNPM, [
    "pilot:support-readiness",
    "--",
    "qa-runs/TEMPLATE-support-readiness-evidence.json",
  ]);
  expectBlocked("distribution evidence template", /DISTRIBUTION EVIDENCE: BLOCKED/, PNPM, [
    "pilot:distribution-evidence",
    "--",
    "qa-runs/TEMPLATE-distribution-evidence.json",
  ]);
  expectBlocked("pricing evidence template", /PRICING EVIDENCE: BLOCKED/, PNPM, [
    "pilot:pricing-evidence",
    "--",
    "qa-runs/TEMPLATE-pricing-evidence.json",
  ]);
  expectBlocked("marketing evidence template", /MARKETING EVIDENCE: BLOCKED/, PNPM, [
    "pilot:marketing-evidence",
    "--",
    "qa-runs/TEMPLATE-marketing-evidence.json",
  ]);
  expectBlocked("go-live evidence template", /GO-LIVE EVIDENCE: BLOCKED/, PNPM, [
    "pilot:go-live-evidence",
    "--",
    "qa-runs/TEMPLATE-go-live-evidence.json",
  ]);
  expectBlocked("evidence filing plan", /Status:.*BLOCKED/s, PNPM, [
    "pilot:evidence-filing-plan",
  ]);
  expectBlocked("commercial evidence status", /COMMERCIAL EVIDENCE STATUS: BLOCKED/, PNPM, [
    "pilot:commercial-evidence-status",
  ]);
  expectBlocked("commercial readiness template", /COMMERCIAL READINESS: BLOCKED/, PNPM, [
    "pilot:commercial-readiness",
    "--",
    "qa-runs/TEMPLATE-commercial-readiness-evidence.json",
  ]);
  expectBlocked("roadmap completion audit", /ROADMAP COMPLETION: BLOCKED[\s\S]*package_verification=blocked/, PNPM, [
    "roadmap:completion-audit",
  ]);

  console.log("");
  console.log("ROADMAP LOCAL AUDIT: READY");
  console.log("Tier 1 - Mac-side staged handoff checks: READY");
  console.log("Tier 2 - Windows-test pack/docs/templates: READY");
  console.log("Tier 3 - Windows execution evidence: BLOCKED until package verification and field evidence with packageVerification.evidencePath are filed");
  console.log("Commercial readiness: BLOCKED until signing/installer/update/pilot/support/distribution/pricing/marketing/license/go-live evidence is filed");
  return 0;
}

try {
  process.exitCode = main();
} catch {
  if (!process.exitCode) {
    process.exitCode = 1;
  }
}
