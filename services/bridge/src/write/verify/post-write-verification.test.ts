import { unlink } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DBFFile, DELETED } from "dbffile";
import { afterEach, describe, expect, it } from "vitest";
import { runLegacyBackup } from "../../backup/run-legacy-backup.js";
import { scheduleFields, writeScheduleFixtures } from "../../test-fixtures/schedule-fixtures.js";
import { APPOINTMENT_STATUS_UPDATE_WORKFLOW } from "../appointment-status-plan.js";
import {
  PostWriteVerificationError,
  snapshotWorkflowFileFingerprints,
  verifyAppointmentStatusChanged,
  verifyBackupManifestExists,
  verifyOnlyExpectedFilesChanged,
} from "./index.js";

const SECRET_COMMENT = "SYNTHETIC_COMMENT_TOKEN_XX";
const SECRET_NAME = "SYNTHETIC_NAME_TOKEN_YY";
const SECRET_PHONE = "SYNTHETIC_PHONE_TOKEN_ZZ";

const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function strId(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "0";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  const s = String(v).trim();
  return s.length > 0 ? s : "0";
}

function assertNoPhiInError(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  expect(text).not.toContain(SECRET_COMMENT);
  expect(text).not.toContain(SECRET_NAME);
  expect(text).not.toContain(SECRET_PHONE);
}

/** Test-only: rewrite SCHEDULE.DBF with one row's STATUS updated (synthetic sandbox). */
async function setSyntheticAppointmentStatus(
  dataRoot: string,
  appointmentId: string,
  status: number,
): Promise<void> {
  const schedPath = join(dataRoot, "SCHEDULE.DBF");
  const dbf = await DBFFile.open(schedPath, OPEN_OPTIONS);
  const records: Record<string, unknown>[] = [];
  for await (const row of dbf) {
    if (row[DELETED]) continue;
    const rec = { ...(row as Record<string, unknown>) };
    if (strId(rec, "ID") === appointmentId) {
      rec.STATUS = status;
    }
    records.push(rec);
  }
  await unlink(schedPath);
  const sched = await DBFFile.create(schedPath, scheduleFields, {});
  await sched.appendRecords(records);
}

describe("post-write verification", () => {
  let dataRoot = "";
  let backupRoot = "";

  afterEach(() => {
    dataRoot = "";
    backupRoot = "";
  });

  async function setupDataRoot(): Promise<void> {
    dataRoot = await mkdtemp(join(tmpdir(), "microdent-post-write-data-"));
    backupRoot = await mkdtemp(join(tmpdir(), "microdent-post-write-backup-"));
    await writeScheduleFixtures(dataRoot, { withPatientDbf: false });
  }

  it("verifies appointment status changed after synthetic write", async () => {
    await setupDataRoot();
    await setSyntheticAppointmentStatus(dataRoot, "1001", 4);

    await expect(
      verifyAppointmentStatusChanged({
        dataRoot,
        appointmentId: "1001",
        expectedStatus: 4,
      }),
    ).resolves.toBeUndefined();
  });

  it("fails when appointment is missing", async () => {
    await setupDataRoot();

    await expect(
      verifyAppointmentStatusChanged({
        dataRoot,
        appointmentId: "99999",
        expectedStatus: 1,
      }),
    ).rejects.toMatchObject({
      code: "APPOINTMENT_NOT_FOUND",
    });
  });

  it("fails when status does not match expected", async () => {
    await setupDataRoot();
    await setSyntheticAppointmentStatus(dataRoot, "1001", 3);

    try {
      await verifyAppointmentStatusChanged({
        dataRoot,
        appointmentId: "1001",
        expectedStatus: 5,
      });
      expect.fail("expected status mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(PostWriteVerificationError);
      expect((error as PostWriteVerificationError).code).toBe("APPOINTMENT_STATUS_MISMATCH");
      assertNoPhiInError(error);
    }
  });

  it("does not include row values in thrown errors", async () => {
    await setupDataRoot();

    try {
      await verifyAppointmentStatusChanged({
        dataRoot,
        appointmentId: "1001",
        expectedStatus: 9,
      });
      expect.fail("expected mismatch");
    } catch (error) {
      assertNoPhiInError(error);
    }

    try {
      await verifyAppointmentStatusChanged({
        dataRoot,
        appointmentId: "1001",
        expectedStatus: 9,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      expect(text).not.toMatch(/PAT_NAME|TELEPHONE|COMMENT/);
    }
  });

  it("verifies backup manifest exists for operationId", async () => {
    await setupDataRoot();
    const result = await runLegacyBackup({
      dataRoot,
      backupDir: backupRoot,
      workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    });

    await expect(
      verifyBackupManifestExists({
        backupDir: backupRoot,
        operationId: result.operationId,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects missing backup manifest", async () => {
    await setupDataRoot();

    await expect(
      verifyBackupManifestExists({
        backupDir: backupRoot,
        operationId: "00000000000000000000000000000000",
      }),
    ).rejects.toMatchObject({
      code: "BACKUP_MANIFEST_NOT_FOUND",
    });
  });

  it("allows only expected workflow files to change", async () => {
    await setupDataRoot();
    const baseline = await snapshotWorkflowFileFingerprints({
      dataRoot,
      workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    });

    await setSyntheticAppointmentStatus(dataRoot, "1002", 5);

    await expect(
      verifyOnlyExpectedFilesChanged({
        dataRoot,
        workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
        baseline,
        expectedChangedFiles: ["SCHEDULE.DBF"],
      }),
    ).resolves.toBeUndefined();

    await verifyAppointmentStatusChanged({
      dataRoot,
      appointmentId: "1002",
      expectedStatus: 5,
    });
  });

  it("fails when an unexpected workflow file changes", async () => {
    await setupDataRoot();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(dataRoot, "SCHEDULE.FPT"), Buffer.from("synthetic-fpt-baseline"), "utf8");

    const baseline = await snapshotWorkflowFileFingerprints({
      dataRoot,
      workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    });

    await writeFile(join(dataRoot, "SCHEDULE.FPT"), Buffer.from("mutated-fpt-payload"), "utf8");

    await expect(
      verifyOnlyExpectedFilesChanged({
        dataRoot,
        workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
        baseline,
        expectedChangedFiles: ["SCHEDULE.DBF"],
      }),
    ).rejects.toMatchObject({
      code: "UNEXPECTED_FILE_CHANGED",
    });
  });
});
