import { randomUUID } from "node:crypto";
import type { SafeWritePlan } from "@microdent/contracts";
import type { BridgeConfig, DataRootSet } from "../config.js";
import { writeScheduleAppointmentStatus } from "../dbf/write-schedule-status.js";
import { runLegacyBackup } from "../backup/run-legacy-backup.js";
import { validateWritableSandbox, WriteSandboxError } from "../write-safety/index.js";
import {
  APPOINTMENT_STATUS_UPDATE_WORKFLOW,
  buildAppointmentStatusUpdatePlan,
} from "./appointment-status-plan.js";
import { tryRecordAppointmentStatusAudit } from "./appointment-status-audit.js";
import {
  PostWriteVerificationError,
  readScheduleAppointmentStatus,
  snapshotWorkflowFileFingerprints,
  verifyAppointmentStatusChanged,
  verifyBackupManifestExists,
  verifyOnlyExpectedFilesChanged,
} from "./verify/index.js";

export type CommitAppointmentStatusInput = {
  bridgeConfig: BridgeConfig;
  dataRoot: DataRootSet;
  appointmentId: string;
  status: number;
  allowLegacyWritesValue: string | undefined;
};

export type CommitAppointmentStatusResult =
  | { ok: true; plan: SafeWritePlan }
  | { ok: false; httpStatus: number; code: string; message: string };

export async function commitAppointmentStatusUpdate(
  input: CommitAppointmentStatusInput,
): Promise<CommitAppointmentStatusResult> {
  try {
    validateWritableSandbox({
      dataRoot: input.dataRoot.path,
      writeMode: "enabled",
      allowLegacyWritesValue: input.allowLegacyWritesValue,
    });
  } catch (err) {
    if (err instanceof WriteSandboxError) {
      return { ok: false, httpStatus: 403, code: err.code, message: err.message };
    }
    throw err;
  }

  if (!input.bridgeConfig.backupDir.configured) {
    return {
      ok: false,
      httpStatus: 503,
      code: "WRITE_BACKUP_NOT_CONFIGURED",
      message: "BACKUP_DIR is not configured",
    };
  }

  const operationId = randomUUID();
  const audit = tryRecordAppointmentStatusAudit(input.bridgeConfig, {
    operationId,
    appointmentId: input.appointmentId,
    executionMode: "real_write",
  });

  const before = await readScheduleAppointmentStatus(input.dataRoot, input.appointmentId);
  if (before.kind === "not_found") {
    audit?.onFailed("SCHEDULE_APPOINTMENT_NOT_FOUND", "appointment not found before write");
    return {
      ok: false,
      httpStatus: 404,
      code: "SCHEDULE_APPOINTMENT_NOT_FOUND",
      message: "appointment not found",
    };
  }
  if (before.kind !== "ok") {
    audit?.onFailed("SCHEDULE_APPOINTMENTS_ERROR", "failed to read appointment status before write");
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to read appointment status",
    };
  }

  if (before.status === input.status) {
    audit?.onFailed("SCHEDULE_STATUS_UNCHANGED", "requested status matches current status");
    return {
      ok: false,
      httpStatus: 400,
      code: "SCHEDULE_STATUS_UNCHANGED",
      message: "appointment status is already the requested value",
    };
  }

  let baseline;
  try {
    baseline = await snapshotWorkflowFileFingerprints({
      dataRoot: input.dataRoot,
      workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    });
  } catch (err) {
    audit?.onFailed("SCHEDULE_APPOINTMENTS_ERROR", "failed to snapshot workflow files before write");
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to prepare write",
    };
  }

  let backupOperationId: string;
  try {
    const backup = await runLegacyBackup({
      dataRoot: input.dataRoot.path,
      backupDir: input.bridgeConfig.backupDir.path,
      workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    });
    backupOperationId = backup.operationId;
    audit?.onBackupCreated(backup.operationId);
    await verifyBackupManifestExists({
      backupDir: input.bridgeConfig.backupDir.path,
      operationId: backup.operationId,
    });
  } catch {
    audit?.onFailed("WRITE_BACKUP_FAILED", "legacy backup failed before write");
    return {
      ok: false,
      httpStatus: 503,
      code: "WRITE_BACKUP_FAILED",
      message: "backup failed; SCHEDULE was not modified",
    };
  }

  audit?.onWriteStarted();

  const writeOutcome = await writeScheduleAppointmentStatus(
    input.dataRoot,
    input.appointmentId,
    input.status,
  );
  if (writeOutcome.kind === "not_found") {
    audit?.onFailed("SCHEDULE_APPOINTMENT_NOT_FOUND", "appointment not found during write");
    return {
      ok: false,
      httpStatus: 404,
      code: "SCHEDULE_APPOINTMENT_NOT_FOUND",
      message: "appointment not found",
    };
  }
  if (writeOutcome.kind !== "ok") {
    audit?.onFailed("SCHEDULE_STATUS_WRITE_FAILED", "failed to write SCHEDULE.STATUS");
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_STATUS_WRITE_FAILED",
      message: "failed to write appointment status",
    };
  }

  try {
    await verifyAppointmentStatusChanged({
      dataRoot: input.dataRoot,
      appointmentId: input.appointmentId,
      expectedStatus: input.status,
    });
    await verifyOnlyExpectedFilesChanged({
      dataRoot: input.dataRoot,
      workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
      baseline,
      expectedChangedFiles: ["SCHEDULE.DBF"],
    });
  } catch (err) {
    const code =
      err instanceof PostWriteVerificationError ? err.code : "SCHEDULE_STATUS_VERIFY_FAILED";
    audit?.onFailed(code, "post-write verification failed");
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_STATUS_VERIFY_FAILED",
      message: "post-write verification failed",
    };
  }

  audit?.onSuccess(backupOperationId);

  const plan = buildAppointmentStatusUpdatePlan({
    appointmentId: input.appointmentId,
    writeMode: "enabled",
    committed: true,
    operationId,
  });

  return { ok: true, plan };
}
