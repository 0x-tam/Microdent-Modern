import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertNotForbiddenLegacyCopyPath,
  assertNotForbiddenLegacyPath,
} from "../backup/forbidden-path.js";
import {
  FORBIDDEN_LEGACY_COPY_ROOT,
  FORBIDDEN_LEGACY_ROOT,
  WRITE_SANDBOX_MARKER,
} from "../write-safety/constants.js";
import {
  createWriteSandbox,
  printCreateWriteSandboxReport,
  SANDBOX_DISPOSABLE_WARNING,
} from "./create-write-sandbox.js";

const SECRET_PAYLOAD = "SYNTHETIC_PATIENT_NOTE_TOKEN_ZZ";

async function fileSha256(absPath: string): Promise<string> {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

describe("create write sandbox", () => {
  let sourceRoot = "";
  let sandboxRoot = "";

  afterEach(async () => {
    const dirs = [sourceRoot, sandboxRoot].filter(Boolean);
    for (const dir of dirs) {
      if (dir && existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
    sourceRoot = "";
    sandboxRoot = "";
  });

  async function setupSyntheticSource(): Promise<void> {
    sourceRoot = await mkdtemp(join(tmpdir(), "microdent-sandbox-src-"));
    sandboxRoot = await mkdtemp(join(tmpdir(), "microdent-sandbox-out-"));
    await mkdir(join(sourceRoot, "nested"), { recursive: true });
    await writeFile(join(sourceRoot, "SCHEDULE.DBF"), Buffer.from("synthetic-dbf"), "utf8");
    await writeFile(join(sourceRoot, "nested", "side.txt"), SECRET_PAYLOAD, "utf8");
  }

  it("copies source into SANDBOX_ROOT/DATA with marker and backups", async () => {
    await setupSyntheticSource();
    const sourceSchedule = join(sourceRoot, "SCHEDULE.DBF");
    const beforeHash = await fileSha256(sourceSchedule);

    const result = await createWriteSandbox({
      sourceDataRoot: sourceRoot,
      sandboxRoot,
    });

    expect(result.counts.files).toBe(2);
    expect(result.counts.directories).toBe(1);
    expect(existsSync(result.backupsDir)).toBe(true);
    expect(existsSync(join(sandboxRoot, "DATA", "SCHEDULE.DBF"))).toBe(true);
    expect(existsSync(join(sandboxRoot, "DATA", "nested", "side.txt"))).toBe(true);
    expect(existsSync(result.markerPath)).toBe(true);

    const marker = JSON.parse(readFileSync(result.markerPath, "utf8")) as Record<string, unknown>;
    expect(marker.disposable).toBe(true);
    expect(marker.createdAt).toBe(result.createdAt);
    expect(marker.sourceDataRootRealpath).toBe(result.sourceDataRootRealpath);
    expect(marker.sandboxDataRootRealpath).toBe(result.sandboxDataRootRealpath);
    expect(marker.warning).toBe(SANDBOX_DISPOSABLE_WARNING);

    expect(await fileSha256(sourceSchedule)).toBe(beforeHash);
  });

  it("rejects relative SOURCE_DATA_ROOT and SANDBOX_ROOT", async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), "microdent-sandbox-out-"));
    await expect(
      createWriteSandbox({
        sourceDataRoot: "relative/DATA",
        sandboxRoot,
      }),
    ).rejects.toThrow(/SOURCE_DATA_ROOT must be an absolute path/);

    sourceRoot = await mkdtemp(join(tmpdir(), "microdent-sandbox-src-"));
    await expect(
      createWriteSandbox({
        sourceDataRoot: sourceRoot,
        sandboxRoot: "relative/sandbox",
      }),
    ).rejects.toThrow(/SANDBOX_ROOT must be an absolute path/);
  });

  it("rejects SOURCE_DATA_ROOT under Microdent-Legacy", async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), "microdent-sandbox-out-"));
    await expect(
      createWriteSandbox({
        sourceDataRoot: join(FORBIDDEN_LEGACY_ROOT, "DATA"),
        sandboxRoot,
      }),
    ).rejects.toThrow(/Microdent-Legacy/);
  });

  it("rejects SANDBOX_ROOT under Microdent-Legacy and Microdent-Legacy-Copy", async () => {
    sourceRoot = await mkdtemp(join(tmpdir(), "microdent-sandbox-src-"));
    await writeFile(join(sourceRoot, "stub.dbf"), "x", "utf8");

    await expect(
      createWriteSandbox({
        sourceDataRoot: sourceRoot,
        sandboxRoot: join(FORBIDDEN_LEGACY_ROOT, "Write-Sandbox"),
      }),
    ).rejects.toThrow(/Microdent-Legacy/);

    await expect(
      createWriteSandbox({
        sourceDataRoot: sourceRoot,
        sandboxRoot: join(FORBIDDEN_LEGACY_COPY_ROOT, "Write-Sandbox"),
      }),
    ).rejects.toThrow(/Microdent-Legacy-Copy/);
  });

  it("path guards reject forbidden legacy trees", () => {
    expect(() => assertNotForbiddenLegacyPath(FORBIDDEN_LEGACY_ROOT, "SOURCE_DATA_ROOT")).toThrow(
      /Microdent-Legacy/,
    );
    expect(() =>
      assertNotForbiddenLegacyCopyPath(join(FORBIDDEN_LEGACY_COPY_ROOT, "sandbox"), "SANDBOX_ROOT"),
    ).toThrow(/Microdent-Legacy-Copy/);
  });

  it("report output includes counts only, not file payloads", async () => {
    await setupSyntheticSource();
    const result = await createWriteSandbox({
      sourceDataRoot: sourceRoot,
      sandboxRoot,
    });

    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      printCreateWriteSandboxReport(result);
    } finally {
      console.log = log;
    }

    const report = lines.join("\n");
    expect(report).toContain("create-sandbox: ok");
    expect(report).toContain("2 files");
    expect(report).toContain(WRITE_SANDBOX_MARKER);
    expect(report).not.toContain(SECRET_PAYLOAD);
  });
});
