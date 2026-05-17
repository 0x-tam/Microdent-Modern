import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runLegacyBackup } from "./run-legacy-backup.js";
import { verifyLegacyBackup } from "./verify-legacy-backup.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";

describe("verifyLegacyBackup", () => {
  it("passes for a fresh backup folder", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "microdent-verify-data-"));
    const backupRoot = await mkdtemp(join(tmpdir(), "microdent-verify-backup-"));
    await writeScheduleFixtures(dataRoot, { withPatientDbf: false });

    const backup = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });

    const result = await verifyLegacyBackup({ backupFolder: backup.backupFolder });
    expect(result.ok).toBe(true);
    expect(result.operationId).toBe(backup.operationId);
    expect(result.filesVerified).toBeGreaterThan(0);

    const manifestRaw = await readFile(join(backup.backupFolder, "manifest.json"), "utf8");
    expect(manifestRaw).not.toContain("PAT_NAME");
    expect(manifestRaw).not.toContain("TELEPHONE");
  });

  it("fails when copied file is tampered", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "microdent-verify-tamper-data-"));
    const backupRoot = await mkdtemp(join(tmpdir(), "microdent-verify-tamper-backup-"));
    await writeScheduleFixtures(dataRoot, { withPatientDbf: false });

    const backup = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: "appointment.statusUpdate",
    });

    const copiedPath = join(backup.backupFolder, "files", "SCHEDULE.DBF");
    const original = await readFile(copiedPath);
    await writeFile(copiedPath, Buffer.concat([original, Buffer.from("x")]));

    await expect(verifyLegacyBackup({ backupFolder: backup.backupFolder })).rejects.toThrow(
      /mismatch for SCHEDULE\.DBF/,
    );
  });
});
