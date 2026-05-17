import { randomUUID } from "node:crypto";
import type { AppointmentTimeMoveBody, SafeWritePlan } from "@microdent/contracts";
import type { BridgeConfig, DataRootSet } from "../config.js";
import { writeScheduleAppointmentTimeMove } from "../dbf/write-schedule-time-move.js";
import {
  listScheduleRowsForConflictCheck,
  readScheduleRowInternal,
} from "../dbf/read-schedule-row-internal.js";
import { runLegacyBackup } from "../backup/run-legacy-backup.js";
import { validateWritableSandbox, WriteSandboxError } from "../write-safety/index.js";
import {
  APPOINTMENT_TIME_MOVE_WORKFLOW,
  buildAppointmentTimeMovePlan,
} from "./appointment-time-move-plan.js";
import {
  detectScheduleConflict,
  validateScheduleRoom,
} from "../schedule/schedule-write-validation.js";
import { normalizeScheduleTimeHm } from "../schedule/schedule-time-utils.js";
import {
  snapshotWorkflowFileFingerprints,
  verifyBackupManifestExists,
  verifyOnlyExpectedFilesChanged,
} from "./verify/index.js";
import { PostWriteVerificationError } from "./verify/post-write-error.js";

export type CommitAppointmentTimeMoveInput = {
  bridgeConfig: BridgeConfig;
  dataRoot: DataRootSet;
  appointmentId: string;
  body: AppointmentTimeMoveBody;
  allowLegacyWritesValue: string | undefined;
};

export type CommitAppointmentTimeMoveResult =
  | { ok: true; plan: SafeWritePlan }
  | { ok: false; httpStatus: number; code: string; message: string };

export async function commitAppointmentTimeMove(
  input: CommitAppointmentTimeMoveInput,
): Promise<CommitAppointmentTimeMoveResult> {
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

  const normalizedTime = normalizeScheduleTimeHm(input.body.time);
  if (normalizedTime === null) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_SCHEDULE_TIME",
      message: "time must be a valid HH:MM value",
    };
  }

  const existingRow = await readScheduleRowInternal(input.dataRoot, input.appointmentId);
  if (existingRow.kind === "not_found") {
    return {
      ok: false,
      httpStatus: 404,
      code: "SCHEDULE_APPOINTMENT_NOT_FOUND",
      message: "appointment not found",
    };
  }
  if (existingRow.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to read appointment",
    };
  }

  const roomOk = await validateScheduleRoom(input.dataRoot, input.body.room, input.body.date);
  if (!roomOk) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_ROOM",
      message: "room is not active for the appointment date",
    };
  }

  const durationSlots = input.body.durationSlots ?? existingRow.row.durationSlots;
  const list = await listScheduleRowsForConflictCheck(input.dataRoot, input.body.date, input.body.date);
  if (list.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to read schedule for conflict check",
    };
  }

  if (
    detectScheduleConflict({
      candidateId: input.appointmentId,
      date: input.body.date,
      time: normalizedTime,
      room: input.body.room,
      durationSlots,
      periodMinutes: existingRow.row.periodMinutes,
      existing: list.rows,
    })
  ) {
    return {
      ok: false,
      httpStatus: 409,
      code: "SCHEDULE_CONFLICT",
      message: "appointment overlaps another booking in the same room",
    };
  }

  const operationId = randomUUID();
  const fieldsChanged: Array<{ field: string; changeType: "set" }> = [
    { field: "DATE", changeType: "set" },
    { field: "TIME", changeType: "set" },
    { field: "ROOM", changeType: "set" },
  ];
  if (input.body.durationSlots !== undefined) {
    fieldsChanged.push({ field: "DURATION", changeType: "set" });
  }

  let baseline;
  try {
    baseline = await snapshotWorkflowFileFingerprints({
      dataRoot: input.dataRoot,
      workflow: APPOINTMENT_TIME_MOVE_WORKFLOW,
    });
  } catch {
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
      workflow: APPOINTMENT_TIME_MOVE_WORKFLOW,
    });
    backupOperationId = backup.operationId;
    await verifyBackupManifestExists({
      backupDir: input.bridgeConfig.backupDir.path,
      operationId: backup.operationId,
    });
  } catch {
    return {
      ok: false,
      httpStatus: 503,
      code: "WRITE_BACKUP_FAILED",
      message: "backup failed; SCHEDULE was not modified",
    };
  }

  const writeOutcome = await writeScheduleAppointmentTimeMove(input.dataRoot, input.appointmentId, {
    date: input.body.date,
    time: normalizedTime,
    room: input.body.room,
    durationSlots: input.body.durationSlots,
  });
  if (writeOutcome.kind === "not_found") {
    return {
      ok: false,
      httpStatus: 404,
      code: "SCHEDULE_APPOINTMENT_NOT_FOUND",
      message: "appointment not found",
    };
  }
  if (writeOutcome.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_TIME_WRITE_FAILED",
      message: "failed to write appointment time move",
    };
  }

  try {
    await verifyOnlyExpectedFilesChanged({
      dataRoot: input.dataRoot,
      workflow: APPOINTMENT_TIME_MOVE_WORKFLOW,
      baseline,
      expectedChangedFiles: ["SCHEDULE.DBF"],
    });
  } catch (err) {
    const code =
      err instanceof PostWriteVerificationError ? err.code : "SCHEDULE_TIME_VERIFY_FAILED";
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_TIME_VERIFY_FAILED",
      message: "post-write verification failed",
    };
  }

  void backupOperationId;

  const plan = buildAppointmentTimeMovePlan({
    appointmentId: input.appointmentId,
    writeMode: "enabled",
    fields: fieldsChanged,
    committed: true,
    operationId,
  });

  return { ok: true, plan };
}

export async function validateAppointmentTimeMoveDryRun(
  dataRoot: DataRootSet,
  appointmentId: string,
  body: AppointmentTimeMoveBody,
): Promise<CommitAppointmentTimeMoveResult> {
  const normalizedTime = normalizeScheduleTimeHm(body.time);
  if (normalizedTime === null) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_SCHEDULE_TIME",
      message: "time must be a valid HH:MM value",
    };
  }

  const existingRow = await readScheduleRowInternal(dataRoot, appointmentId);
  if (existingRow.kind === "not_found") {
    return {
      ok: false,
      httpStatus: 404,
      code: "SCHEDULE_APPOINTMENT_NOT_FOUND",
      message: "appointment not found",
    };
  }
  if (existingRow.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to read appointment",
    };
  }

  const roomOk = await validateScheduleRoom(dataRoot, body.room, body.date);
  if (!roomOk) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_ROOM",
      message: "room is not active for the appointment date",
    };
  }

  const durationSlots = body.durationSlots ?? existingRow.row.durationSlots;
  const list = await listScheduleRowsForConflictCheck(dataRoot, body.date, body.date);
  if (list.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to read schedule for conflict check",
    };
  }

  if (
    detectScheduleConflict({
      candidateId: appointmentId,
      date: body.date,
      time: normalizedTime,
      room: body.room,
      durationSlots,
      periodMinutes: existingRow.row.periodMinutes,
      existing: list.rows,
    })
  ) {
    return {
      ok: false,
      httpStatus: 409,
      code: "SCHEDULE_CONFLICT",
      message: "appointment overlaps another booking in the same room",
    };
  }

  const fields: Array<{ field: string; changeType: "set" }> = [
    { field: "DATE", changeType: "set" },
    { field: "TIME", changeType: "set" },
    { field: "ROOM", changeType: "set" },
  ];
  if (body.durationSlots !== undefined) {
    fields.push({ field: "DURATION", changeType: "set" });
  }

  return {
    ok: true,
    plan: buildAppointmentTimeMovePlan({
      appointmentId,
      writeMode: "dry-run",
      fields,
    }),
  };
}
