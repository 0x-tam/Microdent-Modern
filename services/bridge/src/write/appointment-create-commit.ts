import { randomUUID } from "node:crypto";
import type { AppointmentCreateBody, SafeWritePlan } from "@microdent/contracts";
import type { BridgeConfig, DataRootSet } from "../config.js";
import { writeScheduleAppointmentCreate } from "../dbf/write-schedule-create.js";
import { listScheduleRowsForConflictCheck } from "../dbf/read-schedule-row-internal.js";
import { runLegacyBackup } from "../backup/run-legacy-backup.js";
import { validateWritableSandbox, WriteSandboxError } from "../write-safety/index.js";
import {
  APPOINTMENT_CREATE_WORKFLOW,
  buildAppointmentCreatePlan,
} from "./appointment-create-plan.js";
import {
  detectScheduleConflict,
  patientIdExistsInDbf,
  validateScheduleRoom,
} from "../schedule/schedule-write-validation.js";
import { normalizeScheduleTimeHm } from "../schedule/schedule-time-utils.js";
import {
  snapshotWorkflowFileFingerprints,
  verifyBackupManifestExists,
  verifyOnlyExpectedFilesChanged,
} from "./verify/index.js";
import { PostWriteVerificationError } from "./verify/post-write-error.js";
import { lookupScheduleAppointmentById } from "../dbf/schedule-appointments.js";

export type CommitAppointmentCreateInput = {
  bridgeConfig: BridgeConfig;
  dataRoot: DataRootSet;
  body: AppointmentCreateBody;
  allowLegacyWritesValue: string | undefined;
};

export type CommitAppointmentCreateResult =
  | { ok: true; plan: SafeWritePlan }
  | { ok: false; httpStatus: number; code: string; message: string };

type ValidateCreateOk = { ok: true; normalizedTime: string; periodMinutes: number };

type ValidateCreateResult = ValidateCreateOk | Extract<CommitAppointmentCreateResult, { ok: false }>;

async function validateCreateBody(
  dataRoot: DataRootSet,
  body: AppointmentCreateBody,
  candidateId: string | null,
): Promise<ValidateCreateResult> {
  const normalizedTime = normalizeScheduleTimeHm(body.time);
  if (normalizedTime === null) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_SCHEDULE_TIME",
      message: "time must be a valid HH:MM value",
    };
  }

  const patientOk = await patientIdExistsInDbf(dataRoot, body.patId);
  if (!patientOk) {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_PATIENT_ID",
      message: "patient id was not found",
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

  const periodMinutes = body.periodMinutes ?? 30;
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
      candidateId,
      date: body.date,
      time: normalizedTime,
      room: body.room,
      durationSlots: body.durationSlots,
      periodMinutes,
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

  return { ok: true, normalizedTime, periodMinutes };
}

export async function commitAppointmentCreate(
  input: CommitAppointmentCreateInput,
): Promise<CommitAppointmentCreateResult> {
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

  const validated = await validateCreateBody(input.dataRoot, input.body, null);
  if (!validated.ok) {
    return validated as CommitAppointmentCreateResult;
  }

  const operationId = randomUUID();

  let baseline;
  try {
    baseline = await snapshotWorkflowFileFingerprints({
      dataRoot: input.dataRoot,
      workflow: APPOINTMENT_CREATE_WORKFLOW,
    });
  } catch {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_APPOINTMENTS_ERROR",
      message: "failed to prepare write",
    };
  }

  try {
    const backup = await runLegacyBackup({
      dataRoot: input.dataRoot.path,
      backupDir: input.bridgeConfig.backupDir.path,
      workflow: APPOINTMENT_CREATE_WORKFLOW,
    });
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

  const writeOutcome = await writeScheduleAppointmentCreate(input.dataRoot, {
    date: input.body.date,
    time: validated.normalizedTime,
    room: input.body.room,
    durationSlots: input.body.durationSlots,
    patId: input.body.patId,
    docId: input.body.docId ?? 0,
    procClass: input.body.procClass ?? 0,
    periodMinutes: validated.periodMinutes,
    status: input.body.status ?? 1,
  });
  if (writeOutcome.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_CREATE_WRITE_FAILED",
      message: "failed to create appointment",
    };
  }

  const lookup = await lookupScheduleAppointmentById(input.dataRoot, writeOutcome.appointmentId);
  if (lookup.kind !== "found") {
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_CREATE_VERIFY_FAILED",
      message: "post-write verification failed",
    };
  }

  try {
    await verifyOnlyExpectedFilesChanged({
      dataRoot: input.dataRoot,
      workflow: APPOINTMENT_CREATE_WORKFLOW,
      baseline,
      expectedChangedFiles: ["SCHEDULE.DBF"],
    });
  } catch (err) {
    void err;
    return {
      ok: false,
      httpStatus: 500,
      code: "SCHEDULE_CREATE_VERIFY_FAILED",
      message: "post-write verification failed",
    };
  }

  const plan = buildAppointmentCreatePlan({
    appointmentId: writeOutcome.appointmentId,
    writeMode: "enabled",
    committed: true,
    operationId,
  });

  return { ok: true, plan };
}

export async function validateAppointmentCreateDryRun(
  dataRoot: DataRootSet,
  body: AppointmentCreateBody,
): Promise<CommitAppointmentCreateResult> {
  const validated = await validateCreateBody(dataRoot, body, null);
  if (!validated.ok) {
    return validated;
  }

  return {
    ok: true,
    plan: buildAppointmentCreatePlan({
      appointmentId: "0",
      writeMode: "dry-run",
    }),
  };
}
