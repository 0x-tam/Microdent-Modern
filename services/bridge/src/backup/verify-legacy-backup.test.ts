import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runLegacyBackup } from "./run-legacy-backup.js";
import {
  printLegacyBackupVerifyReport,
  verifyLegacyBackup,
} from "./verify-legacy-backup.js";
import { writeScheduleFixtures } from "../test-fixtures/schedule-fixtures.js";

const SECRET_COMMENT = "SYNTHETIC_COMMENT_TOKEN_XX";
const SECRET_NAME = "SYNTHETIC_NAME_TOKEN_YY";

function captureConsoleLog(fn: () => void): string {
  const lines: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = log;
  }
  return lines.join("\n");
}

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
    expect(manifestRaw).not.toContain(SECRET_COMMENT);
    expect(manifestRaw).not.toContain(SECRET_NAME);

    const report = captureConsoleLog(() => printLegacyBackupVerifyReport(result));
    expect(report).toContain("backup-verify: ok");
    expect(report).not.toContain(SECRET_COMMENT);
    expect(report).not.toContain(SECRET_NAME);
    expect(report).not.toMatch(/\bPAT_NAME\b/);
    expect(report).not.toMatch(/\bTELEPHONE\b/);
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

    let errorMessage = "";
    try {
      await verifyLegacyBackup({ backupFolder: backup.backupFolder });
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }
    expect(errorMessage).toMatch(/mismatch for SCHEDULE\.DBF/);
    expect(errorMessage).not.toContain(SECRET_COMMENT);
    expect(errorMessage).not.toContain(SECRET_NAME);
    expect(errorMessage).not.toMatch(/\bPAT_NAME\b/);
    expect(errorMessage).not.toMatch(/\bTELEPHONE\b/);
  });
});
