import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as artifactRules from "./pilot-release-artifact-rules.mjs";
import { assertManifestJsonSafe, buildPilotBuildMetadata, generateReleaseManifest, UNSUPPORTED_FEATURES, verifyManifestHashes } from "./pilot-release-manifest.mjs";
import { validateNodeRuntimeDir, writeNodeRuntimeManifest } from "./node-runtime-staging.mjs";
import { COMMERCIAL_READINESS_SCHEMA_VERSION, validateCommercialReadinessEvidence } from "./commercial-readiness-audit.mjs";
import { auditCommercialEvidenceStatus } from "./commercial-evidence-status.mjs";
import { buildEvidenceFilingPlan, renderEvidenceFilingPlanMarkdown } from "./evidence-filing-plan.mjs";
import { ATTACHMENT_MANIFEST_SCHEMA_VERSION, validateEvidenceAttachmentManifest } from "./evidence-attachment-manifest.mjs";
import { auditEvidenceRepoGuard } from "./evidence-repo-guard.mjs";
import { canonicalizeLicensePayload, OFFLINE_LICENSE_SCHEMA_VERSION, validateOfflineLicense } from "./offline-license-validate.mjs";
import { SIGNED_ARTIFACT_EVIDENCE_SCHEMA_VERSION, validateSignedArtifactEvidence } from "./signed-artifact-evidence.mjs";
import { INSTALLER_EVIDENCE_SCHEMA_VERSION, validateInstallerEvidence } from "./installer-evidence.mjs";
import { AUTO_UPDATE_EVIDENCE_SCHEMA_VERSION, validateAutoUpdateEvidence } from "./auto-update-evidence.mjs";
import { CLINIC_PILOT_REPORT_SCHEMA_VERSION, validateClinicPilotReportEvidence } from "./clinic-pilot-report-evidence.mjs";
import { SUPPORT_READINESS_SCHEMA_VERSION, validateSupportReadinessEvidence } from "./support-readiness-evidence.mjs";
import { DISTRIBUTION_EVIDENCE_SCHEMA_VERSION, validateDistributionEvidence } from "./distribution-evidence.mjs";
import { PRICING_EVIDENCE_SCHEMA_VERSION, validatePricingEvidence } from "./pricing-evidence.mjs";
import { MARKETING_EVIDENCE_SCHEMA_VERSION, validateMarketingEvidence } from "./marketing-evidence.mjs";
import { GO_LIVE_EVIDENCE_SCHEMA_VERSION, loadAndValidateGoLiveEvidence, validateGoLiveEvidence } from "./go-live-evidence.mjs";
import { EXEC_STEPS, FIELD_EVIDENCE_SCHEMA_VERSION, validateFieldEvidenceReport } from "./windows-field-evidence.mjs";
import { validateWindowsCompatibilityEvidence, WINDOWS_COMPATIBILITY_SCHEMA_VERSION } from "./windows-compatibility-evidence.mjs";
import { auditRoadmapCompletion, REQUIRED_LOCAL_EVIDENCE } from "./roadmap-completion-audit.mjs";
import { buildWindowsFieldPacket, renderWindowsFieldPacketMarkdown } from "./windows-field-packet.mjs";
import { buildPackageVerifyPacket, renderPackageVerifyPacketMarkdown } from "./package-verify-packet.mjs";
import { PACKAGE_VERIFY_EVIDENCE_SCHEMA_VERSION, validatePackageVerifyEvidence } from "./package-verify-evidence.mjs";
import { buildInstallerReadinessPacket, renderInstallerReadinessPacketMarkdown } from "./installer-readiness-packet.mjs";
import { buildAutoUpdateReadinessPacket, renderAutoUpdateReadinessPacketMarkdown } from "./auto-update-readiness-packet.mjs";
import { buildGoLiveReadinessPacket, renderGoLiveReadinessPacketMarkdown } from "./go-live-readiness-packet.mjs";
import { buildCommercialLaunchPacket, renderCommercialLaunchPacketMarkdown } from "./commercial-launch-packet.mjs";
import { buildEvidenceCollectionPacket, renderEvidenceCollectionPacketMarkdown } from "./evidence-collection-packet.mjs";
import { auditStagedMarkdownLinks } from "./staged-markdown-link-audit.mjs";
import { intakeSafeResultsZip } from "./intake-safe-results.mjs";

const {
  assertCompiledArtifactTextSafe,
  assertStagedTreeSafe,
  isForbiddenStagedFileName,
  pathHasForbiddenSegment,
  REQUIRED_STAGED_LAYOUT,
  scanStagedArtifacts,
} = artifactRules;

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "pilot-artifact-test-"));
}

function zipDirectoryContents(sourceDir, zipPath) {
  if (process.platform === "win32") {
    const result = spawnSync("pwsh", [
      "-NoProfile",
      "-Command",
      "$ErrorActionPreference = 'Stop'; Compress-Archive -Path (Join-Path $env:ZIP_SOURCE '*') -DestinationPath $env:ZIP_DEST -Force",
    ], {
      env: {
        ...process.env,
        ZIP_SOURCE: sourceDir,
        ZIP_DEST: zipPath,
      },
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    return;
  }
  const result = spawnSync("zip", ["-qr", zipPath, "."], {
    cwd: sourceDir,
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

function writeMinimalGoodTree(root) {
  for (const rel of REQUIRED_STAGED_LAYOUT) {
    if (rel === "RELEASE-MANIFEST.json" || rel === "web/pilot-build.json") {
      continue;
    }
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    if (rel.endsWith(".html") || rel.endsWith(".js")) {
      writeFileSync(abs, "// stub\n", "utf8");
    } else if (rel.endsWith(".json")) {
      writeFileSync(
        abs,
        rel.includes("config.example")
          ? '{"writeMode":"disabled","dataRoot":"C:\\\\ClinicData\\\\DATA"}'
          : '{"name":"test"}',
        "utf8",
      );
    } else {
      writeFileSync(abs, "placeholder\n", "utf8");
    }
  }
  const supervisorPath = join(root, "app/dist/bridge-supervisor.js");
  writeFileSync(
    supervisorPath,
    'const x = { spawn(n, [this.bridgeEntry]) }; // server.js\n',
    "utf8",
  );
}

describe("pilot-release-artifact-rules", () => {
  it("flags forbidden path segments", () => {
    expect(pathHasForbiddenSegment("app/Microdent-Legacy/foo")).toBe(true);
    expect(pathHasForbiddenSegment("app/dist/main.js")).toBe(false);
  });

  it("flags unsafe file extensions", () => {
    expect(isForbiddenStagedFileName("schedule.dbf")).toBe(true);
    expect(isForbiddenStagedFileName(".env")).toBe(true);
    expect(isForbiddenStagedFileName("setup.exe")).toBe(true);
    expect(isForbiddenStagedFileName("run.bat")).toBe(true);
    expect(isForbiddenStagedFileName("fake_tiny.dbf")).toBe(false);
  });

  it("requires root PILOT-START-HERE and qa-runs placeholder in layout", () => {
    expect(REQUIRED_STAGED_LAYOUT).toContain("DOUBLE-CLICK-WINDOWS-TEST.cmd");
    expect(REQUIRED_STAGED_LAYOUT).toContain("DOUBLE-CLICK-AUTO-TEST.cmd");
    expect(REQUIRED_STAGED_LAYOUT).toContain("PILOT-START-HERE.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("clinic-data-copy/DATA/README.txt");
    expect(REQUIRED_STAGED_LAYOUT).toContain("apps/desktop/README.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("bridge/package.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("scripts/README.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("scripts/windows-oneclick-check.ps1");
    expect(REQUIRED_STAGED_LAYOUT).toContain("scripts/import-copied-data.mjs");
    expect(REQUIRED_STAGED_LAYOUT).toContain("scripts/serve-web.mjs");
    expect(REQUIRED_STAGED_LAYOUT).toContain("scripts/write-smoke-evidence.mjs");
    expect(REQUIRED_STAGED_LAYOUT).toContain("sql/migrations/001_initial.sql");
    expect(REQUIRED_STAGED_LAYOUT).toContain("sqlite-mirror/package.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/README.txt");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-auto-update-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-windows-field-run.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-clinic-pilot-report.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-evidence-attachment-manifest.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-windows-compatibility-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-windows-field-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-commercial-readiness-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-distribution-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-go-live-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-installer-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-support-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-support-readiness-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-licensing-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-distribution-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-windows-package-verify-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-pricing-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-pricing-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-marketing-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-marketing-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-offline-license.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/TEMPLATE-signed-artifact-evidence.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("web/pilot-build.json");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/auto-update-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/evidence-attachment-manifest.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/clinic-pilot-report-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/support-knowledge-base.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/support-readiness-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/pilot-feedback-triage-workflow.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/support-readiness-checklist.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/licensing-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/distribution-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/distribution-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/pricing-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/pricing-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/marketing-readiness.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/marketing-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/go-live-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/installer-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/offline-license-mechanism.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/evidence-collection-packet.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/signed-artifact-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-compatibility-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-package-verify-evidence.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-ci-oneclick.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-pilot-runbook.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-pilot-packaging-gap-report.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-pilot-pre-installer-checklist.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/windows-dev-dry-run.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-3-backup-cli.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-3-restore-cli.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-3-sandbox-qa-runner.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-3-windows-readiness-audit.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-4-windows-operator-quickstart.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-5-operator-qa-runbook.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-6-windows-mvp-operator-guide.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("docs/phase-7-sandbox-pilot-qa-runbook.md");
  });

  it("rejects synthetic bad package (dbf + env + exe + extra file)", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      mkdirSync(join(root, "leak"), { recursive: true });
      writeFileSync(join(root, "leak", "schedule.dbf"), "bad", "utf8");
      writeFileSync(join(root, ".env"), "SECRET=1\n", "utf8");
      writeFileSync(join(root, "run.exe"), "bad", "utf8");
      writeFileSync(join(root, "unmanifested-extra.txt"), "extra\n", "utf8");
      expect(() => scanStagedArtifacts(root)).toThrow(/forbidden/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects /Users/ path leak in compiled bridge artifact", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      writeFileSync(
        join(root, "bridge", "leak.js"),
        'const p = "/Users/Tamam/Desktop/Microdent";\n',
        "utf8",
      );
      expect(() => scanStagedArtifacts(root)).toThrow(/forbidden compiled path literal/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects log files under logs/", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      writeFileSync(join(root, "logs", "bridge.log"), "leaked log line\n", "utf8");
      expect(() => scanStagedArtifacts(root)).toThrow(/forbidden file name or extension/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows only the root Windows double-click runner cmd", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      writeFileSync(join(root, "scripts", "bad-helper.cmd"), "echo bad\n", "utf8");
      expect(() => scanStagedArtifacts(root)).toThrow(/forbidden file name or extension/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows %AppData% placeholder in compiled setup HTML", () => {
    expect(() =>
      assertCompiledArtifactTextSafe(
        '<p>Config: %AppData%\\Microdent\\config.json</p>',
        "app/dist/setup/setup.html",
      ),
    ).not.toThrow();
  });

  it("accepts synthetic good package before manifest", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      expect(() => scanStagedArtifacts(root)).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("staged-markdown-link-audit", () => {
  it("rejects unexpected missing staged markdown links", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "index.md"), "[Missing](./missing.md)\n", "utf8");

      const result = auditStagedMarkdownLinks({ stageRoot: root, allowedMissingTargets: new Set() });

      expect(result.ready).toBe(false);
      expect(result.errors.join("\n")).toContain("unexpected missing staged markdown link");
      expect(result.broken).toEqual(["docs/index.md -> ./missing.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows explicitly documented missing staged markdown links", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs", "index.md"), "[Missing](./missing.md)\n", "utf8");

      const allowedMissingTargets = new Set(["docs/index.md -> ./missing.md"]);
      const result = auditStagedMarkdownLinks({ stageRoot: root, allowedMissingTargets });

      expect(result.ready).toBe(true);
      expect(result.allowed).toEqual(["docs/index.md -> ./missing.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips vendored node_modules package markdown", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "node_modules", "vendor"), { recursive: true });
      writeFileSync(join(root, "node_modules", "vendor", "README.md"), "[Missing](./missing.md)\n", "utf8");

      const result = auditStagedMarkdownLinks({ stageRoot: root, allowedMissingTargets: new Set() });

      expect(result.ready).toBe(true);
      expect(result.checkedFiles).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips bundled Node runtime markdown", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "node"), { recursive: true });
      writeFileSync(join(root, "node", "README.md"), "[Missing](./missing.md)\n", "utf8");

      const result = auditStagedMarkdownLinks({ stageRoot: root, allowedMissingTargets: new Set() });

      expect(result.ready).toBe(true);
      expect(result.checkedFiles).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("evidence-repo-guard", () => {
  it("accepts PHI-safe qa-runs report extensions", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(join(root, "qa-runs", "2026-06-06-field-summary.md"), "No real patient data.\n", "utf8");
      writeFileSync(join(root, "qa-runs", "2026-06-06-evidence.json"), "{}\n", "utf8");
      writeFileSync(join(root, "qa-runs", "2026-06-06-results.tsv"), "step\tstatus\n", "utf8");
      writeFileSync(join(root, "qa-runs", "2026-06-06-helper.sh"), "#!/usr/bin/env bash\n", "utf8");

      const result = auditEvidenceRepoGuard({ repoRoot: root });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("ready");
      expect(result.checkedFiles).toBe(4);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects raw attachments and data under qa-runs", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs", "attachments"), { recursive: true });
      writeFileSync(join(root, "qa-runs", "screenshot.png"), "not an image\n", "utf8");
      writeFileSync(join(root, "qa-runs", "export.pdf"), "not a pdf\n", "utf8");
      writeFileSync(join(root, "qa-runs", "bridge.log"), "log line\n", "utf8");
      writeFileSync(join(root, "qa-runs", "clinic.sqlite"), "sqlite bytes\n", "utf8");
      writeFileSync(join(root, "qa-runs", "attachments", "redacted.txt"), "tracker reference only\n", "utf8");

      const result = auditEvidenceRepoGuard({ repoRoot: root });
      const reasons = result.violations.map(({ reason }) => reason).join("\n");

      expect(result.ok).toBe(false);
      expect(result.status).toBe("blocked");
      expect(reasons).toMatch(/raw screenshot\/image file/);
      expect(reasons).toMatch(/raw PDF attachment/);
      expect(reasons).toMatch(/raw log file/);
      expect(reasons).toMatch(/raw SQLite data file/);
      expect(reasons).toMatch(/raw attachment\/data directory segment/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("windows-field-packet", () => {
  it("builds a PHI-safe packet covering every EXEC step", () => {
    const packet = buildWindowsFieldPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });

    expect(packet.status).toBe("blocked-until-field-run");
    expect(packet.steps.map((step) => step.id)).toEqual(EXEC_STEPS);
    expect(packet.evidenceTargets.attachmentManifestPath)
      .toBe("qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
    expect(packet.evidenceTargets.packageVerifyEvidencePath)
      .toBe("qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
    expect(packet.evidenceTargets.fieldEvidencePath)
      .toBe("qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json");
    expect(packet.commands).toContain("pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:package-verify-evidence -- qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
    expect(packet.commands).toContain("pnpm pilot:evidence-repo-guard");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:field-evidence -- qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json");
  });

  it("renders field packet markdown without raw evidence instructions", () => {
    const packet = buildWindowsFieldPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });
    const markdown = renderWindowsFieldPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern Windows field execution packet");
    expect(markdown).toContain("`EXEC-16`");
    expect(markdown).toContain("pnpm pilot:attachment-manifest");
    expect(markdown).toContain("pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip");
    expect(markdown).toContain("read-only smoke stays `READ_ONLY_READY`");
    expect(markdown).toContain("pnpm pilot:evidence-repo-guard");
    expect(markdown).toContain("ROADMAP COMPLETION: BLOCKED");
    expect(markdown).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT payload|raw DBF\/SQLite rows.*paste/i);
  });
});

describe("package-verify-packet", () => {
  it("builds a blocked packet for Windows staged package verification", () => {
    const packet = buildPackageVerifyPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
      packagePath: "C:\\Microdent\\MicrodentModern",
    });

    expect(packet.status).toBe("blocked-until-windows-package-verified");
    expect(packet.packetTargets.packagePacketPath).toBe("qa-runs/2026-06-06-windows-package-verify-packet-CLINIC-PC-01.md");
    expect(packet.packetTargets.packageEvidencePath).toBe("qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
    expect(packet.packetTargets.attachmentManifestPath).toBe("qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
    expect(packet.packetTargets.fieldPacketPath).toBe("qa-runs/2026-06-06-windows-field-packet-CLINIC-PC-01.md");
    expect(packet.checks.map((check) => check.id)).toEqual([
      "PKG-01",
      "PKG-02",
      "PKG-03",
      "PKG-04",
      "PKG-05",
      "PKG-06",
      "PKG-07",
      "PKG-08",
    ]);
    expect(packet.commands).toContain("pnpm pilot:package-verify-evidence -- qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
    expect(packet.commands).toContain("pnpm pilot:evidence-repo-guard");
    expect(packet.commands.join("\n"))
      .toContain("pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01");
  });

  it("renders package packet markdown without claiming field execution", () => {
    const packet = buildPackageVerifyPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });
    const markdown = renderPackageVerifyPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern Windows package verification packet");
    expect(markdown).toContain("docs/windows-pilot-package-verify-on-windows.md");
    expect(markdown).toContain("TEMPLATE-windows-package-verify-evidence.json");
    expect(markdown).toContain("does not prove the app works on Windows");
    expect(markdown).toContain("blocked-until-windows-package-verified");
    expect(markdown).not.toContain("FIELD EVIDENCE: READY");
    expect(markdown).not.toContain("ROADMAP COMPLETION: READY");
  });
});

function makePackageVerifyEvidence(overrides = {}) {
  return {
    schemaVersion: PACKAGE_VERIFY_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      appVersion: "0.0.1",
      gitCommit: "a96131b",
      releaseChannel: "pilot",
    },
    machine: {
      label: "CLINIC-PC-01",
      windowsVersion: "Windows 11 23H2",
      verifierRole: "IT",
    },
    package: {
      rootCategory: "portable-handoff",
      manifestPath: "RELEASE-MANIFEST.json",
      pilotBuildPath: "web/pilot-build.json",
      verificationDoc: "docs/windows-pilot-package-verify-on-windows.md",
    },
    checks: {
      layoutPresent: "pass",
      manifestFieldsRecorded: "pass",
      manifestSafe: "pass",
      forbiddenArtifactsAbsent: "pass",
      configTemplatesPlaceholders: "pass",
      placeholderFoldersClean: "pass",
      pilotBuildMatchesManifest: "pass",
      operatorDocsPresent: "pass",
      unsupportedFeaturesRecorded: "pass",
    },
    nodeRuntimeState: "placeholder-only",
    decision: {
      status: "pass",
      approverRole: "IT",
      date: "2026-06-06",
      attachmentManifestPath: "qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json",
    },
    rawArtifactsCommitted: false,
    rawLogsAttached: false,
    phiObserved: false,
    ...overrides,
  };
}

describe("package-verify-evidence", () => {
  it("accepts complete Windows package verification evidence", () => {
    const result = validatePackageVerifyEvidence(makePackageVerifyEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and blocked package checks", () => {
    const result = validatePackageVerifyEvidence(makePackageVerifyEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        appVersion: "0.0.1",
        gitCommit: "abcdef1",
        releaseChannel: "pilot",
      },
      checks: {
        ...makePackageVerifyEvidence().checks,
        layoutPresent: "blocked",
        forbiddenArtifactsAbsent: "blocked",
      },
      decision: {
        ...makePackageVerifyEvidence().decision,
        date: "YYYY-MM-DD",
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/checks\.layoutPresent/);
    expect(result.errors.join("\n")).toMatch(/checks\.forbiddenArtifactsAbsent/);
  });

  it("rejects PHI-sensitive and raw artifact package evidence", () => {
    const report = makePackageVerifyEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "PowerShell found PAT_NAME and schedule.dbf in the copied output",
    });

    const result = validatePackageVerifyEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/PAT_NAME/);
    expect(result.errors.join("\n")).toMatch(/raw data\/log artifact/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json"),
        `${JSON.stringify(makePackageVerifyEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "package-verify-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PACKAGE VERIFY: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installer-readiness-packet", () => {
  it("builds a blocked packet for signed artifact and installer evidence", () => {
    const packet = buildInstallerReadinessPacket({
      date: "2026-06-06",
      installerTarget: "nsis",
    });

    expect(packet.status).toBe("blocked-until-signed-installer-candidate");
    expect(packet.evidenceTargets.signedArtifactEvidencePath).toBe("qa-runs/2026-06-06-signed-artifact-evidence.json");
    expect(packet.evidenceTargets.installerEvidencePath).toBe("qa-runs/2026-06-06-installer-evidence.json");
    expect(packet.checks.map((check) => check.id)).toEqual([
      "SIGN-01",
      "SIGN-02",
      "SIGN-03",
      "SIGN-04",
      "INST-01",
      "INST-02",
      "INST-03",
      "INST-04",
      "INST-05",
    ]);
    expect(packet.commands).toContain("pnpm pilot:evidence-repo-guard");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:signed-artifacts -- qa-runs/2026-06-06-signed-artifact-evidence.json");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:installer-evidence -- qa-runs/2026-06-06-installer-evidence.json");
  });

  it("renders installer packet markdown without claiming installer readiness", () => {
    const packet = buildInstallerReadinessPacket({
      date: "2026-06-06",
      installerTarget: "msi",
    });
    const markdown = renderInstallerReadinessPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern signed installer readiness packet");
    expect(markdown).toContain("blocked-until-signed-installer-candidate");
    expect(markdown).toContain("pnpm pilot:signed-artifacts");
    expect(markdown).toContain("pnpm pilot:installer-evidence");
    expect(markdown).toContain("commercial readiness blocked");
    expect(markdown).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT payload/);
    expect(markdown).not.toContain("INSTALLER EVIDENCE: READY");
  });
});

describe("auto-update-readiness-packet", () => {
  it("builds a blocked packet for signed update evidence", () => {
    const packet = buildAutoUpdateReadinessPacket({
      date: "2026-06-06",
      channel: "internal-signed-feed",
    });

    expect(packet.status).toBe("blocked-until-signed-update-channel");
    expect(packet.evidenceTargets.signedArtifactEvidencePath).toBe("qa-runs/2026-06-06-signed-artifact-evidence.json");
    expect(packet.evidenceTargets.autoUpdateEvidencePath).toBe("qa-runs/2026-06-06-auto-update-evidence.json");
    expect(packet.checks.map((check) => check.id)).toEqual([
      "UPD-01",
      "UPD-02",
      "UPD-03",
      "UPD-04",
      "UPD-05",
      "UPD-06",
      "UPD-07",
    ]);
    expect(packet.commands).toContain("pnpm pilot:evidence-repo-guard");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:signed-artifacts -- qa-runs/2026-06-06-signed-artifact-evidence.json");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:auto-update-evidence -- qa-runs/2026-06-06-auto-update-evidence.json");
  });

  it("renders auto-update packet markdown without enabling update claims", () => {
    const packet = buildAutoUpdateReadinessPacket({
      date: "2026-06-06",
      channel: "manual-it-redeploy",
    });
    const markdown = renderAutoUpdateReadinessPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern auto-update readiness packet");
    expect(markdown).toContain("blocked-until-signed-update-channel");
    expect(markdown).toContain("pnpm pilot:auto-update-evidence");
    expect(markdown).toContain("no PHI, local paths, DBF/SQLite rows");
    expect(markdown).toContain("commercial readiness blocked");
    expect(markdown).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT payload/);
    expect(markdown).not.toContain("AUTO UPDATE EVIDENCE: READY");
  });
});

describe("go-live-readiness-packet", () => {
  it("builds a blocked packet for clinic pilot and final approval evidence", () => {
    const packet = buildGoLiveReadinessPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });

    expect(packet.status).toBe("blocked-until-real-pilot-and-approvals");
    expect(packet.evidenceTargets.fieldEvidencePath).toBe("qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json");
    expect(packet.evidenceTargets.clinicPilotReportPath).toBe("qa-runs/2026-06-06-clinic-pilot-report-CLINIC-PC-01.json");
    expect(packet.evidenceTargets.supportEvidencePath).toBe("qa-runs/2026-06-06-support-readiness-evidence.json");
    expect(packet.evidenceTargets.commercialReadinessPath).toBe("qa-runs/2026-06-06-commercial-readiness-evidence.json");
    expect(packet.evidenceTargets.goLiveEvidencePath).toBe("qa-runs/2026-06-06-go-live-evidence.json");
    expect(packet.checks.map((check) => check.id)).toEqual([
      "LIVE-01",
      "LIVE-02",
      "LIVE-03",
      "LIVE-04",
      "LIVE-05",
      "LIVE-06",
    ]);
    expect(packet.commands).toContain("pnpm pilot:evidence-repo-guard");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:clinic-report -- qa-runs/2026-06-06-clinic-pilot-report-CLINIC-PC-01.json");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:go-live-evidence -- qa-runs/2026-06-06-go-live-evidence.json");
  });

  it("renders go-live packet markdown without approving launch", () => {
    const packet = buildGoLiveReadinessPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });
    const markdown = renderGoLiveReadinessPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern go-live readiness packet");
    expect(markdown).toContain("blocked-until-real-pilot-and-approvals");
    expect(markdown).toContain("IT lead, pilot sponsor, and support lead roles/dates");
    expect(markdown).toContain("Keep commercial readiness blocked");
    expect(markdown).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT payload/);
    expect(markdown).not.toContain("GO-LIVE EVIDENCE: READY");
  });
});

describe("commercial-launch-packet", () => {
  it("builds a blocked packet for support, license, distribution, pricing, and marketing evidence", () => {
    const packet = buildCommercialLaunchPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });

    expect(packet.status).toBe("blocked-until-commercial-evidence-filed");
    expect(packet.evidenceTargets.supportEvidencePath).toBe("qa-runs/2026-06-06-support-readiness-evidence.json");
    expect(packet.evidenceTargets.licenseEvidencePath).toBe("qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json");
    expect(packet.evidenceTargets.distributionEvidencePath).toBe("qa-runs/2026-06-06-distribution-evidence.json");
    expect(packet.evidenceTargets.pricingEvidencePath).toBe("qa-runs/2026-06-06-pricing-evidence.json");
    expect(packet.evidenceTargets.marketingEvidencePath).toBe("qa-runs/2026-06-06-marketing-evidence.json");
    expect(packet.evidenceTargets.commercialReadinessPath).toBe("qa-runs/2026-06-06-commercial-readiness-evidence.json");
    expect(packet.checks.map((check) => check.id)).toEqual([
      "COMM-01",
      "COMM-02",
      "COMM-03",
      "COMM-04",
      "COMM-05",
      "COMM-06",
    ]);
    expect(packet.commands).toContain("pnpm pilot:evidence-repo-guard");
    expect(packet.commands.join("\n")).toContain("pnpm pilot:support-readiness -- qa-runs/2026-06-06-support-readiness-evidence.json");
    expect(packet.commands.join("\n")).toContain("pnpm license:validate -- qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json");
  });

  it("renders commercial launch packet markdown without marking launch ready", () => {
    const packet = buildCommercialLaunchPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });
    const markdown = renderCommercialLaunchPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern commercial launch readiness packet");
    expect(markdown).toContain("blocked-until-commercial-evidence-filed");
    expect(markdown).toContain("support, licensing, distribution, pricing, marketing");
    expect(markdown).toContain("Keep roadmap completion blocked");
    expect(markdown).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT payload/);
    expect(markdown).not.toContain("COMMERCIAL READINESS: READY");
  });
});

describe("evidence-collection-packet", () => {
  it("builds a blocked master packet that coordinates every evidence packet and final audit", () => {
    const packet = buildEvidenceCollectionPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
      publicKeyPath: "keys/microdent-license-public.pem",
    });

    expect(packet.status).toBe("blocked-until-real-evidence-filed");
    expect(packet.packetTargets.packageVerifyPacketPath).toBe("qa-runs/2026-06-06-windows-package-verify-packet-CLINIC-PC-01.md");
    expect(packet.packetTargets.windowsFieldPacketPath).toBe("qa-runs/2026-06-06-windows-field-packet-CLINIC-PC-01.md");
    expect(packet.packetTargets.evidenceFilingPlanPath).toBe("qa-runs/2026-06-06-evidence-filing-plan.md");
    expect(packet.commands.map((entry) => entry.phase)).toEqual([
      "Windows package verification",
      "Tier 3 Windows field run",
      "Signed installer readiness",
      "Signed update readiness",
      "Commercial launch evidence",
      "Go-live approval evidence",
      "Master filing checklist",
      "Returned safe-results intake",
      "Repository PHI guard",
      "Commercial evidence status",
      "Strict roadmap completion audit",
    ]);
    expect(packet.commands.map((entry) => entry.command).join("\n"))
      .toContain("pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem --write qa-runs/2026-06-06-windows-package-verify-packet-CLINIC-PC-01.md");
    expect(packet.commands.map((entry) => entry.command).join("\n"))
      .toContain("pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem --write qa-runs/2026-06-06-windows-field-packet-CLINIC-PC-01.md");
    expect(packet.commands.map((entry) => entry.command).join("\n"))
      .toContain("pnpm pilot:evidence-filing-plan -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem --write qa-runs/2026-06-06-evidence-filing-plan.md");
    expect(packet.commands.map((entry) => entry.command).join("\n"))
      .toContain("pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip");
    expect(packet.commands.map((entry) => entry.command).join("\n"))
      .toContain("pnpm roadmap:completion-audit -- --public-key keys/microdent-license-public.pem");
  });

  it("renders master packet markdown without creating evidence or approving readiness", () => {
    const packet = buildEvidenceCollectionPacket({
      date: "2026-06-06",
      clinicLabel: "CLINIC-PC-01",
    });
    const markdown = renderEvidenceCollectionPacketMarkdown(packet);

    expect(markdown).toContain("# Microdent Modern master evidence collection packet");
    expect(markdown).toContain("does not create evidence JSON");
    expect(markdown).toContain("ROADMAP COMPLETION: BLOCKED");
    expect(markdown).toContain("pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip");
    expect(markdown).toContain("read-only smoke evidence stays `READ_ONLY_READY`");
    expect(markdown).toContain("pnpm pilot:evidence-repo-guard");
    expect(markdown).not.toContain("ROADMAP COMPLETION: READY");
    expect(markdown).not.toContain("commercially ready");
  });

  it("writes relative packet output under the repo root when invoked from another cwd", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const root = makeTempDir();
    const writePath = "qa-runs/2026-06-06-evidence-collection-packet-CLINIC-PC-01.md";
    const repoOutputPath = join(repoRoot, writePath);
    const accidentalCwdPath = join(root, writePath);
    try {
      if (existsSync(repoOutputPath)) {
        unlinkSync(repoOutputPath);
      }

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "evidence-collection-packet.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--date",
        "2026-06-06",
        "--clinic-label",
        "CLINIC-PC-01",
        "--write",
        writePath,
      ], {
        cwd: root,
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`[evidence-collection-packet] wrote ${writePath}`);
      const markdown = readFileSync(repoOutputPath, "utf8");
      expect(markdown).toContain("# Microdent Modern master evidence collection packet");
      expect(markdown).toContain("blocked-until-real-evidence-filed");
      expect(existsSync(accidentalCwdPath)).toBe(false);
    } finally {
      if (existsSync(repoOutputPath)) {
        unlinkSync(repoOutputPath);
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("honors absolute packet write paths across the evidence packet chain", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const scriptsDir = dirname(fileURLToPath(import.meta.url));
    const root = makeTempDir();
    const cases = [
      {
        script: "package-verify-packet.mjs",
        outputName: "package-verify-packet.md",
        stdoutPrefix: "package-verify-packet",
        heading: "# Microdent Modern Windows package verification packet",
        args: ["--clinic-label", "CLINIC-PC-01"],
      },
      {
        script: "windows-field-packet.mjs",
        outputName: "windows-field-packet.md",
        stdoutPrefix: "windows-field-packet",
        heading: "# Microdent Modern Windows field execution packet",
        args: ["--clinic-label", "CLINIC-PC-01"],
      },
      {
        script: "installer-readiness-packet.mjs",
        outputName: "installer-readiness-packet.md",
        stdoutPrefix: "installer-readiness-packet",
        heading: "# Microdent Modern signed installer readiness packet",
        args: [],
      },
      {
        script: "auto-update-readiness-packet.mjs",
        outputName: "auto-update-readiness-packet.md",
        stdoutPrefix: "auto-update-readiness-packet",
        heading: "# Microdent Modern auto-update readiness packet",
        args: [],
      },
      {
        script: "commercial-launch-packet.mjs",
        outputName: "commercial-launch-packet.md",
        stdoutPrefix: "commercial-launch-packet",
        heading: "# Microdent Modern commercial launch readiness packet",
        args: ["--clinic-label", "CLINIC-PC-01"],
      },
      {
        script: "go-live-readiness-packet.mjs",
        outputName: "go-live-readiness-packet.md",
        stdoutPrefix: "go-live-readiness-packet",
        heading: "# Microdent Modern go-live readiness packet",
        args: ["--clinic-label", "CLINIC-PC-01"],
      },
      {
        script: "evidence-collection-packet.mjs",
        outputName: "evidence-collection-packet.md",
        stdoutPrefix: "evidence-collection-packet",
        heading: "# Microdent Modern master evidence collection packet",
        args: ["--clinic-label", "CLINIC-PC-01"],
      },
    ];

    try {
      for (const packetCase of cases) {
        const writePath = join(root, packetCase.outputName);
        const accidentalRepoPath = join(repoRoot, writePath);
        const result = spawnSync(process.execPath, [
          join(scriptsDir, packetCase.script),
          "--date",
          "2026-06-06",
          ...packetCase.args,
          "--write",
          writePath,
        ], {
          cwd: root,
          encoding: "utf8",
        });

        expect(result.stderr, packetCase.script).toBe("");
        expect(result.status, packetCase.script).toBe(0);
        expect(result.stdout, packetCase.script).toContain(`[${packetCase.stdoutPrefix}] wrote ${writePath}`);
        expect(readFileSync(writePath, "utf8"), packetCase.script).toContain(packetCase.heading);
        expect(existsSync(accidentalRepoPath), packetCase.script).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("staged evidence collection pointer", () => {
  it("keeps the staged script pointer focused on repo-side PHI-safe packet generation", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const stageScript = readFileSync(join(repoRoot, "scripts", "stage-pilot-release.mjs"), "utf8");
    const doc = readFileSync(join(repoRoot, "docs", "evidence-collection-packet.md"), "utf8");

    expect(stageScript).toContain("Evidence collection (from a full repo checkout, not this staged package)");
    expect(stageScript).toContain("pnpm pilot:evidence-collection-packet -- --clinic-label CLINIC-PC-01 --write");
    expect(stageScript).toContain("does not create evidence JSON or approve readiness");
    expect(stageScript).toContain("DOUBLE-CLICK-WINDOWS-TEST.cmd");
    expect(stageScript).toContain("DOUBLE-CLICK-AUTO-TEST.cmd");
    expect(stageScript).toContain("scripts\\\\windows-oneclick-check.ps1 -SkipPnpm");
    expect(stageScript).toContain("pnpm microdent:oneclick:windows");
    expect(stageScript).toContain("does not replace DOUBLE-CLICK-AUTO-TEST.cmd");
    expect(stageScript).toContain("copyFileSafe(join(repoRoot, \"scripts\", \"windows-oneclick-check.ps1\")");
    expect(stageScript).toContain("writeWindowsAutoTestRunner");
    expect(stageScript).toContain("WINDOWS-AUTO-TEST-REPORT.txt");
    expect(stageScript).toContain("if /I \\\"%~1\\\"==\\\"--ci\\\" set \\\"NONINTERACTIVE=yes\\\"");
    expect(stageScript).toContain("if /I \\\"%CI%\\\"==\\\"true\\\" set \\\"NONINTERACTIVE=yes\\\"");
    expect(stageScript).toContain("Non-interactive: %NONINTERACTIVE%");
    expect(stageScript).toContain("Looking for desktop runtime first");
    expect(stageScript).toContain("Microdent Modern.exe");
    expect(stageScript).toContain("electron\\\\electron.exe");
    expect(stageScript).toContain("No desktop .exe or Electron runtime found. Opening local HTTP browser preview.");
    expect(stageScript).toContain("/v1/patients/search?q=");
    expect(stageScript).toContain("/v1/schedule/appointments");
    expect(stageScript).toContain("Patients API probe: %PATIENTS_OK%");
    expect(stageScript).toContain("Schedule API probe: %SCHEDULE_OK%");
    expect(stageScript).toContain("set \\\"APP_OPENED=yes\\\"");
    expect(stageScript).toContain("Data folder selected: copied package drop folder");
    expect(stageScript).toContain("scripts\\\\import-copied-data.mjs");
    expect(stageScript).toContain("scripts\\\\serve-web.mjs");
    expect(stageScript).toContain("scripts\\\\write-smoke-evidence.mjs");
    expect(stageScript).toContain("MicrodentClinicPilot");
    expect(stageScript).toContain("set \\\"QA_ROOT=%RUN_ROOT%\\\\qa-runs\\\"");
    expect(stageScript).toContain("set \\\"RUN_ROOT=%TEMP%\\\\MicrodentClinicPilot\\\"");
    expect(stageScript).toContain("set \\\"REPORT=%QA_ROOT%\\\\WINDOWS-SMOKE-REPORT.txt\\\"");
    expect(stageScript).toContain("set \\\"WEB_URL_FILE=%QA_ROOT%\\\\WEB-PREVIEW-URL.txt\\\"");
    expect(stageScript).toContain("set \\\"WEB_HEALTH_FILE=%QA_ROOT%\\\\WEB-PREVIEW-HEALTH.txt\\\"");
    expect(stageScript).toContain("Web preview health probe: %WEB_HEALTH%");
    expect(stageScript).toContain("If Chrome shows a blank or error page");
    expect(stageScript).toContain("set \\\"RESULTS_ZIP=%QA_ROOT%\\\\MicrodentModern-safe-results.zip\\\"");
    expect(stageScript).toContain("The optional DATA path prompt below is local-only and redacted in the report.");
    expect(stageScript).toContain("Prefer clinic-data-copy\\\\DATA. Never paste a live production legacy path.");
    expect(stageScript).toContain("set \\\"BRIDGE_HEALTH_FILE=%QA_ROOT%\\\\BRIDGE-HEALTH.txt\\\"");
    expect(stageScript).toContain("Clinic service health probe: %BRIDGE_HEALTH%");
    expect(stageScript).toContain("Close any old Microdent or node.exe windows");
    expect(stageScript).toContain("Operator read-only smoke answers: %OPERATOR_READ_ONLY_SMOKE%");
    expect(stageScript).toContain("Unsupported writes attempted: no");
    expect(stageScript).toContain("Safe results bundle target: MicrodentModern-safe-results.zip");
    expect(stageScript).toContain("if /I \\\"%NONINTERACTIVE%\\\"==\\\"yes\\\" exit /b 0");
    expect(stageScript).toContain("\\\"%NODE_EXE%\\\" \\\"%ROOT%scripts\\\\write-smoke-evidence.mjs\\\"");
    expect(stageScript).not.toContain("write-smoke-evidence.mjs\\\" >> \\\"%REPORT%\\\"");
    expect(stageScript).not.toContain(">> \\\"%REPORT%\\\" echo Safe results bundle: created");
    expect(stageScript).not.toContain(">> \\\"%REPORT%\\\" echo Safe results bundle: not created");
    expect(stageScript).toContain("writePlaceholderDir(\"clinic-data-copy/DATA\"");
    expect(stageScript).toContain("For the portable pilot smoke test only, copy the clinic DATA files into clinic-data-copy\\\\DATA\\\\.");
    expect(stageScript).toContain("For the portable pilot smoke test only, copy the clinic `DATA` files into `clinic-data-copy\\\\DATA\\\\`.");
    expect(stageScript).toContain("del /q \\\"%QA_ROOT%\\\\*-evidence-attachment-manifest-CLINIC-PC-01.json\\\"");
    expect(stageScript).toContain("*-evidence-attachment-manifest-CLINIC-PC-01.json");
    expect(stageScript).toContain("*-windows-package-verify-evidence-CLINIC-PC-01.json");
    expect(stageScript).toContain("*-windows-field-evidence-CLINIC-PC-01.json");
    expect(stageScript).toContain("$jsons.Count -eq 3");
    expect(stageScript).toContain("$files=@($report) + $jsons");
    expect(stageScript).toContain("Compress-Archive -LiteralPath $files -DestinationPath $env:RESULTS_ZIP -Force");
    expect(stageScript).toContain("start \\\"\\\" explorer \\\"%QA_ROOT%\\\"");
    expect(stageScript).toContain("Send back only MicrodentModern-safe-results.zip");
    expect(stageScript).toContain("send back only MicrodentModern-safe-results.zip from the opened qa-runs folder");
    expect(stageScript).toContain("send back only `MicrodentModern-safe-results.zip` from the opened `qa-runs` folder");
    expect(stageScript).toContain("Do not send DBF, SQLite, config, logs, screenshots, or the copied DATA folder");
    expect(stageScript).toContain("file.rel.startsWith(\\\"clinic-data-copy/DATA/\\\")");
    expect(stageScript).toContain("packageRoot: \\\"portable-handoff-folder\\\"");
    expect(stageScript).toContain("dataRoot: \\\"copied-local-test-folder\\\"");
    expect(stageScript).toContain("sqlitePath: \\\"generated-local-mirror\\\"");
    expect(stageScript).toContain("backupDir: \\\"generated-local-backups\\\"");
    expect(stageScript).not.toContain("set \\\"REPORT=%ROOT%qa-runs\\\\WINDOWS-SMOKE-REPORT.txt\\\"");
    expect(stageScript).not.toContain("Get-ChildItem -LiteralPath $env:QA_ROOT -Filter '*.json'");
    expect(stageScript).toContain("windows-package-verify-evidence");
    expect(stageScript).toContain("windows-field-evidence");
    expect(stageScript).toContain("Importing patients, appointments, schedule, treatments, doctors, procedures");
    expect(stageScript).toContain("This prints counts only. It does not print patient names.");
    expect(stageScript).toContain("http://127.0.0.1:4173/");
    expect(stageScript).toContain("if exist \\\"%WEB_URL_FILE%\\\" set /p WEB_URL=<\\\"%WEB_URL_FILE%\\\"");
    expect(stageScript).not.toContain("start \"\" \"%ROOT%web\\\\index.html\"");
    expect(stageScript).toContain("const qaRoot = process.env.QA_ROOT || join(packageRoot, \\\"qa-runs\\\")");
    expect(stageScript).toContain("const readOnlySmokeReady = packageReady && nodeVersionOk && appOpened");
    expect(stageScript).toContain("readOnlySmokeReady ? \\\"go-read-only-smoke\\\" : \\\"no-go-read-only-smoke\\\"");
    expect(stageScript).toContain("evidence-collection-packet.md");
    expect(doc).toContain("does **not** create evidence JSON");
    expect(doc).toContain("ROADMAP COMPLETION: BLOCKED");
  });

  it("keeps staged operator docs aligned to the root double-click runner", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const docs = [
      "docs/PILOT-HANDOFF-PACK.md",
      "docs/pilot-tester-guide.md",
      "docs/windows-pilot-field-execution-script.md",
      "docs/windows-pilot-real-machine-checklist.md",
      "docs/windows-pilot-package-verify-on-windows.md",
      "docs/windows-pilot-troubleshooting-pack.md",
    ].map((relPath) => [relPath, readFileSync(join(repoRoot, relPath), "utf8")]);

    for (const [relPath, text] of docs) {
      expect(text, relPath).toContain("DOUBLE-CLICK-WINDOWS-TEST.cmd");
      expect(text, relPath).not.toMatch(/Launch desktop from staged `app\/`/i);
      expect(text, relPath).not.toMatch(/Launch the desktop shell from `app\/`/i);
      expect(text, relPath).not.toMatch(/C:\\Microdent\\MicrodentModern\\app\\/i);
    }

    const packageVerify = readFileSync(join(repoRoot, "docs", "windows-pilot-package-verify-on-windows.md"), "utf8");
    expect(packageVerify).toContain("$allowedRel");
    expect(packageVerify).toContain("'DOUBLE-CLICK-WINDOWS-TEST.cmd'");
    expect(packageVerify).toContain("'DOUBLE-CLICK-AUTO-TEST.cmd'");
    expect(packageVerify).toContain("'node\\node.exe'");
    expect(readFileSync(join(repoRoot, "docs", "windows-pilot-field-execution-script.md"), "utf8")).toContain("send back only `MicrodentModern-safe-results.zip`");
    expect(readFileSync(join(repoRoot, "docs", "windows-pilot-field-result-form.md"), "utf8")).toContain("send back only `MicrodentModern-safe-results.zip`");
  });
});

describe("pilot-release-manifest", () => {
  it("round-trips manifest hashes on good tree", async () => {
    const root = makeTempDir();
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    try {
      writeMinimalGoodTree(root);
      scanStagedArtifacts(root);
      await generateReleaseManifest(root, { repoRoot, buildTimestampUtc: "2026-05-21T00:00:00.000Z" });
      const raw = readFileSync(join(root, "RELEASE-MANIFEST.json"), "utf8");
      assertManifestJsonSafe(raw);
      const manifest = JSON.parse(raw);
      expect(manifest.fileCount).toBeGreaterThan(0);
      expect(manifest.packageName).toBe("MicrodentModern");
      expect(manifest.packageVersion).toBe("pilot-2026-05-21");
      expect(manifest.releaseChannel).toBe("pilot");
      expect(manifest.unsupportedFeatures).toEqual(UNSUPPORTED_FEATURES);
      const pilotBuild = JSON.parse(readFileSync(join(root, "web/pilot-build.json"), "utf8"));
      expect(pilotBuild).toEqual(buildPilotBuildMetadata(manifest));
      await verifyManifestHashes(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails verify when a staged file is tampered", async () => {
    const root = makeTempDir();
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    try {
      writeMinimalGoodTree(root);
      await generateReleaseManifest(root, { repoRoot, buildTimestampUtc: "2026-05-21T00:00:00.000Z" });
      writeFileSync(join(root, "HANDOFF-README.txt"), "tampered\n", "utf8");
      await expect(verifyManifestHashes(root)).rejects.toThrow(/mismatch for HANDOFF-README\.txt/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails verify when a manifest file is missing on disk", async () => {
    const root = makeTempDir();
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    try {
      writeMinimalGoodTree(root);
      await generateReleaseManifest(root, { repoRoot, buildTimestampUtc: "2026-05-21T00:00:00.000Z" });
      unlinkSync(join(root, "HANDOFF-README.txt"));
      await expect(verifyManifestHashes(root)).rejects.toThrow(/missing on disk: HANDOFF-README\.txt/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails verify when an extra unmanifested file is present", async () => {
    const root = makeTempDir();
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    try {
      writeMinimalGoodTree(root);
      await generateReleaseManifest(root, { repoRoot, buildTimestampUtc: "2026-05-21T00:00:00.000Z" });
      writeFileSync(join(root, "extra-unmanifested.txt"), "surprise\n", "utf8");
      await expect(verifyManifestHashes(root)).rejects.toThrow(/unmanifested staged file: extra-unmanifested\.txt/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("manifest JSON excludes forbidden tokens", async () => {
    const root = makeTempDir();
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    try {
      writeMinimalGoodTree(root);
      await generateReleaseManifest(root, { repoRoot, buildTimestampUtc: "2026-05-21T00:00:00.000Z" });
      const raw = readFileSync(join(root, "RELEASE-MANIFEST.json"), "utf8");
      expect(raw).not.toMatch(/\/Users\//);
      expect(raw).not.toMatch(/Microdent-Legacy/);
      expect(raw).not.toMatch(/PAT_NAME/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("node-runtime-staging", () => {
  it("validates a pre-downloaded Node 22 runtime and writes a support-safe manifest", () => {
    const root = makeTempDir();
    try {
      const runtimeDir = join(root, "runtime");
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(join(runtimeDir, "node.exe"), "placeholder", "utf8");

      const validation = validateNodeRuntimeDir({
        runtimeDir,
        platform: "win32",
        spawnSyncImpl: () => ({ status: 0, stdout: "v22.5.1\n" }),
      });
      const manifest = writeNodeRuntimeManifest(runtimeDir, validation);

      expect(validation).toEqual({
        version: "v22.5.1",
        minVersion: "22.5.0",
        executableRelPath: "node.exe",
        runtimeKind: "windows-x64",
      });
      expect(manifest.executableRelPath).toBe("node.exe");
      const raw = readFileSync(join(runtimeDir, "RUNTIME-MANIFEST.json"), "utf8");
      expect(raw).not.toContain(root);
      expect(raw).not.toContain("/Users/");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects runtimes below Node 22.5.0", () => {
    const root = makeTempDir();
    try {
      const runtimeDir = join(root, "runtime");
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(join(runtimeDir, "node.exe"), "placeholder", "utf8");

      expect(() =>
        validateNodeRuntimeDir({
          runtimeDir,
          platform: "win32",
          spawnSyncImpl: () => ({ status: 0, stdout: "v20.19.4\n" }),
        }),
      ).toThrow(/22\.5\.0 or newer/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates a cross-staged Windows runtime from its official Node folder name", () => {
    const root = makeTempDir();
    try {
      const runtimeDir = join(root, "node-v22.22.3-win-x64");
      mkdirSync(runtimeDir, { recursive: true });
      const nodeBinary = join(runtimeDir, "node.exe");
      writeFileSync(nodeBinary, "placeholder", "utf8");
      const expectedSha256 = createHash("sha256").update(readFileSync(nodeBinary)).digest("hex");

      const validation = validateNodeRuntimeDir({
        runtimeDir,
        platform: "win32",
        expectedSha256,
      });

      expect(validation.version).toBe("v22.22.3");
      expect(validation.executableRelPath).toBe("node.exe");
      expect(validation.runtimeKind).toBe("windows-x64");
      expect(validation.nodeBinarySha256).toBe(expectedSha256);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires a checksum for cross-staged Windows runtimes", () => {
    const root = makeTempDir();
    try {
      const runtimeDir = join(root, "node-v22.22.3-win-x64");
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(join(runtimeDir, "node.exe"), "placeholder", "utf8");

      expect(() =>
        validateNodeRuntimeDir({
          runtimeDir,
          platform: "win32",
        }),
      ).toThrow(/requires expected node\.exe SHA-256/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeFieldEvidenceReport(overrides = {}) {
  const steps = Object.fromEntries(
    EXEC_STEPS.map((step) => [
      step,
      {
        status: "pass",
        evidence: `${step} completed with PHI-safe evidence.`,
      },
    ]),
  );
  steps["EXEC-15"] = {
    status: "na",
    evidence: "Cold reboot skipped by IT for this day-0 run.",
  };
  steps["EXEC-12"] = {
    status: "pass",
    evidence: "Sandbox write workflows passed with operation IDs for appointment status update, appointment time move, appointment creation, and patient demographics update.",
  };
  steps["EXEC-13"] = {
    status: "pass",
    evidence: "Backup artifacts existed before writes and restore succeeded after sandbox validation.",
  };

  return {
    schemaVersion: FIELD_EVIDENCE_SCHEMA_VERSION,
    mode: "sandbox-signoff",
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      appVersion: "0.0.1",
      gitCommit: "a96131b",
      releaseChannel: "pilot",
    },
    machine: {
      label: "CLINIC-PC-01",
      windowsVersion: "Windows 11 23H2",
      nodeVersion: "v22.11.0",
    },
    packageVerification: {
      evidencePath: "qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json",
      verifiedBeforeFieldRun: true,
    },
    paths: {
      packageRoot: "C:\\Microdent\\MicrodentModern",
      dataRoot: "C:\\ClinicData\\PilotSandbox\\DATA",
      sqlitePath: "C:\\ClinicData\\PilotSandbox\\mirror\\clinic.sqlite",
      backupDir: "C:\\ClinicData\\PilotSandbox\\microdent-backups",
    },
    steps,
    goNoGo: {
      phiObserved: false,
      unsupportedWritesAttempted: false,
      outcome: "go-limited-sandbox",
    },
    attachments: {
      manifestPath: "qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json",
      redactionReviewed: true,
      rawAttachmentsCommitted: false,
    },
    ...overrides,
  };
}

function makeEvidenceAttachmentManifest(overrides = {}) {
  return {
    schemaVersion: ATTACHMENT_MANIFEST_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    evidenceId: "FIELD-2026-06-06-CLINIC-PC-01",
    clinicLabel: "CLINIC-PC-01",
    createdDate: "2026-06-06",
    storage: {
      system: "internal-secure-tracker",
      location: "SECURE-TICKET-123",
      rawFilesExcludedFromRepo: true,
      secureInternalTracker: true,
    },
    attachments: [
      {
        fileName: "2026-06-06-CLINIC-PC-01-settings-redacted.png",
        type: "redacted-screenshot",
        sha256: "a".repeat(64),
        sourceStep: "EXEC-09",
        description: "Redacted Settings clinic service status screenshot.",
        redaction: {
          reviewed: true,
          reviewerRole: "IT lead",
          date: "2026-06-06",
          phiObserved: false,
        },
      },
      {
        fileName: "2026-06-06-CLINIC-PC-01-validator-output.txt",
        type: "validator-output",
        sha256: "b".repeat(64),
        sourceStep: "EXEC-16",
        description: "Validator output copied without patient data or local paths.",
        redaction: {
          reviewed: true,
          reviewerRole: "Privacy reviewer",
          date: "2026-06-06",
          phiObserved: false,
        },
      },
    ],
    signoff: {
      reviewed: true,
      reviewerRole: "Privacy reviewer",
      date: "2026-06-06",
      phiObserved: false,
    },
    ...overrides,
  };
}

describe("evidence-attachment-manifest", () => {
  it("accepts reviewed PHI-safe attachment metadata", () => {
    const result = validateEvidenceAttachmentManifest(makeEvidenceAttachmentManifest());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects raw logs, local paths, and unreviewed redaction", () => {
    const result = validateEvidenceAttachmentManifest(makeEvidenceAttachmentManifest({
      storage: {
        system: "internal-secure-tracker",
        location: "C:\\Users\\Alex\\Desktop\\screenshots",
        rawFilesExcludedFromRepo: false,
        secureInternalTracker: false,
      },
      attachments: [
        {
          fileName: "bridge.log",
          type: "redacted-log-excerpt",
          sha256: "0".repeat(64),
          sourceStep: "EXEC-09",
          description: "Raw bridge log.",
          redaction: {
            reviewed: false,
            reviewerRole: "IT lead",
            date: "2026-06-06",
            phiObserved: true,
          },
        },
      ],
      signoff: {
        reviewed: false,
        reviewerRole: "Privacy reviewer",
        date: "2026-06-06",
        phiObserved: true,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/raw data\/log\/archive/);
    expect(result.errors.join("\n")).toMatch(/local user path/);
    expect(result.errors.join("\n")).toMatch(/rawFilesExcludedFromRepo/);
    expect(result.errors.join("\n")).toMatch(/phiObserved/);
  });

  it("rejects unfilled attachment manifest templates", () => {
    const result = validateEvidenceAttachmentManifest(makeEvidenceAttachmentManifest({
      evidenceId: "FIELD-YYYY-MM-DD-CLINIC-PC-01",
      createdDate: "YYYY-MM-DD",
      storage: {
        system: "internal-secure-tracker",
        location: "TBD",
        rawFilesExcludedFromRepo: true,
        secureInternalTracker: true,
      },
      attachments: [
        {
          ...makeEvidenceAttachmentManifest().attachments[0],
          fileName: "YYYY-MM-DD-CLINIC-PC-01-settings-redacted.png",
          sha256: "0".repeat(64),
          redaction: {
            reviewed: true,
            reviewerRole: "IT lead",
            date: "YYYY-MM-DD",
            phiObserved: false,
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/createdDate/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json"),
        `${JSON.stringify(makeEvidenceAttachmentManifest(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "evidence-attachment-manifest.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("ATTACHMENT MANIFEST: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("windows-field-evidence", () => {
  it("accepts a complete sandbox-signoff report as tier 3 ready", () => {
    const result = validateFieldEvidenceReport(makeFieldEvidenceReport());

    expect(result.ok).toBe(true);
    expect(result.tier3Ready).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.requiredSteps).not.toContain("EXEC-15");
  });

  it("allows read-only reports but keeps clinic go-live blocked", () => {
    const report = makeFieldEvidenceReport({
      mode: "read-only",
      steps: {
        ...makeFieldEvidenceReport().steps,
        "EXEC-12": {
          status: "na",
          evidence: "Sandbox write QA skipped for read-only field test.",
        },
        "EXEC-13": {
          status: "na",
          evidence: "Restore skipped because sandbox writes were not run.",
        },
      },
    });

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(true);
    expect(result.tier3Ready).toBe(false);
    expect(result.status).toBe("read-only-ready");
    expect(result.warnings.join("\n")).toMatch(/does not prove sandbox write/);
  });

  it("allows redacted path classes for read-only smoke reports only", () => {
    const report = makeFieldEvidenceReport({
      mode: "read-only",
      paths: {
        packageRoot: "portable-handoff-folder",
        dataRoot: "copied-local-test-folder",
        sqlitePath: "generated-local-mirror",
        backupDir: "generated-local-backups",
      },
      steps: {
        ...makeFieldEvidenceReport().steps,
        "EXEC-12": {
          status: "na",
          evidence: "Sandbox write QA skipped for read-only field test.",
        },
        "EXEC-13": {
          status: "na",
          evidence: "Restore skipped because sandbox writes were not run.",
        },
      },
    });

    const readOnlyResult = validateFieldEvidenceReport(report);
    const sandboxResult = validateFieldEvidenceReport({
      ...report,
      mode: "sandbox-signoff",
    });

    expect(readOnlyResult.ok).toBe(true);
    expect(readOnlyResult.status).toBe("read-only-ready");
    expect(sandboxResult.ok).toBe(false);
    expect(sandboxResult.errors.join("\n")).toMatch(/paths\.packageRoot has unexpected format/);
  });

  it("rejects sandbox-signoff reports that skip sandbox writes", () => {
    const report = makeFieldEvidenceReport();
    report.steps["EXEC-12"] = {
      status: "na",
      evidence: "Skipped sandbox writes.",
    };

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/EXEC-12 must pass/);
  });

  it("rejects vague sandbox-signoff write and restore evidence", () => {
    const report = makeFieldEvidenceReport();
    report.steps["EXEC-12"] = {
      status: "pass",
      evidence: "Sandbox writes passed.",
    };
    report.steps["EXEC-13"] = {
      status: "pass",
      evidence: "Restore succeeded.",
    };

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/EXEC-12\.evidence must mention appointment status update/);
    expect(result.errors.join("\n")).toMatch(/EXEC-12\.evidence must mention appointment time move/);
    expect(result.errors.join("\n")).toMatch(/EXEC-12\.evidence must mention appointment creation/);
    expect(result.errors.join("\n")).toMatch(/EXEC-12\.evidence must mention patient demographics update/);
    expect(result.errors.join("\n")).toMatch(/EXEC-12\.evidence must mention operation IDs/);
    expect(result.errors.join("\n")).toMatch(/EXEC-13\.evidence must mention backup/);
  });

  it("rejects PHI-sensitive report tokens", () => {
    const report = makeFieldEvidenceReport();
    const rawText = JSON.stringify({
      ...report,
      notes: "PAT_NAME was visible in copied output",
    });

    const result = validateFieldEvidenceReport(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/PAT_NAME/);
  });

  it("rejects unfilled template placeholders", () => {
    const report = makeFieldEvidenceReport({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        appVersion: "0.0.1",
        gitCommit: "abcdef1",
        releaseChannel: "pilot",
      },
    });

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/packageVersion/);
  });

  it("rejects field evidence without a reviewed attachment manifest reference", () => {
    const report = makeFieldEvidenceReport({
      attachments: {
        manifestPath: "qa-runs/2026-06-06-field-notes.json",
        redactionReviewed: false,
        rawAttachmentsCommitted: true,
      },
    });

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/attachments\.manifestPath/);
    expect(result.errors.join("\n")).toMatch(/attachments\.redactionReviewed/);
    expect(result.errors.join("\n")).toMatch(/attachments\.rawAttachmentsCommitted/);
  });

  it("rejects field evidence without package verification evidence", () => {
    const report = makeFieldEvidenceReport({
      packageVerification: {
        evidencePath: "qa-runs/2026-06-06-package-notes.json",
        verifiedBeforeFieldRun: false,
      },
    });

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/packageVerification\.evidencePath/);
    expect(result.errors.join("\n")).toMatch(/packageVerification\.verifiedBeforeFieldRun/);
  });

  it("rejects strict field evidence when the attachment manifest file is missing", () => {
    const root = makeTempDir();
    try {
      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/attachments\.manifestPath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects strict field evidence when package verification evidence is missing", () => {
    const root = makeTempDir();
    try {
      const manifestPath = join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, `${JSON.stringify(makeEvidenceAttachmentManifest(), null, 2)}\n`, "utf8");

      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/packageVerification\.evidencePath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects strict field evidence when package verification evidence is blocked", () => {
    const root = makeTempDir();
    try {
      const packagePath = join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      const manifestPath = join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      mkdirSync(dirname(packagePath), { recursive: true });
      writeFileSync(packagePath, `${JSON.stringify(makePackageVerifyEvidence({
        checks: {
          ...makePackageVerifyEvidence().checks,
          forbiddenArtifactsAbsent: "blocked",
        },
      }), null, 2)}\n`, "utf8");
      writeFileSync(manifestPath, `${JSON.stringify(makeEvidenceAttachmentManifest(), null, 2)}\n`, "utf8");

      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/packageVerification\.evidencePath is not ready/);
      expect(result.errors.join("\n")).toMatch(/checks\.forbiddenArtifactsAbsent/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects strict field evidence when the attachment manifest is blocked", () => {
    const root = makeTempDir();
    try {
      const packagePath = join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      const manifestPath = join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      mkdirSync(dirname(packagePath), { recursive: true });
      writeFileSync(packagePath, `${JSON.stringify(makePackageVerifyEvidence(), null, 2)}\n`, "utf8");
      writeFileSync(
        manifestPath,
        `${JSON.stringify(makeEvidenceAttachmentManifest({
          attachments: [
            {
              ...makeEvidenceAttachmentManifest().attachments[0],
              fileName: "bridge.log",
            },
          ],
        }), null, 2)}\n`,
        "utf8",
      );

      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/attachments\.manifestPath is not ready/);
      expect(result.errors.join("\n")).toMatch(/raw data\/log\/archive/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts strict field evidence when the attachment manifest is ready", () => {
    const root = makeTempDir();
    try {
      const packagePath = join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      const manifestPath = join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      mkdirSync(dirname(packagePath), { recursive: true });
      writeFileSync(packagePath, `${JSON.stringify(makePackageVerifyEvidence(), null, 2)}\n`, "utf8");
      writeFileSync(manifestPath, `${JSON.stringify(makeEvidenceAttachmentManifest(), null, 2)}\n`, "utf8");

      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(true);
      expect(result.tier3Ready).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      writeCommercialEvidenceBundle(root);
      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "windows-field-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("FIELD EVIDENCE: READY");
      expect(result.stdout).toContain("mode=sandbox-signoff");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects strict field evidence when attachment manifest identity does not match the machine", () => {
    const root = makeTempDir();
    try {
      const packagePath = join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      const manifestPath = join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      mkdirSync(dirname(packagePath), { recursive: true });
      writeFileSync(packagePath, `${JSON.stringify(makePackageVerifyEvidence(), null, 2)}\n`, "utf8");
      writeFileSync(
        manifestPath,
        `${JSON.stringify(makeEvidenceAttachmentManifest({
          evidenceId: "FIELD-2026-06-06-OTHER-PC",
          clinicLabel: "OTHER-PC",
        }), null, 2)}\n`,
        "utf8",
      );

      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/clinicLabel must match machine\.label/);
      expect(result.errors.join("\n")).toMatch(/evidenceId must include machine\.label/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects strict field evidence when package verification identity does not match", () => {
    const root = makeTempDir();
    try {
      const packagePath = join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      const manifestPath = join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      mkdirSync(dirname(packagePath), { recursive: true });
      writeFileSync(
        packagePath,
        `${JSON.stringify(makePackageVerifyEvidence({
          machine: {
            ...makePackageVerifyEvidence().machine,
            label: "OTHER-PC",
          },
          build: {
            ...makePackageVerifyEvidence().build,
            gitCommit: "bbbbbbb",
          },
        }), null, 2)}\n`,
        "utf8",
      );
      writeFileSync(manifestPath, `${JSON.stringify(makeEvidenceAttachmentManifest(), null, 2)}\n`, "utf8");

      const result = validateFieldEvidenceReport(makeFieldEvidenceReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/machine\.label must match/);
      expect(result.errors.join("\n")).toMatch(/build\.gitCommit must match/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects live legacy and install-tree data paths", () => {
    const report = makeFieldEvidenceReport({
      paths: {
        packageRoot: "C:\\Microdent\\MicrodentModern",
        dataRoot: "C:\\Microdent-Legacy\\DATA",
        sqlitePath: "C:\\Microdent\\MicrodentModern\\app\\clinic.sqlite",
        backupDir: "C:\\Microdent\\MicrodentModern\\bridge\\backups",
      },
    });

    const result = validateFieldEvidenceReport(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/live legacy path/);
    expect(result.errors.join("\n")).toMatch(/sqlitePath must be outside/);
    expect(result.errors.join("\n")).toMatch(/backupDir must be outside/);
  });
});

describe("safe-results intake", () => {
  function writeSafeResultsFiles(dir) {
    writeFileSync(join(dir, "WINDOWS-SMOKE-REPORT.txt"), "Microdent Modern Windows smoke report\nPHI reminder only\n", "utf8");
    writeFileSync(
      join(dir, "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json"),
      `${JSON.stringify(makeEvidenceAttachmentManifest(), null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(dir, "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json"),
      `${JSON.stringify(makePackageVerifyEvidence(), null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(dir, "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"),
      `${JSON.stringify(makeFieldEvidenceReport({
        mode: "read-only",
        paths: {
          packageRoot: "portable-handoff-folder",
          dataRoot: "copied-local-test-folder",
          sqlitePath: "generated-local-mirror",
          backupDir: "generated-local-backups",
        },
        steps: {
          ...makeFieldEvidenceReport().steps,
          "EXEC-12": {
            status: "na",
            evidence: "Sandbox write QA skipped for read-only field test.",
          },
          "EXEC-13": {
            status: "na",
            evidence: "Restore skipped because sandbox writes were not run.",
          },
        },
        goNoGo: {
          phiObserved: false,
          unsupportedWritesAttempted: false,
          outcome: "go-read-only-smoke",
        },
      }), null, 2)}\n`,
      "utf8",
    );
  }

  it("imports returned safe-results zip and validates read-only evidence", () => {
    const root = makeTempDir();
    const source = makeTempDir();
    try {
      writeSafeResultsFiles(source);
      const zipPath = join(root, "MicrodentModern-safe-results.zip");
      zipDirectoryContents(source, zipPath);

      const result = intakeSafeResultsZip(zipPath, { repoRoot: root });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("read-only-ready");
      expect(result.copied.attachment).toBe("qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json");
      expect(result.copied.package).toBe("qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      expect(result.copied.field).toBe("qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json");
      expect(existsSync(join(root, "qa-runs", "WINDOWS-SMOKE-REPORT.txt"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("rejects safe-results zip with unexpected raw artifacts", () => {
    const root = makeTempDir();
    const source = makeTempDir();
    try {
      writeSafeResultsFiles(source);
      writeFileSync(join(source, "bridge.log"), "raw log should not be returned\n", "utf8");
      const zipPath = join(root, "MicrodentModern-safe-results.zip");
      zipDirectoryContents(source, zipPath);

      expect(() => intakeSafeResultsZip(zipPath, { repoRoot: root })).toThrow(/forbidden file type/);
      expect(existsSync(join(root, "qa-runs", "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("rejects safe-results zip with nested evidence files", () => {
    const root = makeTempDir();
    const source = makeTempDir();
    try {
      writeSafeResultsFiles(source);
      mkdirSync(join(source, "nested"), { recursive: true });
      writeFileSync(
        join(source, "nested", "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"),
        readFileSync(join(source, "2026-06-06-windows-field-evidence-CLINIC-PC-01.json")),
      );
      unlinkSync(join(source, "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"));
      const zipPath = join(root, "MicrodentModern-safe-results.zip");
      zipDirectoryContents(source, zipPath);

      expect(() => intakeSafeResultsZip(zipPath, { repoRoot: root })).toThrow(/unexpected nested file/);
      expect(existsSync(join(root, "qa-runs", "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("does not copy safe-results evidence when validator checks fail", () => {
    const root = makeTempDir();
    const source = makeTempDir();
    try {
      writeSafeResultsFiles(source);
      writeFileSync(
        join(source, "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"),
        `${JSON.stringify(makeFieldEvidenceReport({
          mode: "read-only",
          paths: {
            packageRoot: "portable-handoff-folder",
            dataRoot: "copied-local-test-folder",
            sqlitePath: "generated-local-mirror",
            backupDir: "generated-local-backups",
          },
          attachments: {
            manifestPath: "qa-runs/2026-06-06-evidence-attachment-manifest-OTHER-PC.json",
            redactionReviewed: true,
            rawAttachmentsCommitted: false,
          },
        }), null, 2)}\n`,
        "utf8",
      );
      const zipPath = join(root, "MicrodentModern-safe-results.zip");
      zipDirectoryContents(source, zipPath);

      const result = intakeSafeResultsZip(zipPath, { repoRoot: root });

      expect(result.ok).toBe(false);
      expect(result.status).toBe("blocked");
      expect(result.copied).toEqual({});
      expect(result.validators.field.errors.join("\n")).toMatch(/attachments\.manifestPath/);
      expect(existsSync(join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json"))).toBe(false);
      expect(existsSync(join(root, "qa-runs", "2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json"))).toBe(false);
      expect(existsSync(join(root, "qa-runs", "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"))).toBe(false);

      const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
      const fieldDoc = readFileSync(join(repoRoot, "docs", "windows-field-evidence-report.md"), "utf8");
      const scriptsReadme = readFileSync(join(repoRoot, "scripts", "README.md"), "utf8");
      expect(fieldDoc).toContain("copies them into `qa-runs/` only when");
      expect(fieldDoc).toContain("SAFE RESULTS INTAKE: BLOCKED");
      expect(scriptsReadme).toContain("blocked intake leaves `qa-runs/` unchanged");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("prints not-copied from the CLI when safe-results validation fails", () => {
    const root = makeTempDir();
    const source = makeTempDir();
    try {
      writeSafeResultsFiles(source);
      writeFileSync(
        join(source, "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"),
        `${JSON.stringify(makeFieldEvidenceReport({
          mode: "read-only",
          paths: {
            packageRoot: "portable-handoff-folder",
            dataRoot: "copied-local-test-folder",
            sqlitePath: "generated-local-mirror",
            backupDir: "generated-local-backups",
          },
          attachments: {
            manifestPath: "qa-runs/2026-06-06-evidence-attachment-manifest-OTHER-PC.json",
            redactionReviewed: true,
            rawAttachmentsCommitted: false,
          },
        }), null, 2)}\n`,
        "utf8",
      );
      const zipPath = join(root, "MicrodentModern-safe-results.zip");
      zipDirectoryContents(source, zipPath);

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "intake-safe-results.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        zipPath,
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("SAFE RESULTS INTAKE: BLOCKED");
      expect(result.stdout).toContain("copied_attachment=not-copied");
      expect(result.stdout).toContain("copied_package=not-copied");
      expect(result.stdout).toContain("copied_field=not-copied");
      expect(result.stderr).toContain("attachments.manifestPath");
      expect(existsSync(join(root, "qa-runs", "2026-06-06-windows-field-evidence-CLINIC-PC-01.json"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("keeps safe-results intake pinned to qa-runs evidence paths", () => {
    const root = makeTempDir();
    const source = makeTempDir();
    try {
      writeSafeResultsFiles(source);
      const zipPath = join(root, "MicrodentModern-safe-results.zip");
      zipDirectoryContents(source, zipPath);

      expect(() => intakeSafeResultsZip(zipPath, { repoRoot: root, outDir: "tmp-evidence" })).toThrow(/outDir must be qa-runs/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });
});

function makeSignedOfflineLicense(overrides = {}) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const license = {
      schemaVersion: OFFLINE_LICENSE_SCHEMA_VERSION,
      product: "microdent-modern",
      licenseId: "LIC-20260606-CLINIC-PC-01",
      clinicLabel: "CLINIC-PC-01",
      tier: "clinic-enterprise",
      seats: 5,
      features: {
        readOnly: true,
        sandboxWrites: true,
        localCopyRefresh: true,
        supportExport: true,
      },
      issuedAt: "2026-06-06T00:00:00.000Z",
      expiresAt: "2027-06-06T00:00:00.000Z",
      graceDays: 30,
      expiryBehavior: "graceful-read-only",
      noPhiStatement: "no-real-patient-data",
      signature: "",
      ...overrides,
    };
    license.signature = sign(
      null,
      Buffer.from(canonicalizeLicensePayload(license), "utf8"),
      privateKey,
    ).toString("base64");

    if (!/\bYYYY\b|<[^>]+>|TBD|TODO|abcdef1/i.test(JSON.stringify(license))) {
      return {
        license,
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
      };
    }
  }
  throw new Error("failed to generate placeholder-free offline license fixture");
}

describe("offline-license-validate", () => {
  it("accepts a signed PHI-safe offline license", () => {
    const { license, publicKeyPem } = makeSignedOfflineLicense();

    const result = validateOfflineLicense(license, {
      publicKeyPem,
      now: new Date("2026-06-07T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      const { license, publicKeyPem } = makeSignedOfflineLicense();
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      mkdirSync(join(root, "keys"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-offline-license-CLINIC-PC-01.json"),
        `${JSON.stringify(license, null, 2)}\n`,
        "utf8",
      );
      writeFileSync(join(root, "keys", "microdent-license-public.pem"), publicKeyPem, "utf8");

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "offline-license-validate.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json",
        "--public-key",
        "keys/microdent-license-public.pem",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("OFFLINE LICENSE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints blocked from the CLI when the referenced public key is not present yet", () => {
    const root = makeTempDir();
    try {
      const { license } = makeSignedOfflineLicense();
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-offline-license-CLINIC-PC-01.json"),
        `${JSON.stringify(license, null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "offline-license-validate.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json",
        "--public-key",
        "keys/microdent-license-public.pem",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("OFFLINE LICENSE: BLOCKED");
      expect(result.stderr).toContain("[offline-license-validate] FAIL: public key is required via --public-key or MICRODENT_LICENSE_PUBLIC_KEY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects tampered signed payloads", () => {
    const { license, publicKeyPem } = makeSignedOfflineLicense();
    license.seats = 6;

    const result = validateOfflineLicense(license, {
      publicKeyPem,
      now: new Date("2026-06-07T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/signature verification failed/);
  });

  it("rejects expired licenses with graceful read-only guidance", () => {
    const { license, publicKeyPem } = makeSignedOfflineLicense({
      expiresAt: "2026-06-05T00:00:00.000Z",
    });

    const result = validateOfflineLicense(license, {
      publicKeyPem,
      now: new Date("2026-06-07T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/graceful read-only/);
  });

  it("rejects PHI-sensitive license tokens", () => {
    const { license, publicKeyPem } = makeSignedOfflineLicense();
    const rawText = JSON.stringify({
      ...license,
      notes: "phoneNumber was copied into the license",
    });

    const result = validateOfflineLicense(JSON.parse(rawText), {
      publicKeyPem,
      rawText,
      now: new Date("2026-06-07T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("rejects unfilled license templates", () => {
    const result = validateOfflineLicense({
      schemaVersion: OFFLINE_LICENSE_SCHEMA_VERSION,
      product: "microdent-modern",
      licenseId: "LIC-YYYY-MM-DD-CLINIC-PC-01",
      clinicLabel: "CLINIC-PC-01",
      tier: "clinic-enterprise",
      seats: 5,
      features: {
        readOnly: true,
        sandboxWrites: true,
        localCopyRefresh: true,
        supportExport: true,
      },
      issuedAt: "YYYY-MM-DDT00:00:00.000Z",
      expiresAt: "YYYY-MM-DDT00:00:00.000Z",
      graceDays: 30,
      expiryBehavior: "graceful-read-only",
      noPhiStatement: "no-real-patient-data",
      signature: "BASE64-SIGNATURE-FROM-CANONICAL-PAYLOAD",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/issuedAt/);
  });
});

function makeSignedArtifactEvidence(overrides = {}) {
  return {
    schemaVersion: SIGNED_ARTIFACT_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    certificate: {
      subject: "CN=Microdent Modern LLC",
      issuer: "CN=Example Code Signing CA",
      sha256Thumbprint: "a".repeat(64),
      validFrom: "2026-06-01",
      validTo: "2027-06-01",
      chainStatus: "pass",
    },
    artifacts: [
      {
        kind: "app-executable",
        relPath: "app/Microdent Modern.exe",
        sha256: "b".repeat(64),
        signatureStatus: "pass",
        publisherVerified: true,
        timestampVerified: true,
        verificationTool: "signtool verify /pa /tw",
        verificationSummary: "App executable signature chain and timestamp verified.",
      },
      {
        kind: "installer",
        relPath: "installer/MicrodentModernSetup.exe",
        sha256: "c".repeat(64),
        signatureStatus: "pass",
        publisherVerified: true,
        timestampVerified: true,
        verificationTool: "signtool verify /pa /tw",
        verificationSummary: "Installer signature chain and timestamp verified.",
      },
    ],
    timestamping: {
      rfc3161: true,
      authority: "Example RFC3161 Timestamp Authority",
    },
    smartScreen: {
      submittedOrReputationReviewed: true,
      notes: "SmartScreen review recorded without raw local paths.",
    },
    rawLogsAttached: false,
    ...overrides,
  };
}

describe("signed-artifact-evidence", () => {
  it("accepts complete signed app and installer evidence", () => {
    const result = validateSignedArtifactEvidence(makeSignedArtifactEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and blocked signatures", () => {
    const result = validateSignedArtifactEvidence(makeSignedArtifactEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      certificate: {
        subject: "CN=TBD",
        issuer: "CN=TBD",
        sha256Thumbprint: "0".repeat(64),
        validFrom: "YYYY-MM-DD",
        validTo: "YYYY-MM-DD",
        chainStatus: "blocked",
      },
      artifacts: [
        {
          ...makeSignedArtifactEvidence().artifacts[0],
          signatureStatus: "blocked",
          publisherVerified: false,
          verificationSummary: "TBD",
        },
      ],
      timestamping: {
        rfc3161: false,
        authority: "TBD",
      },
      smartScreen: {
        submittedOrReputationReviewed: false,
        notes: "TBD",
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/app-executable/);
    expect(result.errors.join("\n")).toMatch(/installer/);
    expect(result.errors.join("\n")).toMatch(/timestamping\.rfc3161/);
  });

  it("rejects PHI-sensitive signing evidence tokens", () => {
    const report = makeSignedArtifactEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "PAT_NAME appeared in pasted signing notes",
    });

    const result = validateSignedArtifactEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/PAT_NAME/);
  });

  it("rejects local machine artifact paths", () => {
    const report = makeSignedArtifactEvidence();
    report.artifacts[0].relPath = "C:\\Users\\Builder\\Microdent Modern.exe";

    const result = validateSignedArtifactEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/relative support-safe path/);
    expect(result.errors.join("\n")).toMatch(/local user path/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-signed-artifact-evidence.json"),
        `${JSON.stringify(makeSignedArtifactEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "signed-artifact-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-signed-artifact-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SIGNED ARTIFACTS: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeInstallerEvidence(overrides = {}) {
  const scenario = (name) => ({
    name,
    status: "pass",
    machineLabel: "WIN11-CLINIC-PC-01",
    windowsVersion: "Windows 11 23H2",
    evidence: `${name} completed with support-safe screenshots and no PHI.`,
  });

  return {
    schemaVersion: INSTALLER_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    installer: {
      target: "nsis",
      relPath: "installer/MicrodentModernSetup.exe",
      sha256: "d".repeat(64),
      signedArtifactEvidencePath: "qa-runs/2026-06-06-signed-artifact-evidence.json",
    },
    scenarios: [
      scenario("clean-install"),
      scenario("upgrade-install"),
      scenario("uninstall"),
    ],
    behavior: {
      cleanInstall: true,
      upgradeInstall: true,
      uninstallPreservesData: true,
      shortcutCreated: true,
      addRemoveProgramsEntry: true,
      appLaunchesAfterInstall: true,
      firstRunSetupLaunches: true,
      dataOutsideInstallTree: true,
      noPhiBundled: true,
      rollbackInstallerAvailable: true,
    },
    rawLogsAttached: false,
    ...overrides,
  };
}

describe("installer-evidence", () => {
  it("accepts complete installer behavior evidence", () => {
    const result = validateInstallerEvidence(makeInstallerEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and blocked install behavior", () => {
    const result = validateInstallerEvidence(makeInstallerEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      scenarios: [
        {
          name: "clean-install",
          status: "blocked",
          machineLabel: "WIN11-CLINIC-PC-01",
          windowsVersion: "Windows 11 23H2",
          evidence: "TBD",
        },
      ],
      behavior: {
        cleanInstall: false,
        upgradeInstall: false,
        uninstallPreservesData: false,
        shortcutCreated: false,
        addRemoveProgramsEntry: false,
        appLaunchesAfterInstall: false,
        firstRunSetupLaunches: false,
        dataOutsideInstallTree: false,
        noPhiBundled: false,
        rollbackInstallerAvailable: false,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/upgrade-install/);
    expect(result.errors.join("\n")).toMatch(/uninstall/);
    expect(result.errors.join("\n")).toMatch(/behavior\.cleanInstall/);
  });

  it("rejects PHI-sensitive installer evidence tokens", () => {
    const report = makeInstallerEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "TELEPHONE=5551234 appeared in pasted installer notes",
    });

    const result = validateInstallerEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/TELEPHONE/);
  });

  it("rejects absolute installer artifact paths", () => {
    const report = makeInstallerEvidence({
      installer: {
        ...makeInstallerEvidence().installer,
        relPath: "C:\\Users\\Builder\\MicrodentModernSetup.exe",
      },
    });

    const result = validateInstallerEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/relative support-safe path/);
    expect(result.errors.join("\n")).toMatch(/local user path/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-installer-evidence.json"),
        `${JSON.stringify(makeInstallerEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "installer-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-installer-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("INSTALLER EVIDENCE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeAutoUpdateEvidence(overrides = {}) {
  const scenario = (name) => ({
    name,
    status: "pass",
    machineLabel: "WIN11-CLINIC-PC-01",
    windowsVersion: "Windows 11 23H2",
    evidence: `${name} completed with support-safe screenshots and no PHI.`,
  });

  return {
    schemaVersion: AUTO_UPDATE_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      fromPackageVersion: "pilot-2026-06-05",
      toPackageVersion: "pilot-2026-06-06",
      fromGitCommit: "0f400e4",
      toGitCommit: "a96131b",
    },
    channel: {
      name: "internal-signed-feed",
      feedUrlLabel: "internal-release-feed",
      accessControlled: true,
    },
    payload: {
      relPath: "updates/MicrodentModernUpdate.exe",
      sha256: "e".repeat(64),
      signed: true,
      signedArtifactEvidencePath: "qa-runs/2026-06-06-signed-artifact-evidence.json",
    },
    scenarios: [
      scenario("update-install"),
      scenario("rollback"),
    ],
    behavior: {
      updatePreservesData: true,
      rollbackProven: true,
      restartBehaviorDocumented: true,
      offlineRecoveryDocumented: true,
    },
    privacy: {
      reviewed: true,
      noPhiUploaded: true,
      noLocalPathsUploaded: true,
      operatorNoticeReady: true,
    },
    rawLogsAttached: false,
    ...overrides,
  };
}

describe("auto-update-evidence", () => {
  it("accepts complete signed update and rollback evidence", () => {
    const result = validateAutoUpdateEvidence(makeAutoUpdateEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and blocked update behavior", () => {
    const result = validateAutoUpdateEvidence(makeAutoUpdateEvidence({
      build: {
        fromPackageVersion: "pilot-YYYY-MM-DD",
        toPackageVersion: "pilot-YYYY-MM-DD",
        fromGitCommit: "abcdef1",
        toGitCommit: "abcdef1",
      },
      channel: {
        name: "internal-signed-feed",
        feedUrlLabel: "TBD",
        accessControlled: false,
      },
      payload: {
        relPath: "updates/MicrodentModernUpdate.exe",
        sha256: "0".repeat(64),
        signed: false,
        signedArtifactEvidencePath: "qa-runs/YYYY-MM-DD-signed-artifact-evidence.json",
      },
      scenarios: [
        {
          name: "update-install",
          status: "blocked",
          machineLabel: "WIN11-CLINIC-PC-01",
          windowsVersion: "Windows 11 23H2",
          evidence: "TBD",
        },
      ],
      behavior: {
        updatePreservesData: false,
        rollbackProven: false,
        restartBehaviorDocumented: false,
        offlineRecoveryDocumented: false,
      },
      privacy: {
        reviewed: false,
        noPhiUploaded: false,
        noLocalPathsUploaded: false,
        operatorNoticeReady: false,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/rollback/);
    expect(result.errors.join("\n")).toMatch(/payload\.signed/);
    expect(result.errors.join("\n")).toMatch(/privacy\.reviewed/);
  });

  it("rejects PHI-sensitive update evidence tokens", () => {
    const report = makeAutoUpdateEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "patientName appeared in pasted update notes",
    });

    const result = validateAutoUpdateEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("rejects absolute update payload paths", () => {
    const report = makeAutoUpdateEvidence({
      payload: {
        ...makeAutoUpdateEvidence().payload,
        relPath: "C:\\Users\\Builder\\MicrodentModernUpdate.exe",
      },
    });

    const result = validateAutoUpdateEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/relative support-safe path/);
    expect(result.errors.join("\n")).toMatch(/local user path/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-auto-update-evidence.json"),
        `${JSON.stringify(makeAutoUpdateEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "auto-update-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-auto-update-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("AUTO UPDATE EVIDENCE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeClinicPilotReport(overrides = {}) {
  return {
    schemaVersion: CLINIC_PILOT_REPORT_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    clinicLabel: "CLINIC-PC-01",
    machineLabel: "WIN11-CLINIC-PC-01",
    windowsVersion: "Windows 11 23H2",
    packageVerificationEvidencePath: "qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json",
    fieldEvidencePath: "qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json",
    triageRollupPath: "qa-runs/2026-06-06-pilot-feedback-triage.md",
    outcome: "pass",
    issuesTriaged: true,
    operatorAcceptedWorkflow: true,
    supportPathExercised: true,
    safety: {
      phiObserved: false,
      liveLegacyTouched: false,
      unsupportedWritesAttempted: false,
      restoreFailed: false,
      openP0Issues: false,
      openP1Issues: false,
    },
    issueSummary: {
      p0: 0,
      p1: 0,
      p2: 1,
      p3: 2,
      closed: 3,
    },
    sponsorSignoff: {
      role: "Pilot sponsor",
      date: "2026-06-06",
    },
    ...overrides,
  };
}

describe("clinic-pilot-report-evidence", () => {
  it("accepts a complete PHI-safe clinic pilot report", () => {
    const result = validateClinicPilotReportEvidence(makeClinicPilotReport());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and unresolved pilot outcome", () => {
    const result = validateClinicPilotReportEvidence(makeClinicPilotReport({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      packageVerificationEvidencePath: "qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json",
      fieldEvidencePath: "qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json",
      triageRollupPath: "qa-runs/YYYY-MM-DD-pilot-feedback-triage.md",
      outcome: "blocked",
      issuesTriaged: false,
      operatorAcceptedWorkflow: false,
      supportPathExercised: false,
      sponsorSignoff: {
        role: "Pilot sponsor",
        date: "YYYY-MM-DD",
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/outcome/);
    expect(result.errors.join("\n")).toMatch(/issuesTriaged/);
  });

  it("rejects safety stop flags and open P0/P1 issues", () => {
    const result = validateClinicPilotReportEvidence(makeClinicPilotReport({
      safety: {
        phiObserved: true,
        liveLegacyTouched: false,
        unsupportedWritesAttempted: false,
        restoreFailed: false,
        openP0Issues: true,
        openP1Issues: false,
      },
      issueSummary: {
        p0: 1,
        p1: 1,
        p2: 0,
        p3: 0,
        closed: 0,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/safety\.phiObserved/);
    expect(result.errors.join("\n")).toMatch(/openP0Issues/);
    expect(result.errors.join("\n")).toMatch(/issueSummary\.p0/);
  });

  it("rejects PHI-sensitive clinic pilot report tokens", () => {
    const report = makeClinicPilotReport();
    const rawText = JSON.stringify({
      ...report,
      notes: "chartNumber appeared in a pasted pilot note",
    });

    const result = validateClinicPilotReportEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-clinic-pilot-report-CLINIC-PC-01.json"),
        `${JSON.stringify(makeClinicPilotReport(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "clinic-pilot-report-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-clinic-pilot-report-CLINIC-PC-01.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("CLINIC PILOT REPORT: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeSupportReadinessEvidence(overrides = {}) {
  const rows = [
    "KB-01",
    "KB-02",
    "KB-03",
    "KB-04",
    "IW-01",
    "IW-02",
    "IW-03",
    "IW-04",
    "RR-01",
    "RR-02",
    "RR-03",
    "RR-04",
  ].map((id) => ({
    id,
    pass: true,
    evidence: `${id} reviewed with PHI-safe support evidence.`,
  }));

  return {
    schemaVersion: SUPPORT_READINESS_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    reviewDate: "2026-06-06",
    summary: {
      knowledgeBaseReady: true,
      issueWorkflowReady: true,
      rollbackRunbookReady: true,
      supportTeamTrained: true,
      safeEvidenceRulesReviewed: true,
    },
    rows,
    signoffs: [
      { role: "Support lead", name: "Alex Chen", date: "2026-06-06" },
      { role: "IT lead", name: "Sam Rivera", date: "2026-06-06" },
    ],
    ...overrides,
  };
}

describe("support-readiness-evidence", () => {
  it("accepts complete support readiness evidence", () => {
    const result = validateSupportReadinessEvidence(makeSupportReadinessEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and incomplete rows", () => {
    const result = validateSupportReadinessEvidence(makeSupportReadinessEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      reviewDate: "YYYY-MM-DD",
      summary: {
        knowledgeBaseReady: false,
        issueWorkflowReady: false,
        rollbackRunbookReady: false,
        supportTeamTrained: false,
        safeEvidenceRulesReviewed: false,
      },
      rows: [
        { id: "KB-01", pass: false, evidence: "TBD" },
      ],
      signoffs: [
        { role: "Support lead", name: "TBD", date: "YYYY-MM-DD" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/summary\.knowledgeBaseReady/);
    expect(result.errors.join("\n")).toMatch(/rows must include/);
    expect(result.errors.join("\n")).toMatch(/IT lead/);
  });

  it("rejects PHI-sensitive support evidence tokens", () => {
    const report = makeSupportReadinessEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "phoneNumber appeared in pasted support notes",
    });

    const result = validateSupportReadinessEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-support-readiness-evidence.json"),
        `${JSON.stringify(makeSupportReadinessEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "support-readiness-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-support-readiness-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("SUPPORT READINESS: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeDistributionEvidence(overrides = {}) {
  const rows = [
    "signedArtifact",
    "downloadIntegrity",
    "releaseNotesReady",
    "unsupportedFeaturesDisclosed",
    "marketingClaimsReviewed",
    "supportPathPublished",
    "privacySecurityReviewed",
  ].map((id) => ({
    id,
    pass: true,
    evidence: `${id} reviewed with PHI-safe commercial distribution evidence.`,
  }));

  return {
    schemaVersion: DISTRIBUTION_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    reviewDate: "2026-06-06",
    channel: "direct-signed-download",
    artifact: {
      relPath: "installer/MicrodentModernSetup.exe",
      sha256: "f".repeat(64),
      signedArtifactEvidencePath: "qa-runs/2026-06-06-signed-artifact-evidence.json",
    },
    summary: {
      downloadIntegrity: true,
      releaseNotesReady: true,
      marketingClaimsReviewed: true,
      supportPathPublished: true,
      privacySecurityReviewed: true,
    },
    rows,
    ...overrides,
  };
}

describe("distribution-evidence", () => {
  it("accepts complete distribution evidence", () => {
    const result = validateDistributionEvidence(makeDistributionEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and incomplete rows", () => {
    const result = validateDistributionEvidence(makeDistributionEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      reviewDate: "YYYY-MM-DD",
      artifact: {
        relPath: "installer/MicrodentModernSetup.exe",
        sha256: "0".repeat(64),
        signedArtifactEvidencePath: "qa-runs/YYYY-MM-DD-signed-artifact-evidence.json",
      },
      summary: {
        downloadIntegrity: false,
        releaseNotesReady: false,
        marketingClaimsReviewed: false,
        supportPathPublished: false,
        privacySecurityReviewed: false,
      },
      rows: [
        { id: "signedArtifact", pass: false, evidence: "TBD" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/summary\.downloadIntegrity/);
    expect(result.errors.join("\n")).toMatch(/rows must include/);
  });

  it("rejects PHI-sensitive distribution evidence tokens", () => {
    const report = makeDistributionEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "PAT_NAME appeared in pasted release notes",
    });

    const result = validateDistributionEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/PAT_NAME/);
  });

  it("rejects absolute distribution artifact paths", () => {
    const result = validateDistributionEvidence(makeDistributionEvidence({
      artifact: {
        ...makeDistributionEvidence().artifact,
        relPath: "C:\\Users\\Builder\\MicrodentModernSetup.exe",
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/relative support-safe path/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-distribution-evidence.json"),
        `${JSON.stringify(makeDistributionEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "distribution-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-distribution-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("DISTRIBUTION EVIDENCE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makePricingEvidence(overrides = {}) {
  const rows = [
    "licenseScope",
    "supportTerms",
    "telemetryIndependence",
    "phiIndependence",
    "renewalTerms",
    "sponsorApproval",
  ].map((id) => ({
    id,
    pass: true,
    evidence: `${id} reviewed with PHI-safe pricing evidence.`,
  }));

  return {
    schemaVersion: PRICING_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    reviewDate: "2026-06-06",
    model: "per-clinic",
    licenseModel: "per-clinic-perpetual",
    licenseEvidencePath: "qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json",
    summary: {
      scopeMatchesLicense: true,
      supportTermsDefined: true,
      noUsageTelemetryDependency: true,
      sponsorApproved: true,
      noPhiPricingInputs: true,
      renewalTermsDocumented: true,
    },
    supportTerms: {
      included: true,
      escalation: true,
      rollback: true,
    },
    approvers: [
      { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
      { role: "Finance owner", name: "Alex Chen", date: "2026-06-06" },
    ],
    rows,
    ...overrides,
  };
}

describe("pricing-evidence", () => {
  it("accepts complete pricing evidence", () => {
    const result = validatePricingEvidence(makePricingEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and incomplete rows", () => {
    const result = validatePricingEvidence(makePricingEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      reviewDate: "YYYY-MM-DD",
      licenseEvidencePath: "qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json",
      summary: {
        scopeMatchesLicense: false,
        supportTermsDefined: false,
        noUsageTelemetryDependency: false,
        sponsorApproved: false,
        noPhiPricingInputs: false,
        renewalTermsDocumented: false,
      },
      rows: [
        { id: "licenseScope", pass: false, evidence: "TBD" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/summary\.scopeMatchesLicense/);
    expect(result.errors.join("\n")).toMatch(/rows must include/);
  });

  it("rejects pricing that depends on telemetry or PHI-derived inputs", () => {
    const result = validatePricingEvidence(makePricingEvidence({
      summary: {
        ...makePricingEvidence().summary,
        noUsageTelemetryDependency: false,
        noPhiPricingInputs: false,
      },
      rows: [
        ...makePricingEvidence().rows.filter((row) => row.id !== "telemetryIndependence"),
        {
          id: "telemetryIndependence",
          pass: false,
          evidence: "Pricing tier comes from app usage events.",
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/summary\.noUsageTelemetryDependency/);
    expect(result.errors.join("\n")).toMatch(/summary\.noPhiPricingInputs/);
    expect(result.errors.join("\n")).toMatch(/rows\[\d+\]\.pass/);
  });

  it("rejects missing sponsor or finance approval", () => {
    const result = validatePricingEvidence(makePricingEvidence({
      approvers: [
        { role: "IT lead", name: "Alex Chen", date: "2026-06-06" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/approvers must include/);
  });

  it("rejects PHI-sensitive pricing evidence tokens", () => {
    const report = makePricingEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "patientName was pasted into pricing notes",
    });

    const result = validatePricingEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-pricing-evidence.json"),
        `${JSON.stringify(makePricingEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "pricing-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-pricing-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PRICING EVIDENCE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeMarketingEvidence(overrides = {}) {
  const rows = [
    "claimsMatchEvidence",
    "unsupportedFeaturesDisclosed",
    "privacyClaimsReviewed",
    "websiteOrPacketApproved",
    "noClinicReadyClaimBeforeGate",
    "safeScreenshotsOnly",
  ].map((id) => ({
    id,
    pass: true,
    evidence: `${id} reviewed with PHI-safe marketing evidence.`,
  }));

  return {
    schemaVersion: MARKETING_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    reviewDate: "2026-06-06",
    commercialGateReady: false,
    packet: {
      type: "sales-packet",
      evidencePath: "docs/marketing-readiness.md",
    },
    summary: {
      claimsMatchEvidence: true,
      unsupportedFeaturesDisclosed: true,
      privacyClaimsReviewed: true,
      websiteOrPacketReady: true,
      noClinicReadyClaimBeforeGate: true,
      safeScreenshotsOnly: true,
    },
    claims: [
      {
        text: "Portable Windows pilot package",
        evidencePath: "docs/windows-pilot-release-layout.md",
        approved: true,
        allowedBeforeCommercialReady: true,
      },
      {
        text: "Local-first desktop modernization",
        evidencePath: "docs/data-privacy-review.md",
        approved: true,
        allowedBeforeCommercialReady: true,
      },
      {
        text: "Sandbox write workflows under pilot controls",
        evidencePath: "docs/windows-pilot-runbook.md",
        approved: true,
        allowedBeforeCommercialReady: true,
      },
    ],
    rows,
    approvers: [
      { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
      { role: "Privacy reviewer", name: "Alex Chen", date: "2026-06-06" },
    ],
    ...overrides,
  };
}

describe("marketing-evidence", () => {
  it("accepts complete marketing evidence", () => {
    const result = validateMarketingEvidence(makeMarketingEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and incomplete rows", () => {
    const result = validateMarketingEvidence(makeMarketingEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      reviewDate: "YYYY-MM-DD",
      summary: {
        claimsMatchEvidence: false,
        unsupportedFeaturesDisclosed: false,
        privacyClaimsReviewed: false,
        websiteOrPacketReady: false,
        noClinicReadyClaimBeforeGate: false,
        safeScreenshotsOnly: false,
      },
      rows: [
        { id: "claimsMatchEvidence", pass: false, evidence: "TBD" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/summary\.claimsMatchEvidence/);
    expect(result.errors.join("\n")).toMatch(/rows must include/);
  });

  it("rejects premature clinic-ready claims before commercial readiness", () => {
    const result = validateMarketingEvidence(makeMarketingEvidence({
      claims: [
        ...makeMarketingEvidence().claims,
        {
          text: "Production-ready clinic-ready go-live ready",
          evidencePath: "qa-runs/2026-06-06-commercial-readiness-evidence.json",
          approved: true,
          allowedBeforeCommercialReady: false,
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/not allowed before commercial readiness/);
    expect(result.errors.join("\n")).toMatch(/premature commercial-readiness claim/);
  });

  it("rejects unapproved claims and missing privacy approval", () => {
    const result = validateMarketingEvidence(makeMarketingEvidence({
      claims: [
        {
          text: "Local-first desktop modernization",
          evidencePath: "docs/data-privacy-review.md",
          approved: false,
          allowedBeforeCommercialReady: true,
        },
        ...makeMarketingEvidence().claims.slice(1),
      ],
      approvers: [
        { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/claims\[0\]\.approved/);
    expect(result.errors.join("\n")).toMatch(/approvers must include/);
  });

  it("rejects PHI-sensitive marketing evidence tokens", () => {
    const report = makeMarketingEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "PAT_NAME appeared in a screenshot draft",
    });

    const result = validateMarketingEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/PAT_NAME/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-marketing-evidence.json"),
        `${JSON.stringify(makeMarketingEvidence(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "marketing-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-marketing-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("MARKETING EVIDENCE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeGoLiveEvidence(overrides = {}) {
  const rows = [
    "fieldEvidenceReady",
    "commercialReadinessReady",
    "pilotIssuesTriaged",
    "supportPathReady",
    "rollbackPathReady",
    "operatorApproval",
  ].map((id) => ({
    id,
    pass: true,
    evidence: `${id} reviewed with PHI-safe go-live evidence.`,
  }));

  return {
    schemaVersion: GO_LIVE_EVIDENCE_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    reviewDate: "2026-06-06",
    outcome: "go-limited-sandbox",
    evidencePaths: {
      packageVerificationEvidencePath: "qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json",
      fieldEvidencePath: "qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json",
      commercialReadinessPath: "qa-runs/2026-06-06-commercial-readiness-evidence.json",
      clinicPilotReportPath: "qa-runs/2026-06-06-clinic-pilot-report-CLINIC-PC-01.json",
      supportEvidencePath: "qa-runs/2026-06-06-support-readiness-evidence.json",
    },
    summary: {
      fieldEvidenceReady: true,
      commercialReadinessReady: true,
      pilotIssuesTriaged: true,
      noP0P1Issues: true,
      supportPathReady: true,
      rollbackPathReady: true,
      operatorApprovalRecorded: true,
      phiObserved: false,
    },
    rows,
    approvers: [
      { role: "IT lead", name: "Alex Chen", date: "2026-06-06" },
      { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
      { role: "Support lead", name: "Jordan Lee", date: "2026-06-06" },
    ],
    ...overrides,
  };
}

describe("go-live-evidence", () => {
  it("accepts complete go-live evidence", () => {
    const result = validateGoLiveEvidence(makeGoLiveEvidence());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and incomplete rows", () => {
    const result = validateGoLiveEvidence(makeGoLiveEvidence({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      reviewDate: "YYYY-MM-DD",
      evidencePaths: {
        packageVerificationEvidencePath: "qa-runs/YYYY-MM-DD-windows-package-verify-evidence-CLINIC-PC-01.json",
        fieldEvidencePath: "qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json",
        commercialReadinessPath: "qa-runs/YYYY-MM-DD-commercial-readiness-evidence.json",
        clinicPilotReportPath: "qa-runs/YYYY-MM-DD-clinic-pilot-report-CLINIC-PC-01.json",
        supportEvidencePath: "qa-runs/YYYY-MM-DD-support-readiness-evidence.json",
      },
      summary: {
        fieldEvidenceReady: false,
        commercialReadinessReady: false,
        pilotIssuesTriaged: false,
        noP0P1Issues: false,
        supportPathReady: false,
        rollbackPathReady: false,
        operatorApprovalRecorded: false,
        phiObserved: false,
      },
      rows: [
        { id: "fieldEvidenceReady", pass: false, evidence: "TBD" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/summary\.fieldEvidenceReady/);
    expect(result.errors.join("\n")).toMatch(/rows must include/);
  });

  it("rejects unresolved blockers or PHI observation", () => {
    const result = validateGoLiveEvidence(makeGoLiveEvidence({
      summary: {
        ...makeGoLiveEvidence().summary,
        noP0P1Issues: false,
        phiObserved: true,
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/summary\.noP0P1Issues/);
    expect(result.errors.join("\n")).toMatch(/summary\.phiObserved/);
  });

  it("rejects missing required approvers", () => {
    const result = validateGoLiveEvidence(makeGoLiveEvidence({
      approvers: [
        { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/approvers must include/);
  });

  it("rejects PHI-sensitive go-live evidence tokens", () => {
    const report = makeGoLiveEvidence();
    const rawText = JSON.stringify({
      ...report,
      notes: "phoneNumber was pasted into go-live notes",
    });

    const result = validateGoLiveEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("loads and validates referenced go-live evidence files before reporting ready", () => {
    const root = makeTempDir();
    try {
      writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );
      const result = loadAndValidateGoLiveEvidence(join(root, "qa-runs", "2026-06-06-go-live-evidence.json"), {
        repoRoot: root,
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("ready");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "go-live-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-go-live-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("GO-LIVE EVIDENCE: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks standalone go-live evidence when referenced files are missing", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-go-live-evidence.json"),
        `${JSON.stringify(makeGoLiveEvidence(), null, 2)}\n`,
        "utf8",
      );

      const result = loadAndValidateGoLiveEvidence(join(root, "qa-runs", "2026-06-06-go-live-evidence.json"), {
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/evidencePaths\.packageVerificationEvidencePath does not exist/);
      expect(result.errors.join("\n")).toMatch(/evidencePaths\.commercialReadinessPath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function makeCommercialReadinessReport(overrides = {}) {
  return {
    schemaVersion: COMMERCIAL_READINESS_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
    },
    macSignoff: {
      strictSignoff: "ready",
      manifestVerified: true,
    },
    fieldEvidence: {
      status: "ready",
      packageVerificationEvidencePath: "qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json",
      reportPath: "qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json",
    },
    windowsValidation: {
      windows10: "pass",
      windows11: "pass",
      antivirusEndpoint: "pass",
      compatibilityReportPath: "qa-runs/2026-06-06-windows-compatibility-evidence.json",
    },
    signing: {
      certificate: "pass",
      appExecutableVerified: "pass",
      installerVerified: "pass",
      signedArtifactEvidencePath: "qa-runs/2026-06-06-signed-artifact-evidence.json",
      verificationTool: "signtool verify",
    },
    installer: {
      status: "pass",
      target: "nsis",
      installerEvidencePath: "qa-runs/2026-06-06-installer-evidence.json",
      cleanInstall: true,
      upgradeInstall: true,
      uninstallPreservesData: true,
      shortcutCreated: true,
    },
    autoUpdate: {
      status: "pass",
      channel: "internal-signed-feed",
      autoUpdateEvidencePath: "qa-runs/2026-06-06-auto-update-evidence.json",
      signedPayload: true,
      updatePreservesData: true,
      rollbackProven: true,
      privacyReviewed: true,
    },
    pilotReports: [
      {
        clinicLabel: "CLINIC-PC-01",
        reportPath: "qa-runs/2026-06-06-clinic-pilot-report-CLINIC-PC-01.json",
        outcome: "pass",
        issuesTriaged: true,
        phiObserved: false,
      },
    ],
    supportReadiness: {
      knowledgeBaseReady: true,
      issueWorkflowReady: true,
      rollbackRunbookReady: true,
      supportEvidencePath: "qa-runs/2026-06-06-support-readiness-evidence.json",
    },
    licensing: {
      status: "pass",
      model: "per-clinic-perpetual",
      licenseEvidencePath: "qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json",
      offlineValidation: true,
      noPhiTransmission: true,
      gracefulExpiry: true,
      safetyReviewed: true,
    },
    distribution: {
      status: "pass",
      channel: "direct-signed-download",
      distributionEvidencePath: "qa-runs/2026-06-06-distribution-evidence.json",
      downloadIntegrity: true,
      releaseNotesReady: true,
      marketingClaimsReviewed: true,
      supportPathPublished: true,
    },
    pricing: {
      status: "pass",
      model: "per-clinic",
      pricingEvidencePath: "qa-runs/2026-06-06-pricing-evidence.json",
      scopeMatchesLicense: true,
      supportTermsDefined: true,
      noUsageTelemetryDependency: true,
      sponsorApproved: true,
    },
    marketing: {
      status: "pass",
      marketingEvidencePath: "qa-runs/2026-06-06-marketing-evidence.json",
      claimsMatchEvidence: true,
      unsupportedFeaturesDisclosed: true,
      privacyClaimsReviewed: true,
      websiteOrPacketReady: true,
      noClinicReadyClaimBeforeGate: true,
    },
    goLive: {
      outcome: "go",
      goLiveEvidencePath: "qa-runs/2026-06-06-go-live-evidence.json",
      approvers: [
        { role: "IT lead", name: "Alex Chen", date: "2026-06-06" },
        { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
      ],
    },
    ...overrides,
  };
}

function writeCommercialEvidenceBundle(root, overrides = {}) {
  const qaRuns = join(root, "qa-runs");
  mkdirSync(qaRuns, { recursive: true });

  const writeJson = (relPath, value) => {
    const abs = join(root, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const { license, publicKeyPem } = makeSignedOfflineLicense();
  const reports = {
    packageVerify: makePackageVerifyEvidence(),
    attachmentManifest: makeEvidenceAttachmentManifest(),
    field: makeFieldEvidenceReport(),
    compatibility: makeWindowsCompatibilityReport(),
    signing: makeSignedArtifactEvidence(),
    installer: makeInstallerEvidence(),
    autoUpdate: makeAutoUpdateEvidence(),
    clinicPilot: makeClinicPilotReport(),
    support: makeSupportReadinessEvidence(),
    license,
    distribution: makeDistributionEvidence(),
    pricing: makePricingEvidence(),
    marketing: makeMarketingEvidence(),
    goLive: makeGoLiveEvidence(),
    ...overrides,
  };

  writeJson("qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json", reports.packageVerify);
  writeJson("qa-runs/2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json", reports.attachmentManifest);
  writeJson("qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json", reports.field);
  writeJson("qa-runs/2026-06-06-windows-compatibility-evidence.json", reports.compatibility);
  writeJson("qa-runs/2026-06-06-signed-artifact-evidence.json", reports.signing);
  writeJson("qa-runs/2026-06-06-installer-evidence.json", reports.installer);
  writeJson("qa-runs/2026-06-06-auto-update-evidence.json", reports.autoUpdate);
  writeJson("qa-runs/2026-06-06-clinic-pilot-report-CLINIC-PC-01.json", reports.clinicPilot);
  writeJson("qa-runs/2026-06-06-support-readiness-evidence.json", reports.support);
  writeJson("qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json", reports.license);
  writeJson("qa-runs/2026-06-06-distribution-evidence.json", reports.distribution);
  writeJson("qa-runs/2026-06-06-pricing-evidence.json", reports.pricing);
  writeJson("qa-runs/2026-06-06-marketing-evidence.json", reports.marketing);
  writeJson("qa-runs/2026-06-06-go-live-evidence.json", reports.goLive);

  return { publicKeyPem, reports };
}

function writeMinimalRoadmapLocalEvidence(root) {
  const fileContents = new Map();
  const append = (relPath, text) => {
    const existing = fileContents.get(relPath) ?? "";
    fileContents.set(relPath, `${existing}${text}\n`);
  };

  for (const item of REQUIRED_LOCAL_EVIDENCE) {
    for (const relPath of item.files ?? []) {
      if (!fileContents.has(relPath)) {
        fileContents.set(relPath, "");
      }
    }
    for (const [relPath, expected] of item.text ?? []) {
      append(relPath, expected);
    }
  }

  for (const [relPath, content] of fileContents.entries()) {
    const abs = join(root, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
}

describe("commercial-readiness-audit", () => {
  it("accepts complete commercial readiness evidence", () => {
    const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects complete commercial readiness when referenced evidence files are missing", () => {
    const root = makeTempDir();
    try {
      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/fieldEvidence\.reportPath does not exist/);
      expect(result.errors.join("\n")).toMatch(/goLive\.goLiveEvidencePath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts complete commercial readiness when referenced evidence bundle is consistent", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );
      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
        publicKeyPem,
        currentCommercialReadinessPath: "qa-runs/2026-06-06-commercial-readiness-evidence.json",
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("ready");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      const commercialPath = "qa-runs/2026-06-06-commercial-readiness-evidence.json";
      writeFileSync(
        join(root, commercialPath),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );
      const publicKeyPath = join(root, "keys", "microdent-license-public.pem");
      mkdirSync(dirname(publicKeyPath), { recursive: true });
      writeFileSync(publicKeyPath, publicKeyPem, "utf8");

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "commercial-readiness-audit.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        commercialPath,
        "--repo-root",
        root,
        "--public-key",
        "keys/microdent-license-public.pem",
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toContain("[commercial-readiness-audit] WARN:");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("COMMERCIAL READINESS: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects commercial readiness when field evidence attachment manifest is missing", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      unlinkSync(join(root, "qa-runs", "2026-06-06-evidence-attachment-manifest-CLINIC-PC-01.json"));

      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
        publicKeyPem,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/fieldEvidence\.reportPath is not ready/);
      expect(result.errors.join("\n")).toMatch(/attachments\.manifestPath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects commercial readiness when field attachment manifest identity mismatches", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root, {
        attachmentManifest: makeEvidenceAttachmentManifest({
          evidenceId: "FIELD-2026-06-06-OTHER-PC",
          clinicLabel: "OTHER-PC",
        }),
      });

      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
        publicKeyPem,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/fieldEvidence\.reportPath is not ready/);
      expect(result.errors.join("\n")).toMatch(/clinicLabel must match machine\.label/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects commercial readiness when nested evidence references a different signing report", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root, {
        installer: makeInstallerEvidence({
          installer: {
            ...makeInstallerEvidence().installer,
            signedArtifactEvidencePath: "qa-runs/2026-06-06-other-signed-artifact-evidence.json",
          },
        }),
      });
      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
        publicKeyPem,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/installer evidence signedArtifactEvidencePath/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects commercial readiness when go-live evidence points at a different commercial readiness report", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root, {
        goLive: makeGoLiveEvidence({
          evidencePaths: {
            ...makeGoLiveEvidence().evidencePaths,
            commercialReadinessPath: "qa-runs/2026-06-06-other-commercial-readiness-evidence.json",
          },
        }),
      });
      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
        publicKeyPem,
        currentCommercialReadinessPath: "qa-runs/2026-06-06-commercial-readiness-evidence.json",
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/go-live evidence commercialReadinessPath/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects commercial readiness when referenced go-live evidence has missing nested files", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-go-live-evidence.json"),
        `${JSON.stringify(makeGoLiveEvidence(), null, 2)}\n`,
        "utf8",
      );

      const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport(), {
        verifyReferences: true,
        repoRoot: root,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toMatch(/goLive\.goLiveEvidencePath is not ready/);
      expect(result.errors.join("\n")).toMatch(/evidencePaths\.packageVerificationEvidencePath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects field evidence paths that are not Windows field evidence reports", () => {
    const result = validateCommercialReadinessEvidence(makeCommercialReadinessReport({
      fieldEvidence: {
        status: "ready",
        packageVerificationEvidencePath: "qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json",
        reportPath: "qa-runs/2026-06-06-generic-evidence.json",
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/fieldEvidence\.reportPath/);
  });

  it("rejects the current pilot template as blocked", () => {
    const report = makeCommercialReadinessReport({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
      },
      macSignoff: {
        strictSignoff: "blocked",
        manifestVerified: false,
      },
      fieldEvidence: {
        status: "blocked",
        reportPath: "qa-runs/YYYY-MM-DD-windows-field-evidence-CLINIC-PC-01.json",
      },
      windowsValidation: {
        windows10: "blocked",
        windows11: "blocked",
        antivirusEndpoint: "blocked",
        compatibilityReportPath: "qa-runs/YYYY-MM-DD-windows-compatibility-evidence.json",
      },
      signing: {
        certificate: "blocked",
        appExecutableVerified: "blocked",
        installerVerified: "blocked",
        verificationTool: "signtool verify",
      },
      licensing: {
        status: "blocked",
        model: "per-clinic-perpetual",
        licenseEvidencePath: "qa-runs/YYYY-MM-DD-offline-license-CLINIC-PC-01.json",
        offlineValidation: false,
        noPhiTransmission: false,
        gracefulExpiry: false,
        safetyReviewed: false,
      },
      distribution: {
        status: "blocked",
        channel: "TBD",
        downloadIntegrity: false,
        releaseNotesReady: false,
        marketingClaimsReviewed: false,
        supportPathPublished: false,
      },
      pricing: {
        status: "blocked",
        model: "per-clinic",
        pricingEvidencePath: "qa-runs/YYYY-MM-DD-pricing-evidence.json",
        scopeMatchesLicense: false,
        supportTermsDefined: false,
        noUsageTelemetryDependency: false,
        sponsorApproved: false,
      },
      marketing: {
        status: "blocked",
        marketingEvidencePath: "qa-runs/YYYY-MM-DD-marketing-evidence.json",
        claimsMatchEvidence: false,
        unsupportedFeaturesDisclosed: false,
        privacyClaimsReviewed: false,
        websiteOrPacketReady: false,
        noClinicReadyClaimBeforeGate: false,
      },
      goLive: {
        outcome: "blocked",
        goLiveEvidencePath: "qa-runs/YYYY-MM-DD-go-live-evidence.json",
        approvers: [
          { role: "IT lead", name: "TBD", date: "YYYY-MM-DD" },
          { role: "Pilot sponsor", name: "TBD", date: "YYYY-MM-DD" },
        ],
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/strictSignoff/);
    expect(result.errors.join("\n")).toMatch(/installerVerified/);
    expect(result.errors.join("\n")).toMatch(/licensing\.status/);
    expect(result.errors.join("\n")).toMatch(/distribution\.status/);
    expect(result.errors.join("\n")).toMatch(/pricing\.status/);
    expect(result.errors.join("\n")).toMatch(/marketing\.status/);
  });

  it("rejects missing Windows 10 or antivirus evidence", () => {
    const report = makeCommercialReadinessReport({
      windowsValidation: {
        windows10: "blocked",
        windows11: "pass",
        antivirusEndpoint: "blocked",
        compatibilityReportPath: "qa-runs/2026-06-06-windows-compatibility-evidence.json",
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/windowsValidation\.windows10/);
    expect(result.errors.join("\n")).toMatch(/windowsValidation\.antivirusEndpoint/);
  });

  it("rejects PHI-sensitive commercial evidence tokens", () => {
    const report = makeCommercialReadinessReport();
    const rawText = JSON.stringify({
      ...report,
      notes: "TELEPHONE=5551234 was observed",
    });

    const result = validateCommercialReadinessEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/TELEPHONE/);
  });

  it("rejects licensing or distribution without safety review", () => {
    const report = makeCommercialReadinessReport({
      licensing: {
        status: "pass",
        model: "annual-subscription",
        licenseEvidencePath: "qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json",
        offlineValidation: false,
        noPhiTransmission: false,
        gracefulExpiry: false,
        safetyReviewed: false,
      },
      distribution: {
        status: "pass",
        channel: "public-website",
        downloadIntegrity: true,
        releaseNotesReady: false,
        marketingClaimsReviewed: false,
        supportPathPublished: false,
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/licensing\.offlineValidation/);
    expect(result.errors.join("\n")).toMatch(/licensing\.noPhiTransmission/);
    expect(result.errors.join("\n")).toMatch(/distribution\.releaseNotesReady/);
    expect(result.errors.join("\n")).toMatch(/distribution\.marketingClaimsReviewed/);
  });

  it("rejects pricing or marketing that depends on telemetry or premature claims", () => {
    const report = makeCommercialReadinessReport({
      pricing: {
        status: "pass",
        model: "tiered",
        pricingEvidencePath: "qa-runs/2026-06-06-pricing-evidence.json",
        scopeMatchesLicense: true,
        supportTermsDefined: true,
        noUsageTelemetryDependency: false,
        sponsorApproved: false,
      },
      marketing: {
        status: "pass",
        marketingEvidencePath: "qa-runs/2026-06-06-marketing-evidence.json",
        claimsMatchEvidence: false,
        unsupportedFeaturesDisclosed: false,
        privacyClaimsReviewed: false,
        websiteOrPacketReady: true,
        noClinicReadyClaimBeforeGate: false,
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/pricing\.noUsageTelemetryDependency/);
    expect(result.errors.join("\n")).toMatch(/pricing\.sponsorApproved/);
    expect(result.errors.join("\n")).toMatch(/marketing\.claimsMatchEvidence/);
    expect(result.errors.join("\n")).toMatch(/marketing\.noClinicReadyClaimBeforeGate/);
  });

  it("rejects pricing without a filed pricing evidence report", () => {
    const report = makeCommercialReadinessReport({
      pricing: {
        status: "pass",
        model: "per-clinic",
        scopeMatchesLicense: true,
        supportTermsDefined: true,
        noUsageTelemetryDependency: true,
        sponsorApproved: true,
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/pricing\.pricingEvidencePath/);
  });

  it("rejects marketing without a filed marketing evidence report", () => {
    const report = makeCommercialReadinessReport({
      marketing: {
        status: "pass",
        claimsMatchEvidence: true,
        unsupportedFeaturesDisclosed: true,
        privacyClaimsReviewed: true,
        websiteOrPacketReady: true,
        noClinicReadyClaimBeforeGate: true,
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/marketing\.marketingEvidencePath/);
  });

  it("rejects go-live approval without a filed go-live evidence report", () => {
    const report = makeCommercialReadinessReport({
      goLive: {
        outcome: "go",
        approvers: [
          { role: "IT lead", name: "Alex Chen", date: "2026-06-06" },
          { role: "Pilot sponsor", name: "Sam Rivera", date: "2026-06-06" },
        ],
      },
    });

    const result = validateCommercialReadinessEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/goLive\.goLiveEvidencePath/);
  });
});

function makeWindowsCompatibilityReport(overrides = {}) {
  const matrixEntry = (windowsVersion, machineLabel) => ({
    machineLabel,
    windowsVersion,
    architecture: "x64",
    nodeVersion: "v22.11.0",
    packageLayoutVerified: "pass",
    desktopLaunch: "pass",
    firstRunSetup: "pass",
    localCopyImport: "pass",
    readOnlySmoke: "pass",
    sandboxQa: "pass",
    supportExport: "pass",
    antivirusEndpoint: {
      product: "Microsoft Defender",
      status: "pass",
      exclusionsRequired: false,
      notes: "Endpoint allowed Electron, Node, SQLite, and DBF sandbox access.",
    },
    phiObserved: false,
    liveLegacyTouched: false,
  });

  return {
    schemaVersion: WINDOWS_COMPATIBILITY_SCHEMA_VERSION,
    phiStatement: "no-real-patient-data",
    build: {
      packageVersion: "pilot-2026-06-06",
      gitCommit: "a96131b",
      releaseChannel: "pilot",
    },
    matrix: [
      matrixEntry("Windows 10 22H2", "WIN10-CLINIC-PC-01"),
      matrixEntry("Windows 11 23H2", "WIN11-CLINIC-PC-01"),
    ],
    summary: {
      windows10: "pass",
      windows11: "pass",
      antivirusEndpoint: "pass",
      phiObserved: false,
      liveLegacyTouched: false,
    },
    ...overrides,
  };
}

describe("windows-compatibility-evidence", () => {
  it("accepts a complete Windows 10/11 compatibility matrix", () => {
    const result = validateWindowsCompatibilityEvidence(makeWindowsCompatibilityReport());

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
  });

  it("rejects template placeholders and blocked rows", () => {
    const report = makeWindowsCompatibilityReport({
      build: {
        packageVersion: "pilot-YYYY-MM-DD",
        gitCommit: "abcdef1",
        releaseChannel: "pilot",
      },
      matrix: [
        {
          ...makeWindowsCompatibilityReport().matrix[0],
          packageLayoutVerified: "blocked",
          antivirusEndpoint: {
            product: "TBD",
            status: "blocked",
            exclusionsRequired: false,
            notes: "TBD",
          },
        },
      ],
      summary: {
        windows10: "blocked",
        windows11: "blocked",
        antivirusEndpoint: "blocked",
        phiObserved: false,
        liveLegacyTouched: false,
      },
    });

    const result = validateWindowsCompatibilityEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/placeholder/);
    expect(result.errors.join("\n")).toMatch(/Windows 11/);
    expect(result.errors.join("\n")).toMatch(/packageLayoutVerified/);
  });

  it("rejects PHI-sensitive compatibility evidence tokens", () => {
    const report = makeWindowsCompatibilityReport();
    const rawText = JSON.stringify({
      ...report,
      notes: "patientName was visible in the report",
    });

    const result = validateWindowsCompatibilityEvidence(JSON.parse(rawText), { rawText });

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/patient-identifying/);
  });

  it("rejects reports that touched live legacy data", () => {
    const report = makeWindowsCompatibilityReport();
    report.matrix[0].liveLegacyTouched = true;
    report.summary.liveLegacyTouched = true;

    const result = validateWindowsCompatibilityEvidence(report);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/liveLegacyTouched/);
  });

  it("prints ready from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-windows-compatibility-evidence.json"),
        `${JSON.stringify(makeWindowsCompatibilityReport(), null, 2)}\n`,
        "utf8",
      );

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "windows-compatibility-evidence.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "qa-runs/2026-06-06-windows-compatibility-evidence.json",
        "--repo-root",
        root,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("WINDOWS COMPATIBILITY: READY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("commercial-evidence-status", () => {
  it("reports all commercial evidence families blocked when no reports are filed", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      const result = auditCommercialEvidenceStatus({ repoRoot: root });

      expect(result.ready).toBe(false);
      expect(result.status).toBe("blocked");
      expect(result.components.every((component) => component.status === "blocked")).toBe(true);
      expect(result.components.map((component) => component.id)).toContain("package-verification");
      expect(result.components.map((component) => component.id)).toContain("commercial-readiness");
      expect(result.components.map((component) => component.id)).toContain("offline-license");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports ready when every commercial evidence family has a valid non-template report", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );

      const result = auditCommercialEvidenceStatus({ repoRoot: root, publicKeyPem });

      expect(result.ready).toBe(true);
      expect(result.status).toBe("ready");
      expect(result.components.every((component) => component.status === "ready")).toBe(true);
      expect(result.components.find((component) => component.id === "package-verification")?.readyCandidateCount).toBe(1);
      expect(result.components.find((component) => component.id === "commercial-readiness")?.readyCandidateCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps offline license blocked without a public key", () => {
    const root = makeTempDir();
    try {
      writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );

      const result = auditCommercialEvidenceStatus({ repoRoot: root, publicKeyPem: undefined });
      const license = result.components.find((component) => component.id === "offline-license");

      expect(result.ready).toBe(false);
      expect(license?.status).toBe("blocked");
      expect(license?.errors.join("\n")).toMatch(/public key is required/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps go-live blocked when its nested evidence references are missing", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-go-live-evidence.json"),
        `${JSON.stringify(makeGoLiveEvidence(), null, 2)}\n`,
        "utf8",
      );

      const result = auditCommercialEvidenceStatus({ repoRoot: root });
      const goLive = result.components.find((component) => component.id === "go-live");

      expect(result.ready).toBe(false);
      expect(goLive?.status).toBe("blocked");
      expect(goLive?.errors.join("\n")).toMatch(/evidencePaths\.packageVerificationEvidencePath does not exist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints ready JSON from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );
      const publicKeyPath = join(root, "keys", "microdent-license-public.pem");
      mkdirSync(dirname(publicKeyPath), { recursive: true });
      writeFileSync(publicKeyPath, publicKeyPem, "utf8");

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "commercial-evidence-status.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--json",
        "--repo-root",
        root,
        "--public-key",
        "keys/microdent-license-public.pem",
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.ready).toBe(true);
      expect(json.status).toBe("ready");
      expect(json.components.every((component) => component.status === "ready")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes blocked markdown plans under an alternate repo root", () => {
    const root = makeTempDir();
    const writePath = "qa-runs/2026-06-06-evidence-filing-plan.md";
    const accidentalRepoPath = join(dirname(fileURLToPath(import.meta.url)), "..", writePath);
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      if (existsSync(accidentalRepoPath)) {
        unlinkSync(accidentalRepoPath);
      }

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "evidence-filing-plan.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--repo-root",
        root,
        "--date",
        "2026-06-06",
        "--clinic-label",
        "CLINIC-PC-01",
        "--write",
        writePath,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(`[evidence-filing-plan] wrote ${writePath}`);
      const markdown = readFileSync(join(root, writePath), "utf8");
      expect(markdown).toContain("# Microdent Modern evidence filing plan");
      expect(markdown).toContain("**Status:** BLOCKED");
      expect(existsSync(accidentalRepoPath)).toBe(false);
    } finally {
      if (existsSync(accidentalRepoPath)) {
        unlinkSync(accidentalRepoPath);
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes relative filing plans under the repo root when invoked from another cwd", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const root = makeTempDir();
    const writePath = "qa-runs/2026-06-06-evidence-filing-plan.md";
    const repoOutputPath = join(repoRoot, writePath);
    const accidentalCwdPath = join(root, writePath);
    try {
      if (existsSync(repoOutputPath)) {
        unlinkSync(repoOutputPath);
      }

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "evidence-filing-plan.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--date",
        "2026-06-06",
        "--clinic-label",
        "CLINIC-PC-01",
        "--write",
        writePath,
      ], {
        cwd: root,
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(`[evidence-filing-plan] wrote ${writePath}`);
      const markdown = readFileSync(repoOutputPath, "utf8");
      expect(markdown).toContain("# Microdent Modern evidence filing plan");
      expect(markdown).toContain("**Status:** BLOCKED");
      expect(existsSync(accidentalCwdPath)).toBe(false);
    } finally {
      if (existsSync(repoOutputPath)) {
        unlinkSync(repoOutputPath);
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes blocked filing plans even when the referenced public key is not present yet", () => {
    const root = makeTempDir();
    const writePath = "qa-runs/2026-06-06-evidence-filing-plan.md";
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "evidence-filing-plan.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--repo-root",
        root,
        "--date",
        "2026-06-06",
        "--clinic-label",
        "CLINIC-PC-01",
        "--public-key",
        "keys/microdent-license-public.pem",
        "--write",
        writePath,
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(`[evidence-filing-plan] wrote ${writePath}`);
      const markdown = readFileSync(join(root, writePath), "utf8");
      expect(markdown).toContain("**Status:** BLOCKED");
      expect(markdown).toContain("pnpm license:validate -- qa-runs/2026-06-06-offline-license-CLINIC-PC-01.json --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("no non-template qa-runs/*offline-license*.json found");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints blocked status and completion JSON when the referenced public key is not present yet", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });

      const commercialStatusScript = join(dirname(fileURLToPath(import.meta.url)), "commercial-evidence-status.mjs");
      const commercialStatus = spawnSync(process.execPath, [
        commercialStatusScript,
        "--repo-root",
        root,
        "--public-key",
        "keys/microdent-license-public.pem",
        "--json",
      ], {
        encoding: "utf8",
      });

      expect(commercialStatus.stderr).toBe("");
      expect(commercialStatus.status).toBe(1);
      expect(JSON.parse(commercialStatus.stdout).status).toBe("blocked");

      const completionScript = join(dirname(fileURLToPath(import.meta.url)), "roadmap-completion-audit.mjs");
      const completion = spawnSync(process.execPath, [
        completionScript,
        "--repo-root",
        root,
        "--public-key",
        "keys/microdent-license-public.pem",
        "--json",
      ], {
        encoding: "utf8",
      });

      expect(completion.stderr).toBe("");
      expect(completion.status).toBe(1);
      expect(JSON.parse(completion.stdout).status).toBe("blocked");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("evidence-filing-plan", () => {
  it("builds a blocked PHI-safe filing plan with target names and validators", () => {
    const root = makeTempDir();
    try {
      mkdirSync(join(root, "qa-runs"), { recursive: true });
      const plan = buildEvidenceFilingPlan({
        repoRoot: root,
        date: "2026-06-06",
        clinicLabel: "CLINIC-PC-01",
      });
      const markdown = renderEvidenceFilingPlanMarkdown(plan);

      expect(plan.ready).toBe(false);
      expect(plan.status).toBe("blocked");
      expect(plan.summary.blocked).toBe(plan.summary.total);
      expect(plan.items.find((item) => item.id === "package-verification")?.targetPath)
        .toBe("qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      expect(plan.items.find((item) => item.id === "package-verification")?.packetCommands)
        .toContain("pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(plan.items.find((item) => item.id === "package-verification")?.errors)
        .toContain("no completed non-template windows package verification evidence is filed under qa-runs/");
      expect(plan.items.find((item) => item.id === "windows-field-evidence")?.targetPath)
        .toBe("qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json");
      expect(plan.items.find((item) => item.id === "windows-field-evidence")?.packetCommands)
        .toContain("pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(plan.items.find((item) => item.id === "signed-artifacts")?.packetCommands)
        .toEqual([
          "pnpm pilot:installer-packet -- --date 2026-06-06 --target nsis --public-key keys/microdent-license-public.pem",
          "pnpm pilot:auto-update-packet -- --date 2026-06-06 --channel internal-signed-feed --public-key keys/microdent-license-public.pem",
        ]);
      expect(plan.items.find((item) => item.id === "commercial-readiness")?.packetCommands)
        .toContain("pnpm pilot:commercial-launch-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:field-evidence -- qa-runs/2026-06-06-windows-field-evidence-CLINIC-PC-01.json");
      expect(markdown).toContain("pnpm pilot:package-verify-evidence -- qa-runs/2026-06-06-windows-package-verify-evidence-CLINIC-PC-01.json");
      expect(markdown).toContain("no completed non-template windows package verification evidence is filed under qa-runs/");
      expect(markdown).toContain("Prepare with:");
      expect(markdown).toContain("pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:installer-packet -- --date 2026-06-06 --target nsis --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:auto-update-packet -- --date 2026-06-06 --channel internal-signed-feed --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:commercial-launch-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:go-live-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --public-key keys/microdent-license-public.pem");
      expect(markdown).toContain("pnpm pilot:intake-safe-results -- /path/to/MicrodentModern-safe-results.zip");
      expect(markdown).toContain("read-only smoke stays `READ_ONLY_READY`");
      expect(markdown).toContain("pnpm pilot:commercial-evidence-status");
      expect(markdown).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT payload/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports ready when filed evidence and final readiness are complete", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );

      const plan = buildEvidenceFilingPlan({
        repoRoot: root,
        date: "2026-06-06",
        clinicLabel: "CLINIC-PC-01",
        publicKeyPem,
      });
      const blockedItems = plan.items
        .filter((item) => item.status !== "ready")
        .map((item) => ({ id: item.id, status: item.status, errors: item.errors }));

      expect(plan.ready, JSON.stringify(blockedItems, null, 2)).toBe(true);
      expect(plan.status).toBe("ready");
      expect(plan.summary.ready).toBe(plan.summary.total);
      expect(plan.items.every((item) => item.errors.length === 0)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints ready JSON from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );
      const publicKeyPath = join(root, "keys", "microdent-license-public.pem");
      mkdirSync(dirname(publicKeyPath), { recursive: true });
      writeFileSync(publicKeyPath, publicKeyPem, "utf8");

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "evidence-filing-plan.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--json",
        "--repo-root",
        root,
        "--date",
        "2026-06-06",
        "--clinic-label",
        "CLINIC-PC-01",
        "--public-key",
        "keys/microdent-license-public.pem",
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.ready).toBe(true);
      expect(json.status).toBe("ready");
      expect(json.summary.ready).toBe(json.summary.total);
      expect(json.items.find((item) => item.id === "package-verification")?.status).toBe("ready");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("roadmap-completion-audit", () => {
  it("proves local roadmap evidence while keeping final completion blocked without external evidence", () => {
    const result = auditRoadmapCompletion();

    expect(result.localReady).toBe(true);
    expect(result.localItems.filter((item) => !item.ok)).toEqual([]);
    expect(result.packageVerificationReady).toBe(false);
    expect(result.tier3Ready).toBe(false);
    expect(result.commercialReady).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockers.join("\n")).toMatch(/package verification evidence/);
    expect(result.blockers.join("\n")).toMatch(/Windows field evidence/);
    expect(result.blockers.join("\n")).toMatch(/commercial readiness evidence/);
  });

  it("accepts a public key for nested commercial license evidence validation", () => {
    const { publicKeyPem } = makeSignedOfflineLicense();
    const result = auditRoadmapCompletion({ publicKeyPem });

    expect(result.localReady).toBe(true);
    expect(result.ready).toBe(false);
    expect(result.packageVerificationReady).toBe(false);
    expect(result.commercialReady).toBe(false);
  });

  it("reports ready when local evidence and all required external evidence are present", () => {
    const root = makeTempDir();
    try {
      writeMinimalRoadmapLocalEvidence(root);
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );

      const result = auditRoadmapCompletion({ repoRoot: root, publicKeyPem });

      expect(result.localReady).toBe(true);
      expect(result.packageVerificationReady).toBe(true);
      expect(result.tier3Ready).toBe(true);
      expect(result.commercialReady).toBe(true);
      expect(result.ready).toBe(true);
      expect(result.status).toBe("ready");
      expect(result.blockers).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prints ready JSON from the CLI for a complete alternate repo root", () => {
    const root = makeTempDir();
    try {
      writeMinimalRoadmapLocalEvidence(root);
      const { publicKeyPem } = writeCommercialEvidenceBundle(root);
      writeFileSync(
        join(root, "qa-runs", "2026-06-06-commercial-readiness-evidence.json"),
        `${JSON.stringify(makeCommercialReadinessReport(), null, 2)}\n`,
        "utf8",
      );
      const publicKeyPath = join(root, "keys", "microdent-license-public.pem");
      mkdirSync(dirname(publicKeyPath), { recursive: true });
      writeFileSync(publicKeyPath, publicKeyPem, "utf8");

      const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "roadmap-completion-audit.mjs");
      const result = spawnSync(process.execPath, [
        scriptPath,
        "--json",
        "--repo-root",
        root,
        "--public-key",
        "keys/microdent-license-public.pem",
      ], {
        encoding: "utf8",
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.ready).toBe(true);
      expect(json.status).toBe("ready");
      expect(json.packageVerificationReady).toBe(true);
      expect(json.tier3Ready).toBe(true);
      expect(json.commercialReady).toBe(true);
      expect(json.blockers).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("evidence CLI alternate-root support", () => {
  const evidenceCommands = [
    ["pilot:package-verify-evidence", "scripts/package-verify-evidence.mjs"],
    ["pilot:attachment-manifest", "scripts/evidence-attachment-manifest.mjs"],
    ["pilot:field-evidence", "scripts/windows-field-evidence.mjs"],
    ["pilot:windows-compatibility", "scripts/windows-compatibility-evidence.mjs"],
    ["pilot:signed-artifacts", "scripts/signed-artifact-evidence.mjs"],
    ["pilot:installer-evidence", "scripts/installer-evidence.mjs"],
    ["pilot:auto-update-evidence", "scripts/auto-update-evidence.mjs"],
    ["pilot:clinic-report", "scripts/clinic-pilot-report-evidence.mjs"],
    ["pilot:support-readiness", "scripts/support-readiness-evidence.mjs"],
    ["pilot:distribution-evidence", "scripts/distribution-evidence.mjs"],
    ["pilot:pricing-evidence", "scripts/pricing-evidence.mjs"],
    ["pilot:marketing-evidence", "scripts/marketing-evidence.mjs"],
    ["pilot:go-live-evidence", "scripts/go-live-evidence.mjs"],
    ["license:validate", "scripts/offline-license-validate.mjs"],
    ["pilot:commercial-evidence-status", "scripts/commercial-evidence-status.mjs"],
    ["pilot:evidence-filing-plan", "scripts/evidence-filing-plan.mjs"],
    ["pilot:commercial-readiness", "scripts/commercial-readiness-audit.mjs"],
    ["roadmap:completion-audit", "scripts/roadmap-completion-audit.mjs"],
  ];

  it("keeps filed-evidence commands wired and documented for alternate evidence bundles", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const scriptsReadme = readFileSync(join(repoRoot, "scripts", "README.md"), "utf8");
    const pilotStart = readFileSync(join(repoRoot, "docs", "PILOT-START-HERE.md"), "utf8");

    for (const [command, scriptPath] of evidenceCommands) {
      expect(packageJson.scripts[command], command).toBe(`node ${scriptPath}`);

      const script = readFileSync(join(repoRoot, scriptPath), "utf8");
      expect(script, scriptPath).toContain("--repo-root");

      expect(scriptsReadme, command).toContain(command);
      expect(pilotStart, command).toContain(command);
    }

    expect(scriptsReadme).toContain("alternate checkout/evidence bundle");
    expect(pilotStart).toContain("alternate checkout/evidence bundle");
  });

  it("keeps relative public-key paths checkout-rooted unless an alternate repo root is supplied", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const scriptsReadme = readFileSync(join(repoRoot, "scripts", "README.md"), "utf8");
    const pilotStart = readFileSync(join(repoRoot, "docs", "PILOT-START-HERE.md"), "utf8");
    const licenseDoc = readFileSync(join(repoRoot, "docs", "offline-license-mechanism.md"), "utf8");
    const publicKeyCoordinators = [
      "scripts/commercial-evidence-status.mjs",
      "scripts/commercial-readiness-audit.mjs",
      "scripts/evidence-filing-plan.mjs",
      "scripts/offline-license-validate.mjs",
      "scripts/roadmap-completion-audit.mjs",
    ];

    for (const scriptPath of publicKeyCoordinators) {
      const script = readFileSync(join(repoRoot, scriptPath), "utf8");
      expect(script, scriptPath).toContain("join(parsed.repoRoot ?? REPO_ROOT, parsed.publicKeyPath)");
    }

    expect(scriptsReadme).toContain("relative `--public-key` paths resolve from the repo root");
    expect(pilotStart).toContain("relative `--public-key` paths resolve from the repo root");
    expect(licenseDoc).toContain("Relative `--public-key` paths resolve from the repository root by default");
    expect(scriptsReadme.match(/relative `--public-key` paths resolve from the repo root/g)?.length).toBeGreaterThanOrEqual(5);
    expect(pilotStart.match(/relative `--public-key` paths resolve from the repo root/g)?.length).toBeGreaterThanOrEqual(5);
    expect(pilotStart.match(/relative key paths resolve from the repo root/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("cross-platform sandbox qa entrypoint", () => {
  it("keeps pnpm qa:sandbox on the Node orchestrator with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["qa:sandbox"]).toBe("node scripts/qa-sandbox-run.mjs");
    expect(packageJson.scripts["qa:sandbox:bash"]).toBe("bash scripts/qa-sandbox-run.sh");
  });

  it("keeps sandbox evidence summary PHI-safe and path-light", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const script = readFileSync(join(repoRoot, "scripts", "qa-sandbox-run.mjs"), "utf8");
    const scriptsReadme = readFileSync(join(repoRoot, "scripts", "README.md"), "utf8");
    const sandboxDoc = readFileSync(join(repoRoot, "docs", "phase-3-sandbox-qa-runner.md"), "utf8");

    expect(script).toContain("QA_SANDBOX_EVIDENCE_SUMMARY");
    expect(script).toContain("microdent-qa-sandbox-evidence-summary/v1");
    expect(script).toContain('phiStatement: "no-real-patient-data"');
    expect(script).toContain("rawPathsExcluded: true");
    expect(script).toContain("backupBasename: basenameSafe(backup)");
    expect(script).toContain("operationId: commit.json?.operationId");
    expect(script).not.toContain("dataRoot:");
    expect(script).not.toContain("sqlitePath:");
    expect(script).not.toContain("patientId:");
    expect(scriptsReadme).toContain("QA_SANDBOX_EVIDENCE_SUMMARY");
    expect(sandboxDoc).toContain("QA_SANDBOX_EVIDENCE_SUMMARY");
  });
});

describe("cross-platform roadmap local audit entrypoint", () => {
  it("keeps pnpm roadmap:local-audit on the Node orchestrator with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const localAudit = readFileSync(join(repoRoot, "scripts", "roadmap-local-audit.mjs"), "utf8");
    const bashLocalAudit = readFileSync(join(repoRoot, "scripts", "roadmap-local-audit.sh"), "utf8");

    expect(packageJson.scripts["roadmap:local-audit"]).toBe("node scripts/roadmap-local-audit.mjs");
    expect(packageJson.scripts["roadmap:local-audit:bash"]).toBe("bash scripts/roadmap-local-audit.sh");
    expect(packageJson.scripts["pilot:staged-link-audit"]).toBe("node scripts/staged-markdown-link-audit.mjs");
    expect(packageJson.scripts["pilot:package-verify-packet"]).toBe("node scripts/package-verify-packet.mjs");
    expect(packageJson.scripts["pilot:package-verify-evidence"]).toBe("node scripts/package-verify-evidence.mjs");
    expect(localAudit).toContain("pilot:package-verify-packet");
    expect(localAudit).toContain("pilot:package-verify-evidence");
    expect(localAudit).toContain("pilot:evidence-collection-packet");
    expect(localAudit).toContain("pilot:staged-link-audit");
    expect(localAudit).toContain("missing staged qa-runs templates");
    expect(localAudit).toContain("unexpected staged qa-runs templates");
    expect(localAudit).toContain("source qa-runs templates");
    expect(localAudit).toContain("package_verification=blocked");
    expect(bashLocalAudit).toContain("pilot:evidence-collection-packet");
    expect(bashLocalAudit).toContain("pilot:staged-link-audit");
    expect(bashLocalAudit).toContain("missing staged qa-runs templates");
    expect(bashLocalAudit).toContain("unexpected staged qa-runs templates");
    expect(bashLocalAudit).toContain("source qa-runs templates");
    expect(bashLocalAudit).toContain("package_verification=blocked");
  });
});

describe("cross-platform strict release signoff entrypoint", () => {
  it("keeps pnpm pilot:release-signoff on the Node orchestrator with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["pilot:release-signoff"]).toBe("node scripts/pilot-release-signoff.mjs");
    expect(packageJson.scripts["pilot:release-signoff:bash"]).toBe("bash scripts/pilot-release-signoff.sh");
  });
});

describe("cross-platform local strict signoff rehearsal entrypoint", () => {
  it("keeps pnpm strict-signoff:local on the Node orchestrator with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["strict-signoff:local"]).toBe("node scripts/strict-signoff-local.mjs");
    expect(packageJson.scripts["strict-signoff:local:bash"]).toBe("bash scripts/strict-signoff-local.sh");
  });
});

describe("cross-platform mirror import entrypoint", () => {
  it("keeps pnpm mirror:import-safe on the Node wrapper with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["mirror:import-safe"]).toBe("node scripts/mirror-import-safe.mjs");
    expect(packageJson.scripts["mirror:import-safe:bash"]).toBe("bash scripts/mirror-import-safe.sh");
  });
});

describe("cross-platform legacy data safety entrypoints", () => {
  it("keeps root legacy safety commands on the Node wrapper with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["legacy:backup"]).toBe("node scripts/legacy-command.mjs backup");
    expect(packageJson.scripts["legacy:backup:bash"]).toBe("bash scripts/legacy-backup.sh");
    expect(packageJson.scripts["legacy:create-sandbox"]).toBe("node scripts/legacy-command.mjs create-sandbox");
    expect(packageJson.scripts["legacy:create-sandbox:bash"]).toBe("bash scripts/legacy-create-sandbox.sh");
    expect(packageJson.scripts["legacy:restore"]).toBe("node scripts/legacy-command.mjs restore");
    expect(packageJson.scripts["legacy:restore:bash"]).toBe("bash scripts/legacy-restore.sh");
    expect(packageJson.scripts["legacy:backup-verify"]).toBe("node scripts/legacy-command.mjs backup-verify");
    expect(packageJson.scripts["legacy:backup-verify:bash"]).toBe("bash scripts/legacy-backup-verify.sh");
  });
});

describe("cross-platform pilot checkpoint entrypoints", () => {
  it("keeps dev and distribution checkpoints on the Node orchestrator with bash only as fallback", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["pilot:full-checkpoint"]).toBe("node scripts/pilot-checkpoint.mjs full-checkpoint");
    expect(packageJson.scripts["pilot:full-checkpoint:bash"]).toBe("bash scripts/pilot-full-checkpoint.sh");
    expect(packageJson.scripts["pilot:distribution-checkpoint"]).toBe(
      "node scripts/pilot-checkpoint.mjs distribution-checkpoint",
    );
    expect(packageJson.scripts["pilot:distribution-checkpoint:bash"]).toBe(
      "bash scripts/pilot-distribution-checkpoint.sh",
    );
    expect(packageJson.scripts["pilot:release-check"]).toBe("node scripts/pilot-checkpoint.mjs release-check");
    expect(packageJson.scripts["pilot:release-check:bash"]).toBe("bash scripts/pilot-release-check.sh");
  });
});

describe("windows readiness docs for root command wrappers", () => {
  it("documents root legacy and mirror commands as PowerShell-friendly Node wrappers", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const readiness = readFileSync(join(repoRoot, "docs", "phase-3-windows-readiness-audit.md"), "utf8");
    const scriptsReadme = readFileSync(join(repoRoot, "scripts", "README.md"), "utf8");

    expect(readiness).toContain("**Root `pnpm legacy:*` / `mirror:import-safe`** | **Cross-platform Node wrappers**");
    expect(readiness).toContain("use root Node wrappers (`pnpm mirror:import-safe`, `pnpm legacy:*`) with drive-letter paths");
    expect(readiness).not.toContain("Bash wrappers — use **WSL/Git Bash**");
    expect(scriptsReadme).toContain("prefer the root `pnpm` Node wrappers with PowerShell env vars");
    expect(scriptsReadme).toContain("pnpm mirror:import-safe");
  });
});
