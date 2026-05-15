import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { mkdtemp, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FORBIDDEN_LEGACY_COPY_ROOT,
  FORBIDDEN_LEGACY_ROOT,
  WRITE_SANDBOX_MARKER,
} from "../write-safety/constants.js";
import { printLegacyRestoreReport, runLegacyRestore } from "./run-legacy-restore.js";
import { runLegacyBackup } from "./run-legacy-backup.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";

const SECRET_COMMENT = "SYNTHETIC_COMMENT_TOKEN_XX";
const SECRET_NAME = "SYNTHETIC_NAME_TOKEN_YY";

async function fileSha256(absPath: string): Promise<string> {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

function writeSandboxMarker(dir: string): void {
  writeFileSync(
    join(dir, WRITE_SANDBOX_MARKER),
    `${JSON.stringify({ disposable: true })}\n`,
    "utf8",
  );
}

describe("legacy restore", () => {
  let dataRoot = "";
  let backupRoot = "";
  let sandboxRoot = "";

  afterEach(() => {
    dataRoot = "";
    backupRoot = "";
    sandboxRoot = "";
  });

  async function setupBackupSource(): Promise<string> {
    dataRoot = await mkdtemp(join(tmpdir(), "microdent-restore-src-"));
    backupRoot = await mkdtemp(join(tmpdir(), "microdent-restore-bak-"));
    await writeScheduleFixtures(dataRoot, { withPatientDbf: false });
    await writeFile(join(dataRoot, "SCHEDULE.FPT"), Buffer.from("synthetic-fpt"), "utf8");
    await writeFile(join(dataRoot, "SCHEDULE.CDX"), Buffer.from("synthetic-cdx"), "utf8");

    const backup = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });
    return backup.backupFolder;
  }

  async function setupSandbox(): Promise<void> {
    sandboxRoot = await mkdtemp(join(tmpdir(), "microdent-restore-sandbox-"));
    writeSandboxMarker(sandboxRoot);
    await writeScheduleFixtures(sandboxRoot, { withPatientDbf: false });
    await writeFile(join(sandboxRoot, "SCHEDULE.FPT"), Buffer.from("stale-fpt"), "utf8");
    await writeFile(join(sandboxRoot, "SCHEDULE.CDX"), Buffer.from("stale-cdx"), "utf8");
  }

  it("restores every manifest file into a disposable sandbox with verified hashes", async () => {
    const backupFolder = await setupBackupSource();
    await setupSandbox();

    const result = await runLegacyRestore({
      backupFolder,
      dataRoot: sandboxRoot,
    });

    expect(result.files).toHaveLength(3);
    for (const file of result.files) {
      expect(file.status).toBe("restored");
      const restoredPath = join(sandboxRoot, file.filename);
      const restoredStat = await stat(restoredPath);
      expect(restoredStat.size).toBe(file.size);
      expect(await fileSha256(restoredPath)).toBe(file.sha256);
    }

    const sourceDbf = join(dataRoot, "SCHEDULE.DBF");
    const restoredDbf = join(sandboxRoot, "SCHEDULE.DBF");
    expect(await fileSha256(restoredDbf)).toBe(await fileSha256(sourceDbf));
  });

  it("refuses incomplete backup manifests before copying", async () => {
    const backupFolder = await setupBackupSource();
    await setupSandbox();

    await unlink(join(backupFolder, "files", "SCHEDULE.FPT"));

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: sandboxRoot,
      }),
    ).rejects.toThrow(/backup file missing: SCHEDULE\.FPT/);

    expect(await fileSha256(join(sandboxRoot, "SCHEDULE.FPT"))).not.toBe(
      await fileSha256(join(backupFolder, "files", "SCHEDULE.DBF")),
    );
    const fptStat = await stat(join(sandboxRoot, "SCHEDULE.FPT"));
    expect(fptStat.size).toBe(Buffer.byteLength("stale-fpt"));
  });

  it("rejects backup sha256 mismatch during preflight", async () => {
    const backupFolder = await setupBackupSource();
    await setupSandbox();

    const manifestPath = join(backupFolder, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: { filename: string; size: number; sha256: string }[];
    };
    const fpt = manifest.files.find((f) => f.filename === "SCHEDULE.FPT");
    expect(fpt).toBeTruthy();
    fpt!.sha256 = "0".repeat(64);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: sandboxRoot,
      }),
    ).rejects.toThrow(/sha256 mismatch for SCHEDULE\.FPT/);
  });

  it("rejects DATA_ROOT without disposable sandbox marker", async () => {
    const backupFolder = await setupBackupSource();
    sandboxRoot = await mkdtemp(join(tmpdir(), "microdent-restore-no-marker-"));
    await writeScheduleFixtures(sandboxRoot, { withPatientDbf: false });

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: sandboxRoot,
      }),
    ).rejects.toThrow(/\.microdent-write-sandbox\.json/);
  });

  it("rejects marker without disposable: true", async () => {
    const backupFolder = await setupBackupSource();
    sandboxRoot = await mkdtemp(join(tmpdir(), "microdent-restore-bad-marker-"));
    writeFileSync(
      join(sandboxRoot, WRITE_SANDBOX_MARKER),
      `${JSON.stringify({ disposable: false })}\n`,
      "utf8",
    );

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: sandboxRoot,
      }),
    ).rejects.toThrow(/disposable: true/);
  });

  it("rejects Microdent-Legacy as DATA_ROOT", async () => {
    const backupFolder = await setupBackupSource();

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: FORBIDDEN_LEGACY_ROOT,
      }),
    ).rejects.toThrow(/Microdent-Legacy/);
  });

  it("rejects Microdent-Legacy-Copy as DATA_ROOT", async () => {
    const backupFolder = await setupBackupSource();

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: FORBIDDEN_LEGACY_COPY_ROOT,
      }),
    ).rejects.toThrow(/Microdent-Legacy-Copy/);
  });

  it("rejects missing manifest.json", async () => {
    const backupFolder = await setupBackupSource();
    await setupSandbox();
    const manifestPath = join(backupFolder, "manifest.json");
    await unlink(manifestPath);

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: sandboxRoot,
      }),
    ).rejects.toThrow(/manifest\.json not found/);
  });

  it("does not print row payloads in CLI report output", async () => {
    const backupFolder = await setupBackupSource();
    await setupSandbox();

    const result = await runLegacyRestore({
      backupFolder,
      dataRoot: sandboxRoot,
    });

    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      printLegacyRestoreReport(result);
    } finally {
      console.log = log;
    }

    const report = lines.join("\n");
    expect(report).not.toContain(SECRET_COMMENT);
    expect(report).not.toContain(SECRET_NAME);
    expect(report).toContain("status=restored");
  });

  it("rejects relative dataRoot", async () => {
    const backupFolder = await setupBackupSource();

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: "relative/DATA",
      }),
    ).rejects.toThrow(/absolute path/);
  });

  it("rejects empty manifest files array", async () => {
    const backupFolder = await setupBackupSource();
    await setupSandbox();

    await writeFile(
      join(backupFolder, "manifest.json"),
      `${JSON.stringify({
        operationId: "00000000000000000000000000000000",
        workflow: "appointment.statusUpdate",
        createdAt: new Date().toISOString(),
        dataRootRealpath: sandboxRoot,
        files: [],
      })}\n`,
      "utf8",
    );

    await expect(
      runLegacyRestore({
        backupFolder,
        dataRoot: sandboxRoot,
      }),
    ).rejects.toThrow(/files array is empty/);
  });
});
