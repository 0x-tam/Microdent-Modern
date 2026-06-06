import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertCompiledArtifactTextSafe,
  assertStagedTreeSafe,
  isForbiddenStagedFileName,
  pathHasForbiddenSegment,
  REQUIRED_STAGED_LAYOUT,
  scanStagedArtifacts,
} from "./pilot-release-artifact-rules.mjs";
import {
  assertManifestJsonSafe,
  buildPilotBuildMetadata,
  generateReleaseManifest,
  UNSUPPORTED_FEATURES,
  verifyManifestHashes,
} from "./pilot-release-manifest.mjs";
import {
  validateNodeRuntimeDir,
  writeNodeRuntimeManifest,
} from "./node-runtime-staging.mjs";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "pilot-artifact-test-"));
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
    expect(REQUIRED_STAGED_LAYOUT).toContain("PILOT-START-HERE.md");
    expect(REQUIRED_STAGED_LAYOUT).toContain("qa-runs/README.txt");
    expect(REQUIRED_STAGED_LAYOUT).toContain("web/pilot-build.json");
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
});
