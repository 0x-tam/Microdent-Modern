import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertStagedTreeSafe,
  isForbiddenStagedFileName,
  pathHasForbiddenSegment,
  REQUIRED_STAGED_LAYOUT,
} from "./pilot-release-artifact-rules.mjs";
import {
  assertManifestJsonSafe,
  generateReleaseManifest,
  verifyManifestHashes,
} from "./pilot-release-manifest.mjs";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "pilot-artifact-test-"));
}

function writeMinimalGoodTree(root) {
  for (const rel of REQUIRED_STAGED_LAYOUT) {
    if (rel === "RELEASE-MANIFEST.json") {
      continue;
    }
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
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

  it("rejects synthetic bad package (dbf + env)", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      mkdirSync(join(root, "leak"), { recursive: true });
      writeFileSync(join(root, "leak", "schedule.dbf"), "bad", "utf8");
      writeFileSync(join(root, ".env"), "SECRET=1\n", "utf8");
      expect(() => assertStagedTreeSafe(root)).toThrow(/forbidden/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts synthetic good package before manifest", () => {
    const root = makeTempDir();
    try {
      writeMinimalGoodTree(root);
      expect(() => assertStagedTreeSafe(root)).not.toThrow();
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
      assertStagedTreeSafe(root);
      await generateReleaseManifest(root, { repoRoot, buildTimestampUtc: "2026-05-21T00:00:00.000Z" });
      const raw = readFileSync(join(root, "RELEASE-MANIFEST.json"), "utf8");
      assertManifestJsonSafe(raw);
      const manifest = JSON.parse(raw);
      expect(manifest.fileCount).toBeGreaterThan(0);
      expect(manifest.packageName).toBe("MicrodentModern");
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
