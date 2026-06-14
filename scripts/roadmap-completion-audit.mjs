#!/usr/bin/env node
/**
 * Roadmap completion audit.
 *
 * This is the strict, requirement-oriented gate for the continuation roadmap.
 * It can prove local preparation work, but it must stay BLOCKED until the
 * external Windows/signing/installer/update/pilot evidence exists.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateCommercialReadinessEvidence,
} from "./commercial-readiness-audit.mjs";
import {
  validatePackageVerifyEvidence,
} from "./package-verify-evidence.mjs";
import {
  validateFieldEvidenceReport,
} from "./windows-field-evidence.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_LOCAL_EVIDENCE = [
  {
    id: "4.1",
    label: "Operator manual",
    files: ["docs/operator-manual.md"],
    text: [
      ["docs/PILOT-START-HERE.md", "operator-manual.md"],
      ["docs/PILOT-HANDOFF-PACK.md", "operator-manual.md"],
      ["docs/operator-manual.md", "Do not include PHI"],
    ],
  },
  {
    id: "4.2",
    label: "Accessibility audit path",
    files: ["docs/accessibility-audit-checklist.md"],
    text: [
      ["docs/accessibility-audit-checklist.md", "WCAG 2.2 AA"],
      ["docs/accessibility-audit-checklist.md", "Keyboard"],
      ["packages/app/src/AppointmentWriteActionsPanel.tsx", "role=\"tablist\""],
      ["packages/app/src/AppointmentWriteActionsPanel.tsx", "aria-controls"],
      ["packages/app/src/post-write-local-copy.test.tsx", "aria-live=\"polite\""],
      ["packages/app/src/schedule-panel.test.tsx", "Local copy may need refresh"],
    ],
  },
  {
    id: "4.3",
    label: "Synthetic performance profiling",
    files: [
      "scripts/synthetic-performance-profile.ts",
      "docs/performance-synthetic-profiling.md",
      "qa-runs/2026-06-06-synthetic-performance-baseline.md",
    ],
    text: [
      ["package.json", "perf:synthetic"],
      ["qa-runs/2026-06-06-synthetic-performance-baseline.md", "5,000"],
      ["qa-runs/2026-06-06-synthetic-performance-baseline.md", "50,000"],
      ["qa-runs/2026-06-06-synthetic-performance-baseline.md", "P95"],
      ["qa-runs/2026-06-06-synthetic-performance-baseline.md", "Real Windows validation remains required"],
    ],
  },
  {
    id: "4.4",
    label: "Post-write local-copy refresh policy",
    files: [
      "packages/app/src/post-write-local-copy.tsx",
      "packages/app/src/post-write-local-copy.test.tsx",
    ],
    text: [
      ["docs/operator-manual.md", "Refresh local copy"],
      ["packages/app/src/post-write-local-copy.tsx", "refresh"],
      ["packages/app/src/post-write-local-copy.test.tsx", "marks sandbox commit risk"],
      ["packages/app/src/schedule-panel.test.tsx", "post-write-local-copy-refresh-needed"],
    ],
  },
  {
    id: "4.5",
    label: "DBF-change-since-import detection",
    files: [
      "services/sqlite-mirror/sql/migrations/008_source_file_snapshots.sql",
      "services/sqlite-mirror/src/import-run.ts",
      "services/bridge/src/sqlite/mirror-status.ts",
      "packages/contracts/src/mirror-status.ts",
    ],
    text: [
      ["packages/contracts/src/mirror-status.ts", "sourceFileStatuses"],
      ["services/bridge/src/sqlite/mirror-status.ts", "sourceChangedSinceImport"],
      ["services/bridge/src/mirror-status-routes.test.ts", "reports unreadable copied files since the last import without paths"],
      ["docs/phase-2-sqlite-schema.md", "source_file_snapshots"],
    ],
  },
  {
    id: "4.6",
    label: "Incremental local-copy import",
    files: [
      "docs/incremental-local-copy-import.md",
      "services/sqlite-mirror/src/run-mirror-import-safe.ts",
      "services/sqlite-mirror/src/run-mirror-import-safe.test.ts",
    ],
    text: [
      ["docs/incremental-local-copy-import.md", "table-level"],
      ["services/sqlite-mirror/src/run-mirror-import-safe.ts", "incremental"],
      ["services/sqlite-mirror/src/run-mirror-import-safe.test.ts", "status).toBe(\"skipped\")"],
      ["services/sqlite-mirror/src/run-mirror-import-safe.test.ts", "patients\")?.status).toBe(\"success\")"],
    ],
  },
  {
    id: "4.7",
    label: "Operator-friendly error copy",
    files: [
      "packages/app/src/local-copy-issue.ts",
      "packages/app/src/read-only-ui-copy.ts",
      "packages/app/src/local-copy-issue.test.ts",
    ],
    text: [
      ["packages/app/src/local-copy-issue.test.ts", "DATA_ROOT"],
      ["packages/app/src/local-copy-issue.test.ts", "SQLITE_PATH"],
      ["packages/app/src/read-only-ui-copy.ts", "clinic service"],
    ],
  },
  {
    id: "4.8",
    label: "Data privacy review",
    files: ["docs/data-privacy-review.md"],
    text: [
      ["docs/data-privacy-review.md", "local-only"],
      ["docs/data-privacy-review.md", "support"],
      ["docs/windows-pilot-data-locations.md", "Templates shipped"],
    ],
  },
  {
    id: "4.9",
    label: "Telemetry/upload decision",
    files: ["docs/telemetry-deferral-decision-record.md"],
    text: [
      ["docs/telemetry-deferral-decision-record.md", "telemetry and upload remain off"],
      ["docs/telemetry-deferral-decision-record.md", "local-only"],
    ],
  },
  {
    id: "5.1",
    label: "Installer decision record",
    files: [
      "docs/installer-deferral-decision-record.md",
      "scripts/installer-readiness-packet.mjs",
    ],
    text: [
      ["package.json", "pilot:installer-packet"],
      ["docs/installer-deferral-decision-record.md", "pilot:installer-packet"],
      ["docs/installer-deferral-decision-record.md", "Installer work is not complete"],
      ["docs/windows-pilot-installer-decision-record.md", "NSIS"],
    ],
  },
  {
    id: "5.2",
    label: "Code-signing decision record",
    files: ["docs/code-signing-deferral-decision-record.md"],
    text: [
      ["docs/code-signing-deferral-decision-record.md", "SmartScreen"],
      ["docs/code-signing-deferral-decision-record.md", "external blockers"],
    ],
  },
  {
    id: "5.3",
    label: "Auto-update decision record",
    files: [
      "docs/auto-update-deferral-decision-record.md",
      "scripts/auto-update-readiness-packet.mjs",
    ],
    text: [
      ["package.json", "pilot:auto-update-packet"],
      ["docs/auto-update-deferral-decision-record.md", "pilot:auto-update-packet"],
      ["docs/auto-update-deferral-decision-record.md", "Auto-update"],
      ["docs/auto-update-deferral-decision-record.md", "deferred"],
    ],
  },
  {
    id: "6",
    label: "Windows field evidence validator and cross-platform sandbox QA",
    files: [
      "scripts/pilot-release-signoff.mjs",
      "scripts/pilot-checkpoint.mjs",
      "scripts/legacy-command.mjs",
      "scripts/mirror-import-safe.mjs",
      "scripts/qa-sandbox-run.mjs",
      "scripts/roadmap-local-audit.mjs",
      "scripts/strict-signoff-local.mjs",
      "scripts/package-verify-packet.mjs",
      "scripts/package-verify-evidence.mjs",
      "scripts/windows-field-packet.mjs",
      "scripts/windows-field-evidence.mjs",
      "scripts/intake-safe-results.mjs",
      "scripts/windows-compatibility-evidence.mjs",
      "qa-runs/TEMPLATE-windows-package-verify-evidence.json",
      "qa-runs/TEMPLATE-windows-field-evidence.json",
      "qa-runs/TEMPLATE-windows-compatibility-evidence.json",
      "docs/windows-package-verify-evidence.md",
      "docs/windows-field-evidence-report.md",
      "docs/windows-compatibility-evidence.md",
    ],
    text: [
      ["package.json", "node scripts/pilot-release-signoff.mjs"],
      ["package.json", "pilot:release-signoff:bash"],
      ["package.json", "node scripts/pilot-checkpoint.mjs full-checkpoint"],
      ["package.json", "pilot:full-checkpoint:bash"],
      ["package.json", "node scripts/pilot-checkpoint.mjs distribution-checkpoint"],
      ["package.json", "pilot:distribution-checkpoint:bash"],
      ["package.json", "node scripts/pilot-checkpoint.mjs release-check"],
      ["package.json", "pilot:release-check:bash"],
      ["package.json", "node scripts/legacy-command.mjs backup"],
      ["package.json", "legacy:backup:bash"],
      ["package.json", "node scripts/legacy-command.mjs create-sandbox"],
      ["package.json", "legacy:create-sandbox:bash"],
      ["package.json", "node scripts/legacy-command.mjs restore"],
      ["package.json", "legacy:restore:bash"],
      ["package.json", "node scripts/legacy-command.mjs backup-verify"],
      ["package.json", "legacy:backup-verify:bash"],
      ["package.json", "node scripts/mirror-import-safe.mjs"],
      ["package.json", "mirror:import-safe:bash"],
      ["package.json", "node scripts/qa-sandbox-run.mjs"],
      ["package.json", "node scripts/roadmap-local-audit.mjs"],
      ["package.json", "node scripts/strict-signoff-local.mjs"],
      ["package.json", "strict-signoff:local:bash"],
      ["package.json", "pilot:package-verify-packet"],
      ["package.json", "pilot:package-verify-evidence"],
      ["package.json", "pilot:windows-field-packet"],
      ["package.json", "pilot:intake-safe-results"],
      ["package.json", "roadmap:local-audit:bash"],
      ["package.json", "pilot:windows-compatibility"],
      ["scripts/pilot-release-signoff.mjs", "PILOT RELEASE SIGNOFF: READY"],
      ["scripts/pilot-checkpoint.mjs", "NOT release signoff"],
      ["scripts/pilot-checkpoint.mjs", "PILOT_STAGED_RELEASE"],
      ["scripts/legacy-command.mjs", "Never point DATA_ROOT at production Microdent-Legacy"],
      ["scripts/legacy-command.mjs", "legacy-create-sandbox"],
      ["scripts/legacy-command.mjs", "legacy-backup-verify"],
      ["scripts/mirror-import-safe.mjs", "@microdent/sqlite-mirror"],
      ["scripts/roadmap-local-audit.mjs", "ROADMAP LOCAL AUDIT: READY"],
      ["scripts/strict-signoff-local.mjs", "prepare-only complete"],
      ["scripts/package-verify-packet.mjs", "blocked-until-windows-package-verified"],
      ["scripts/package-verify-packet.mjs", "pilot:package-verify-evidence"],
      ["scripts/package-verify-evidence.mjs", "PACKAGE VERIFY: READY"],
      ["scripts/package-verify-evidence.mjs", "PACKAGE_VERIFY_EVIDENCE_SCHEMA_VERSION"],
      ["docs/windows-package-verify-evidence.md", "microdent-windows-package-verify/v1"],
      ["scripts/package-verify-packet.mjs", "docs/windows-pilot-package-verify-on-windows.md"],
      ["scripts/evidence-collection-packet.mjs", "pilot:package-verify-packet"],
      ["scripts/windows-field-evidence.mjs", "packageVerification.evidencePath"],
      ["scripts/intake-safe-results.mjs", "SAFE RESULTS INTAKE: READY"],
      ["scripts/intake-safe-results.mjs", "MicrodentModern-safe-results.zip"],
      ["scripts/windows-field-packet.mjs", "packageVerifyEvidencePath"],
      ["docs/windows-field-evidence-report.md", "packageVerification.evidencePath"],
      ["docs/windows-field-evidence-report.md", "pilot:intake-safe-results"],
      ["scripts/README.md", "pnpm pilot:intake-safe-results"],
      ["docs/PILOT-HANDOFF-PACK.md", "DOUBLE-CLICK-WINDOWS-TEST.cmd"],
      ["docs/windows-pilot-field-execution-script.md", "DOUBLE-CLICK-WINDOWS-TEST.cmd"],
      ["docs/windows-pilot-package-verify-on-windows.md", "DOUBLE-CLICK-WINDOWS-TEST.cmd"],
      ["docs/windows-pilot-package-verify-on-windows.md", "$allowedRel"],
      ["docs/windows-pilot-release-layout.md", "validated bundled `node\\node.exe`"],
      ["docs/FIELD-TEST-START-HERE.md", "pilot:package-verify-evidence"],
      ["docs/windows-pilot-field-execution-script.md", "TEMPLATE-windows-package-verify-evidence.json"],
      ["docs/windows-pilot-field-result-form.md", "packageVerification.evidencePath"],
      ["docs/windows-pilot-go-no-go-checklist.md", "windows-package-verify-evidence.md"],
      ["docs/windows-pilot-real-machine-checklist.md", "pilot:package-verify-evidence"],
      ["docs/pilot-acceptance-checklist.md", "packageVerification.evidencePath"],
      ["docs/windows-pilot-release-notes.md", "packageVerification.evidencePath"],
      ["docs/evidence-attachment-manifest.md", "pilot:package-verify-evidence"],
      ["scripts/README.md", "pnpm pilot:package-verify-packet"],
      ["scripts/README.md", "pnpm pilot:package-verify-evidence"],
      ["docs/PILOT-HANDOFF-PACK.md", "windows-package-verify-evidence.md"],
      ["docs/PILOT-HANDOFF-PACK.md", "windows-field-evidence-report.md"],
      ["docs/PILOT-START-HERE.md", "packageVerification.evidencePath"],
      ["docs/PILOT-START-HERE.md", "package verification evidence first"],
      ["docs/PILOT-START-HERE.md", "real Windows field JSON"],
      ["docs/PILOT-START-HERE.md", "referenced package, field, clinic pilot, support, and commercial readiness evidence files"],
      ["docs/commercial-readiness-evidence.md", "windows-package-verify-evidence.md"],
      ["docs/commercial-readiness-evidence.md", "packageVerification.evidencePath"],
      ["docs/commercial-readiness-evidence.md", "Windows field evidence JSON references it"],
      ["docs/evidence-collection-packet.md", "Package verification evidence must pass before the Windows field report"],
      ["docs/go-live-evidence.md", "packageVerification.evidencePath"],
      ["docs/clinic-pilot-report-evidence.md", "pilot:package-verify-evidence"],
      ["docs/external-field-blockers-decision-record.md", "windows-package-verify-evidence.md"],
      ["docs/out-of-scope-guardrails.md", "C6 | Package verification evidence"],
      ["docs/windows-pilot-packaging-gap-report.md", "packageVerification.evidencePath"],
      ["docs/windows-pilot-pre-installer-checklist.md", "windows-package-verify-evidence.md"],
      ["docs/INSTALLER-READINESS.md", "packageVerification.evidencePath"],
      ["docs/windows-pilot-installer-decision-record.md", "M4 | **Tier 3 — Package verification:**"],
      ["docs/pilot-backup-restore-audit.md", "packageVerification.evidencePath"],
      ["docs/product-completeness-audit.md", "packageVerification.evidencePath"],
      ["docs/operator-manual.md", "packageVerification.evidencePath"],
      ["docs/PRODUCT-ACCELERATION-REPORT.md", "packageVerification.evidencePath"],
      ["docs/mac-pilot-qa-runbook.md", "packageVerification.evidencePath"],
      ["docs/clinic-workspace-design-spec.md", "packageVerification.evidencePath"],
      ["docs/installer-deferral-decision-record.md", "packageVerification.evidencePath"],
      ["scripts/go-live-readiness-packet.mjs", "packageVerification.evidencePath"],
      ["scripts/commercial-launch-packet.mjs", "packageVerification.evidencePath"],
      ["scripts/evidence-collection-packet.mjs", "real non-template Windows field evidence referencing it"],
      ["scripts/windows-field-packet.mjs", "set `packageVerification.evidencePath`"],
      ["scripts/evidence-filing-plan.mjs", "set packageVerification.evidencePath"],
      ["scripts/evidence-filing-plan.mjs", "Windows package verification, field, and commercial evidence"],
      ["scripts/go-live-evidence.mjs", "evidencePaths.packageVerificationEvidencePath"],
      ["scripts/go-live-evidence.mjs", "verifyReferences"],
      ["scripts/go-live-evidence.mjs", "validateGoLiveReferences"],
      ["scripts/clinic-pilot-report-evidence.mjs", "packageVerificationEvidencePath"],
      ["scripts/commercial-readiness-audit.mjs", "fieldEvidence.packageVerificationEvidencePath"],
      ["scripts/commercial-readiness-audit.mjs", "go-live evidence commercialReadinessPath must match"],
      ["scripts/commercial-evidence-status.mjs", "packageVerification.evidencePath"],
      ["scripts/commercial-evidence-status.mjs", "verifyReferences"],
      ["scripts/package-verify-packet.mjs", "packageVerification.evidencePath"],
      ["scripts/go-live-readiness-packet.mjs", "field evidence referencing it"],
      ["scripts/go-live-readiness-packet.mjs", "Prepare commercial readiness and go-live evidence together"],
      ["scripts/evidence-filing-plan.mjs", "prepare commercial readiness and go-live evidence together"],
      ["scripts/pilot-release-signoff.mjs", "field evidence link + commercial/go-live evidence"],
      ["scripts/pilot-release-signoff.sh", "field evidence link + commercial/go-live evidence"],
      ["scripts/pilot-mac-release-status.mjs", "field evidence link + commercial/go-live evidence"],
      ["scripts/stage-pilot-release.mjs", "Completed field evidence and signoff reports"],
      ["scripts/stage-pilot-release.mjs", "Verify package evidence first"],
      ["scripts/roadmap-local-audit.mjs", "field evidence with packageVerification.evidencePath"],
      ["scripts/roadmap-local-audit.mjs", "package_verification=blocked"],
      ["scripts/roadmap-local-audit.sh", "field evidence with packageVerification.evidencePath"],
      ["scripts/roadmap-local-audit.sh", "package_verification=blocked"],
      ["scripts/roadmap-local-audit.sh", "pilot:evidence-collection-packet"],
      ["scripts/roadmap-local-audit.sh", "pilot:staged-link-audit"],
      ["scripts/roadmap-local-audit.sh", "missing staged qa-runs templates"],
      ["scripts/roadmap-local-audit.sh", "unexpected staged qa-runs templates"],
      ["scripts/roadmap-local-audit.sh", "source qa-runs templates"],
      ["scripts/README.md", "referenced package, field, clinic pilot, support, and commercial readiness evidence files"],
      ["scripts/README.md", "non-template commercial readiness evidence"],
      ["scripts/README.md", "explicit package verification, Windows field evidence, and commercial readiness gates"],
      ["scripts/README.md", "--repo-root"],
      ["scripts/README.md", "Validate PHI-safe Windows staged-package verification JSON"],
      ["scripts/README.md", "Validate PHI-safe redacted attachment metadata"],
      ["scripts/README.md", "Validate a signed PHI-safe offline commercial license JSON"],
      ["scripts/README.md", "Validate PHI-safe Windows field evidence JSON"],
      ["scripts/README.md", "Validate PHI-safe final go/no-go approval plus referenced package"],
      ["scripts/README.md", "Validate PHI-safe Windows 10/11"],
      ["scripts/README.md", "Validate PHI-safe Authenticode certificate"],
      ["scripts/README.md", "Validate PHI-safe signed installer install"],
      ["scripts/README.md", "Validate PHI-safe signed update channel"],
      ["scripts/README.md", "Validate PHI-safe clinic pilot outcome"],
      ["scripts/README.md", "Validate PHI-safe support KB"],
      ["scripts/README.md", "Validate PHI-safe distribution channel"],
      ["scripts/README.md", "Validate PHI-safe pricing"],
      ["scripts/README.md", "Validate PHI-safe marketing claims"],
      ["scripts/README.md", "plan against an alternate checkout/evidence bundle"],
      ["scripts/README.md", "scan an alternate checkout/evidence bundle"],
      ["scripts/README.md", "validate an alternate checkout/evidence bundle"],
      ["docs/PILOT-START-HERE.md", "alternate checkout/evidence bundle"],
      ["scripts/commercial-evidence-status.mjs", "publicKeyReadPath"],
      ["scripts/commercial-readiness-audit.mjs", "publicKeyReadPath"],
      ["scripts/evidence-filing-plan.mjs", "publicKeyReadPath"],
      ["scripts/roadmap-completion-audit.mjs", "publicKeyReadPath"],
      ["scripts/commercial-evidence-status.mjs", "join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath)"],
      ["scripts/commercial-readiness-audit.mjs", "join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath)"],
      ["scripts/evidence-filing-plan.mjs", "join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath)"],
      ["scripts/offline-license-validate.mjs", "join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath)"],
      ["scripts/roadmap-completion-audit.mjs", "join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath)"],
      ["scripts/pilot-release-artifacts.test.mjs", "relative public-key paths checkout-rooted"],
      ["scripts/README.md", "relative `--public-key` paths resolve from the repo root"],
      ["docs/PILOT-START-HERE.md", "relative `--public-key` paths resolve from the repo root"],
      ["docs/offline-license-mechanism.md", "Relative `--public-key` paths resolve from the repository root by default"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "Default Public-Key Root Checkpoint"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "operator-doc command-table wording counts"],
      ["scripts/pilot-release-artifacts.test.mjs", "toBeGreaterThanOrEqual(5)"],
      ["scripts/pilot-release-artifacts.test.mjs", "toBeGreaterThanOrEqual(4)"],
      ["scripts/package-verify-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/windows-field-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/installer-readiness-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/auto-update-readiness-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/commercial-launch-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/go-live-readiness-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/evidence-collection-packet.mjs", "isAbsolute(outPath)"],
      ["scripts/pilot-release-artifacts.test.mjs", "honors absolute packet write paths across the evidence packet chain"],
      ["scripts/evidence-filing-plan.mjs", "join(parsed.repoRoot ?? REPO_ROOT, path)"],
      ["scripts/pilot-release-artifacts.test.mjs", "writes relative filing plans under the repo root when invoked from another cwd"],
      ["docs/windows-package-verify-evidence.md", "--repo-root"],
      ["docs/evidence-attachment-manifest.md", "--repo-root"],
      ["docs/offline-license-mechanism.md", "--repo-root"],
      ["docs/licensing-readiness.md", "--repo-root"],
      ["docs/windows-field-evidence-report.md", "--repo-root"],
      ["docs/go-live-evidence.md", "--repo-root"],
      ["docs/windows-compatibility-evidence.md", "--repo-root"],
      ["docs/signed-artifact-evidence.md", "--repo-root"],
      ["docs/installer-evidence.md", "--repo-root"],
      ["docs/auto-update-evidence.md", "--repo-root"],
      ["docs/clinic-pilot-report-evidence.md", "--repo-root"],
      ["docs/support-readiness-evidence.md", "--repo-root"],
      ["docs/distribution-evidence.md", "--repo-root"],
      ["docs/pricing-evidence.md", "--repo-root"],
      ["docs/marketing-evidence.md", "--repo-root"],
      ["scripts/pilot-release-artifacts.test.mjs", "evidence CLI alternate-root support"],
      ["scripts/pilot-release-artifacts.test.mjs", "filed-evidence commands wired"],
      ["scripts/pilot-release-artifacts.test.mjs", "keys/microdent-license-public.pem"],
      ["docs/commercial-readiness-evidence.md", "referenced package, field, clinic pilot, support, and commercial readiness evidence files"],
      ["docs/commercial-readiness-evidence.md", "--repo-root"],
      ["scripts/commercial-launch-packet.mjs", "package verification, field"],
      ["qa-runs/TEMPLATE-batch-report.md", "packageVerification.evidencePath"],
      ["qa-runs/TEMPLATE-batch-report.md", "Windows field evidence JSON path"],
      ["qa-runs/TEMPLATE-windows-field-run.md", "packageVerification.evidencePath"],
      ["qa-runs/TEMPLATE-clinic-pilot-report.json", "packageVerificationEvidencePath"],
      ["qa-runs/TEMPLATE-go-live-evidence.json", "packageVerificationEvidencePath"],
      ["qa-runs/TEMPLATE-commercial-readiness-evidence.json", "packageVerificationEvidencePath"],
      ["qa-runs/TEMPLATE-pilot-feedback-triage.md", "pilot:package-verify-evidence"],
      ["docs/windows-field-evidence-report.md", "pilot:windows-field-packet"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "EXEC-01"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "pnpm pilot:package-verify-evidence"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "Validated package verification evidence, completed field script"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "Windows field evidence JSON referencing `packageVerification.evidencePath`"],
      ["docs/ROADMAP-CONTINUATION-PLAN.md", "Non-template commercial readiness and go-live evidence"],
      ["docs/PRODUCT-COMPLETION-ROADMAP.md", "Windows field evidence JSON referencing `packageVerification.evidencePath`"],
      ["docs/PRODUCT-COMPLETION-ROADMAP.md", "pnpm pilot:package-verify-evidence"],
      ["docs/PRODUCT-COMPLETION-ROADMAP.md", "support, distribution, pricing, marketing, license, go-live, and pilot evidence"],
      ["docs/PILOT-HANDOFF-PACK.md", "packageVerification.evidencePath"],
      ["docs/PILOT-HANDOFF-PACK.md", "Package verification evidence and Windows field evidence JSON filed?"],
      ["docs/PILOT-HANDOFF-PACK.md", "Sponsor sign-off after validated package verification and filed Windows field evidence"],
      ["docs/FIELD-TEST-START-HERE.md", "after package verification evidence and Windows field evidence JSON are filed and validated"],
      ["docs/PILOT-START-HERE.md", "referenced package, field, clinic pilot, support, and commercial readiness evidence files"],
      ["docs/PILOT-START-HERE.md", "non-template package verification, Windows field, and commercial readiness evidence"],
      ["docs/PILOT-START-HERE.md", "explicit package verification, Windows field evidence, commercial readiness, and nested offline license signature verification"],
      ["docs/PILOT-START-HERE.md", "audit an alternate checkout/evidence bundle"],
      ["docs/PILOT-START-HERE.md", "alternate checkout/evidence bundle"],
      ["scripts/windows-field-evidence.mjs", "EXEC_STEPS"],
      ["scripts/windows-compatibility-evidence.mjs", "WINDOWS_COMPATIBILITY_SCHEMA_VERSION"],
      ["docs/phase-3-sandbox-qa-runner.md", "**Status:** Implemented"],
      ["docs/phase-3-windows-readiness-audit.md", "**Root `pnpm legacy:*` / `mirror:import-safe`** | **Cross-platform Node wrappers**"],
      ["docs/phase-3-windows-readiness-audit.md", "use root Node wrappers (`pnpm mirror:import-safe`, `pnpm legacy:*`) with drive-letter paths"],
      ["scripts/README.md", "prefer the root `pnpm` Node wrappers with PowerShell env vars"],
    ],
  },
  {
    id: "7",
    label: "Commercial launch evidence validator",
    files: [
      "scripts/commercial-readiness-audit.mjs",
      "scripts/evidence-attachment-manifest.mjs",
      "scripts/evidence-repo-guard.mjs",
      "qa-runs/TEMPLATE-evidence-attachment-manifest.json",
      "qa-runs/TEMPLATE-commercial-readiness-evidence.json",
      "docs/evidence-attachment-manifest.md",
      "docs/commercial-readiness-evidence.md",
      "docs/support-knowledge-base.md",
      "docs/pilot-feedback-triage-workflow.md",
      "docs/licensing-readiness.md",
      "docs/offline-license-mechanism.md",
      "docs/distribution-readiness.md",
      "docs/pricing-readiness.md",
      "docs/pricing-evidence.md",
      "docs/marketing-readiness.md",
      "docs/marketing-evidence.md",
      "docs/go-live-evidence.md",
      "docs/signed-artifact-evidence.md",
      "docs/installer-evidence.md",
      "docs/auto-update-evidence.md",
      "docs/clinic-pilot-report-evidence.md",
      "docs/support-readiness-evidence.md",
      "docs/distribution-evidence.md",
      "scripts/commercial-evidence-status.mjs",
      "scripts/evidence-collection-packet.mjs",
      "scripts/evidence-filing-plan.mjs",
      "scripts/commercial-launch-packet.mjs",
      "docs/evidence-collection-packet.md",
      "scripts/staged-markdown-link-audit.mjs",
      "scripts/pricing-evidence.mjs",
      "qa-runs/TEMPLATE-pricing-evidence.json",
      "scripts/marketing-evidence.mjs",
      "qa-runs/TEMPLATE-marketing-evidence.json",
      "scripts/go-live-evidence.mjs",
      "scripts/go-live-readiness-packet.mjs",
      "qa-runs/TEMPLATE-go-live-evidence.json",
    ],
    text: [
      ["package.json", "pilot:commercial-readiness"],
      ["package.json", "pilot:signed-artifacts"],
      ["package.json", "pilot:installer-evidence"],
      ["package.json", "pilot:auto-update-evidence"],
      ["package.json", "pilot:clinic-report"],
      ["package.json", "pilot:commercial-launch-packet"],
      ["package.json", "pilot:support-readiness"],
      ["package.json", "pilot:distribution-evidence"],
      ["package.json", "pilot:pricing-evidence"],
      ["package.json", "pilot:marketing-evidence"],
      ["package.json", "pilot:go-live-packet"],
      ["package.json", "pilot:go-live-evidence"],
      ["package.json", "license:validate"],
      ["package.json", "pilot:attachment-manifest"],
      ["package.json", "pilot:evidence-repo-guard"],
      ["package.json", "pilot:evidence-collection-packet"],
      ["package.json", "pilot:evidence-filing-plan"],
      ["package.json", "pilot:commercial-evidence-status"],
      ["package.json", "pilot:staged-link-audit"],
      ["scripts/evidence-collection-packet.mjs", "blocked-until-real-evidence-filed"],
      ["scripts/evidence-collection-packet.mjs", "pilot:windows-field-packet"],
      ["scripts/evidence-collection-packet.mjs", "roadmap:completion-audit"],
      ["scripts/evidence-collection-packet.mjs", "writeOutputPath"],
      ["scripts/staged-markdown-link-audit.mjs", "STAGED MARKDOWN LINKS: READY"],
      ["scripts/staged-markdown-link-audit.mjs", "ALLOWED_MISSING_TARGETS"],
      ["scripts/roadmap-local-audit.mjs", "pilot:staged-link-audit"],
      ["scripts/roadmap-local-audit.mjs", "missing staged qa-runs templates"],
      ["scripts/roadmap-local-audit.mjs", "unexpected staged qa-runs templates"],
      ["scripts/roadmap-local-audit.mjs", "source qa-runs templates"],
      ["scripts/stage-pilot-release.mjs", "Evidence collection (from a full repo checkout, not this staged package)"],
      ["scripts/stage-pilot-release.mjs", "pnpm pilot:evidence-collection-packet"],
      ["scripts/stage-pilot-release.mjs", "evidence-collection-packet.md"],
      ["scripts/stage-pilot-release.mjs", "phase-5-operator-qa-runbook.md"],
      ["scripts/stage-pilot-release.mjs", "phase-6-windows-mvp-operator-guide.md"],
      ["scripts/stage-pilot-release.mjs", "windows-pilot-runbook.md"],
      ["scripts/stage-pilot-release.mjs", "phase-3-backup-cli.md"],
      ["scripts/stage-pilot-release.mjs", "phase-3-restore-cli.md"],
      ["scripts/stage-pilot-release.mjs", "phase-4-windows-operator-quickstart.md"],
      ["scripts/stage-pilot-release.mjs", "apps\", \"desktop\", \"README.md"],
      ["scripts/stage-pilot-release.mjs", "scripts\", \"README.md"],
      ["docs/evidence-collection-packet.md", "does **not** create evidence JSON"],
      ["docs/evidence-collection-packet.md", "package verification evidence, real non-template Windows field evidence referencing it, and commercial readiness evidence"],
      ["docs/FIELD-TEST-START-HERE.md", "evidence-collection-packet.md"],
      ["docs/commercial-readiness-evidence.md", "evidence-collection-packet.md"],
      ["docs/commercial-readiness-evidence.md", "full package-verification, field, and commercial evidence run"],
      ["scripts/commercial-evidence-status.mjs", "package-verification"],
      ["scripts/evidence-filing-plan.mjs", "packetCommands"],
      ["scripts/evidence-filing-plan.mjs", "package-verification"],
      ["scripts/evidence-filing-plan.mjs", "no completed non-template windows package verification evidence"],
      ["scripts/evidence-filing-plan.mjs", "writeOutputPath"],
      ["scripts/evidence-filing-plan.mjs", "pilot:package-verify-packet"],
      ["scripts/evidence-filing-plan.mjs", "pilot:windows-field-packet"],
      ["scripts/evidence-filing-plan.mjs", "pilot:commercial-launch-packet"],
      ["docs/PILOT-START-HERE.md", "packet commands"],
      ["docs/licensing-readiness.md", "offline-license-mechanism.md"],
      ["docs/offline-license-mechanism.md", "microdent-offline-license/v1"],
      ["docs/signed-artifact-evidence.md", "microdent-signed-artifact-evidence/v1"],
      ["docs/installer-evidence.md", "microdent-installer-evidence/v1"],
      ["docs/auto-update-evidence.md", "microdent-auto-update-evidence/v1"],
      ["docs/clinic-pilot-report-evidence.md", "microdent-clinic-pilot-report/v1"],
      ["docs/support-readiness-evidence.md", "microdent-support-readiness/v1"],
      ["docs/distribution-evidence.md", "microdent-distribution-evidence/v1"],
      ["docs/pricing-evidence.md", "microdent-pricing-evidence/v1"],
      ["docs/marketing-evidence.md", "microdent-marketing-evidence/v1"],
      ["docs/go-live-evidence.md", "microdent-go-live-evidence/v1"],
      ["docs/go-live-evidence.md", "pilot:go-live-packet"],
      ["docs/evidence-attachment-manifest.md", "microdent-evidence-attachment-manifest/v1"],
      ["docs/evidence-attachment-manifest.md", "pilot:evidence-repo-guard"],
      ["docs/commercial-readiness-evidence.md", "COMMERCIAL READINESS: BLOCKED"],
      ["docs/commercial-readiness-evidence.md", "pilot:commercial-launch-packet"],
    ],
  },
];

function repoPath(relPath, repoRoot = REPO_ROOT) {
  return join(repoRoot, relPath);
}

function readText(relPath, repoRoot = REPO_ROOT) {
  return readFileSync(repoPath(relPath, repoRoot), "utf8");
}

function evidenceFileCandidates(prefix, repoRoot = REPO_ROOT) {
  const qaRunsDir = repoPath("qa-runs", repoRoot);
  if (!existsSync(qaRunsDir)) {
    return [];
  }
  return readdirSync(qaRunsDir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("TEMPLATE-") && name.includes(prefix))
    .map((name) => join(qaRunsDir, name))
    .filter((path) => statSync(path).isFile())
    .sort();
}

function checkLocalItem(item, repoRoot = REPO_ROOT) {
  const errors = [];

  for (const relPath of item.files ?? []) {
    if (!existsSync(repoPath(relPath, repoRoot))) {
      errors.push(`missing file: ${relPath}`);
    }
  }

  for (const [relPath, expected] of item.text ?? []) {
    if (!existsSync(repoPath(relPath, repoRoot))) {
      errors.push(`missing text source: ${relPath}`);
      continue;
    }
    const text = readText(relPath, repoRoot);
    if (!text.includes(expected)) {
      errors.push(`${relPath} does not contain ${JSON.stringify(expected)}`);
    }
  }

  return {
    id: item.id,
    label: item.label,
    ok: errors.length === 0,
    errors,
  };
}

function validateBestJsonEvidence(paths, validator) {
  const results = [];
  for (const path of paths) {
    try {
      const rawText = readFileSync(path, "utf8");
      const report = JSON.parse(rawText);
      const result = validator(report, { rawText });
      results.push({ path, result });
    } catch (err) {
      results.push({
        path,
        result: {
          ok: false,
          tier3Ready: false,
          status: "invalid",
          errors: [err instanceof Error ? err.message : String(err)],
          warnings: [],
        },
      });
    }
  }
  return results;
}

export function auditRoadmapCompletion({
  repoRoot = REPO_ROOT,
  publicKeyPem = process.env.MICRODENT_LICENSE_PUBLIC_KEY,
} = {}) {
  const localItems = REQUIRED_LOCAL_EVIDENCE.map((item) => checkLocalItem(item, repoRoot));

  const packageVerificationEvidence = validateBestJsonEvidence(
    evidenceFileCandidates("windows-package-verify-evidence", repoRoot),
    validatePackageVerifyEvidence,
  );
  const fieldEvidence = validateBestJsonEvidence(
    evidenceFileCandidates("windows-field-evidence", repoRoot),
    (report, options) => validateFieldEvidenceReport(report, {
      ...options,
      verifyReferences: true,
      repoRoot,
    }),
  );
  const commercialEvidence = validateBestJsonEvidence(
    evidenceFileCandidates("commercial-readiness", repoRoot),
    (report, options) => validateCommercialReadinessEvidence(report, {
      ...options,
      verifyReferences: true,
      repoRoot,
      publicKeyPem,
    }),
  );

  const localReady = localItems.every((item) => item.ok);
  const packageVerificationReady = packageVerificationEvidence.some(({ result }) => result.ok === true);
  const tier3Ready = fieldEvidence.some(({ result }) => result.tier3Ready === true);
  const commercialReady = commercialEvidence.some(({ result }) => result.ok === true);
  const ready = localReady && packageVerificationReady && tier3Ready && commercialReady;

  const blockers = [];
  if (!localReady) {
    blockers.push("one or more local roadmap evidence checks failed");
  }
  if (!packageVerificationReady) {
    blockers.push("no completed Windows package verification evidence JSON is present under qa-runs/");
  }
  if (!tier3Ready) {
    blockers.push("no completed sandbox-signoff Windows field evidence JSON is present under qa-runs/");
  }
  if (!commercialReady) {
    blockers.push("no completed commercial readiness evidence JSON is present under qa-runs/");
  }

  return {
    ready,
    status: ready ? "ready" : "blocked",
    localReady,
    packageVerificationReady,
    tier3Ready,
    commercialReady,
    localItems,
    packageVerificationEvidence,
    fieldEvidence,
    commercialEvidence,
    blockers,
  };
}

function printUsage() {
  console.log(`Usage: node scripts/roadmap-completion-audit.mjs [--json] [--repo-root <path>] [--public-key <public-key.pem>]

Audits ROADMAP-CONTINUATION-PLAN.md against concrete evidence.
Expected current state is ROADMAP COMPLETION: BLOCKED until external Windows
package verification, field evidence, and commercial readiness evidence are
filed under qa-runs/.

Pass --public-key or set MICRODENT_LICENSE_PUBLIC_KEY so nested commercial
readiness validation can verify offline license evidence.
`);
}

function printText(result) {
  console.log(result.ready ? "ROADMAP COMPLETION: READY" : "ROADMAP COMPLETION: BLOCKED");
  console.log(`local_sections=${result.localReady ? "ready" : "blocked"}`);
  console.log(`package_verification=${result.packageVerificationReady ? "ready" : "blocked"}`);
  console.log(`windows_field_evidence=${result.tier3Ready ? "ready" : "blocked"}`);
  console.log(`commercial_readiness=${result.commercialReady ? "ready" : "blocked"}`);

  for (const item of result.localItems) {
    console.log(`[${item.ok ? "ready" : "blocked"}] ${item.id} ${item.label}`);
    for (const error of item.errors) {
      console.error(`[roadmap-completion-audit] FAIL ${item.id}: ${error}`);
    }
  }

  if (result.packageVerificationEvidence.length === 0) {
    console.error("[roadmap-completion-audit] FAIL package verification: no non-template qa-runs/*windows-package-verify-evidence*.json found");
  }
  for (const { path, result: evidenceResult } of result.packageVerificationEvidence) {
    console.log(`[package-verification:${evidenceResult.ok ? "ready" : "blocked"}] ${basename(path)} status=${evidenceResult.status}`);
    for (const error of evidenceResult.errors ?? []) {
      console.error(`[roadmap-completion-audit] FAIL ${basename(path)}: ${error}`);
    }
  }

  if (result.fieldEvidence.length === 0) {
    console.error("[roadmap-completion-audit] FAIL field evidence: no non-template qa-runs/*windows-field-evidence*.json found");
  }
  for (const { path, result: evidenceResult } of result.fieldEvidence) {
    console.log(`[field-evidence:${evidenceResult.tier3Ready ? "ready" : "blocked"}] ${basename(path)} status=${evidenceResult.status}`);
    for (const error of evidenceResult.errors ?? []) {
      console.error(`[roadmap-completion-audit] FAIL ${basename(path)}: ${error}`);
    }
  }

  if (result.commercialEvidence.length === 0) {
    console.error("[roadmap-completion-audit] FAIL commercial readiness: no non-template qa-runs/*commercial-readiness*.json found");
  }
  for (const { path, result: evidenceResult } of result.commercialEvidence) {
    console.log(`[commercial-readiness:${evidenceResult.ok ? "ready" : "blocked"}] ${basename(path)} status=${evidenceResult.status}`);
    for (const error of evidenceResult.errors ?? []) {
      console.error(`[roadmap-completion-audit] FAIL ${basename(path)}: ${error}`);
    }
  }

  for (const blocker of result.blockers) {
    console.error(`[roadmap-completion-audit] BLOCKER: ${blocker}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = { json: false, publicKeyPath: undefined, publicKeyPem: undefined, repoRoot: undefined };
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
    if (arg === "--public-key") {
      const next = args[i + 1];
      if (next) {
        parsed.publicKeyPath = next;
        i += 1;
      }
      continue;
    }
    if (arg === "--repo-root") {
      const next = args[i + 1];
      if (next) {
        parsed.repoRoot = next;
        i += 1;
      }
      continue;
    }
  }
  if (parsed.publicKeyPath) {
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
    console.error(`[roadmap-completion-audit] FAIL: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  if (parsed.help) {
    printUsage();
    return 0;
  }

  const result = auditRoadmapCompletion({
    repoRoot: parsed.repoRoot,
    publicKeyPem: parsed.publicKeyPem,
  });
  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printText(result);
  }
  return result.ready ? 0 : 1;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  process.exitCode = main(process.argv);
}
