import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FORBIDDEN_LEGACY_ROOT } from "../write-safety/constants.js";
import { assertNotForbiddenLegacyPath, isPathUnderRoot } from "./forbidden-path.js";
import { runLegacyBackup } from "./run-legacy-backup.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";

const SECRET_COMMENT = "SYNTHETIC_COMMENT_TOKEN_XX";
const SECRET_NAME = "SYNTHETIC_NAME_TOKEN_YY";

async function fileSha256(absPath: string): Promise<string> {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

describe("legacy backup", () => {
  let dataRoot = "";
  let backupRoot = "";

  afterEach(() => {
    dataRoot = "";
    backupRoot = "";
  });

  async function setupDirs(): Promise<void> {
    dataRoot = await mkdtemp(join(tmpdir(), "microdent-backup-data-"));
    backupRoot = await mkdtemp(join(tmpdir(), "microdent-backup-out-"));
    await writeScheduleFixtures(dataRoot, { withPatientDbf: false });
    await writeFile(join(dataRoot, "SCHEDULE.FPT"), Buffer.from("synthetic-fpt"), "utf8");
    await writeFile(join(dataRoot, "SCHEDULE.CDX"), Buffer.from("synthetic-cdx"), "utf8");
  }

  it("copies SCHEDULE sidecars into a timestamped folder with manifest", async () => {
    await setupDirs();
    const scheduleBefore = await stat(join(dataRoot, "SCHEDULE.DBF"));

    const result = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });

    const scheduleAfter = await stat(join(dataRoot, "SCHEDULE.DBF"));
    expect(scheduleAfter.mtimeMs).toBe(scheduleBefore.mtimeMs);
    expect(scheduleAfter.size).toBe(scheduleBefore.size);

    expect(result.backupFolder.startsWith(backupRoot)).toBe(true);
    expect(result.manifest.workflow).toBe("appointment.statusUpdate");
    expect(result.manifest.dataRootRealpath).toBeTruthy();
    expect(result.manifest.files).toHaveLength(3);

    const manifestRaw = await readFile(join(result.backupFolder, "manifest.json"), "utf8");
    expect(manifestRaw).not.toContain(SECRET_COMMENT);
    expect(manifestRaw).not.toContain(SECRET_NAME);

    for (const entry of result.manifest.files) {
      const copied = join(result.backupFolder, "files", entry.filename);
      const copiedStat = await stat(copied);
      expect(copiedStat.size).toBe(entry.size);
      expect(await fileSha256(copied)).toBe(entry.sha256);
    }
  });

  it("backs up SCHEDULE.DBF only when sidecars are absent", async () => {
    dataRoot = await mkdtemp(join(tmpdir(), "microdent-backup-data-"));
    backupRoot = await mkdtemp(join(tmpdir(), "microdent-backup-out-"));
    await writeScheduleFixtures(dataRoot, { withPatientDbf: false });

    const result = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });

    expect(result.manifest.files.map((f) => f.filename)).toEqual(["SCHEDULE.DBF"]);
  });

  it("rejects unsupported workflows", async () => {
    await setupDirs();
    await expect(
      runLegacyBackup({
        dataRoot,
        backupDir: backupRoot,
        workflow: "patient.demographicsEdit",
      }),
    ).rejects.toThrow(/unsupported WORKFLOW/);
  });

  it("rejects missing required SCHEDULE.DBF", async () => {
    dataRoot = await mkdtemp(join(tmpdir(), "microdent-backup-data-"));
    backupRoot = await mkdtemp(join(tmpdir(), "microdent-backup-out-"));

    await expect(
      runLegacyBackup({
        dataRoot,
        backupDir: backupRoot,
        workflow: "appointment.statusUpdate",
      }),
    ).rejects.toThrow(/SCHEDULE\.DBF/);
  });

  it("rejects DATA_ROOT under Microdent-Legacy", async () => {
    expect(() => assertNotForbiddenLegacyPath(FORBIDDEN_LEGACY_ROOT, "DATA_ROOT")).toThrow(
      /Microdent-Legacy/,
    );
    expect(isPathUnderRoot(join(FORBIDDEN_LEGACY_ROOT, "DATA"), FORBIDDEN_LEGACY_ROOT)).toBe(true);
  });

  it("does not print row payloads in CLI report output", async () => {
    await setupDirs();
    const result = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });

    const lines = [
      `operationId: ${result.operationId}`,
      `workflow: ${result.manifest.workflow}`,
      `backupDir: ${result.backupFolder}`,
      `files: ${result.manifest.files.length}`,
    ];
    const report = lines.join("\n");
    expect(report).not.toContain(SECRET_COMMENT);
    expect(report).not.toContain(SECRET_NAME);
  });

  it("leaves source bytes unchanged after copy", async () => {
    await setupDirs();
    const sourcePath = join(dataRoot, "SCHEDULE.DBF");
    const beforeHash = await fileSha256(sourcePath);

    await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });

    expect(await fileSha256(sourcePath)).toBe(beforeHash);
  });

  it("rejects relative dataRoot in runLegacyBackup", async () => {
    backupRoot = await mkdtemp(join(tmpdir(), "microdent-backup-out-"));
    await expect(
      runLegacyBackup({
        dataRoot: "relative/DATA",
        backupDir: backupRoot,
        workflow: "appointment.statusUpdate",
      }),
    ).rejects.toThrow(/absolute path/);
  });
});
