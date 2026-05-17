import { randomUUID } from "node:crypto";
import type { PatientDemographicsUpdateBody, SafeWritePlan } from "@microdent/contracts";
import type { BridgeConfig, DataRootSet } from "../config.js";
import { writePatientDemographics } from "../dbf/write-patient-demographics.js";
import { readPatientProfileFromDbf } from "../dbf/patient-profile.js";
import { runLegacyBackup } from "../backup/run-legacy-backup.js";
import { validateWritableSandbox, WriteSandboxError } from "../write-safety/index.js";
import {
  PATIENT_DEMOGRAPHICS_UPDATE_WORKFLOW,
  buildPatientDemographicsUpdatePlan,
} from "./patient-demographics-plan.js";
import {
  snapshotWorkflowFileFingerprints,
  verifyBackupManifestExists,
  verifyOnlyExpectedFilesChanged,
} from "./verify/index.js";
import { PostWriteVerificationError } from "./verify/post-write-error.js";

export type CommitPatientDemographicsInput = {
  bridgeConfig: BridgeConfig;
  dataRoot: DataRootSet;
  patientId: string;
  body: PatientDemographicsUpdateBody;
  allowLegacyWritesValue: string | undefined;
};

export type CommitPatientDemographicsResult =
  | { ok: true; plan: SafeWritePlan }
  | { ok: false; httpStatus: number; code: string; message: string };

function mapBodyToDbfFields(body: PatientDemographicsUpdateBody): string[] {
  const fields: string[] = [];
  if (body.firstName !== undefined) fields.push("FIRST_NAME");
  if (body.lastName !== undefined) fields.push("LAST_NAME");
  if (body.displayName !== undefined) fields.push("NAME");
  if (body.reverseName !== undefined) fields.push("REV_NAME");
  if (body.chartNumber !== undefined) fields.push("CASENB");
  if (body.active !== undefined) fields.push("ACTIVE");
  if (body.doctorId !== undefined) fields.push("DOCTOR_NB");
  return fields;
}

export async function commitPatientDemographicsUpdate(
  input: CommitPatientDemographicsInput,
): Promise<CommitPatientDemographicsResult> {
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

  const before = await readPatientProfileFromDbf(input.dataRoot, input.patientId);
  if (before.kind === "not_found") {
    return {
      ok: false,
      httpStatus: 404,
      code: "PATIENT_NOT_FOUND",
      message: "patient not found",
    };
  }
  if (before.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "PATIENT_READ_ERROR",
      message: "failed to read patient before write",
    };
  }

  const fieldsForPlan = mapBodyToDbfFields(input.body);
  const operationId = randomUUID();

  let baseline;
  try {
    baseline = await snapshotWorkflowFileFingerprints({
      dataRoot: input.dataRoot,
      workflow: PATIENT_DEMOGRAPHICS_UPDATE_WORKFLOW,
    });
  } catch {
    return {
      ok: false,
      httpStatus: 500,
      code: "PATIENT_READ_ERROR",
      message: "failed to prepare write",
    };
  }

  try {
    const backup = await runLegacyBackup({
      dataRoot: input.dataRoot.path,
      backupDir: input.bridgeConfig.backupDir.path,
      workflow: PATIENT_DEMOGRAPHICS_UPDATE_WORKFLOW,
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
      message: "backup failed; PATIENT was not modified",
    };
  }

  const writeOutcome = await writePatientDemographics(input.dataRoot, input.patientId, input.body);
  if (writeOutcome.kind === "not_found") {
    return {
      ok: false,
      httpStatus: 404,
      code: "PATIENT_NOT_FOUND",
      message: "patient not found",
    };
  }
  if (writeOutcome.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "PATIENT_WRITE_FAILED",
      message: "failed to write patient demographics",
    };
  }

  try {
    await verifyOnlyExpectedFilesChanged({
      dataRoot: input.dataRoot,
      workflow: PATIENT_DEMOGRAPHICS_UPDATE_WORKFLOW,
      baseline,
      expectedChangedFiles: ["PATIENT.DBF"],
    });
  } catch (err) {
    void err;
    return {
      ok: false,
      httpStatus: 500,
      code: "PATIENT_WRITE_VERIFY_FAILED",
      message: "post-write verification failed",
    };
  }

  const plan = buildPatientDemographicsUpdatePlan({
    patientId: input.patientId,
    writeMode: "enabled",
    fieldsWritten: writeOutcome.fieldsWritten,
    committed: true,
    operationId,
  });

  return { ok: true, plan };
}

export async function validatePatientDemographicsDryRun(
  dataRoot: DataRootSet,
  patientId: string,
  body: PatientDemographicsUpdateBody,
): Promise<CommitPatientDemographicsResult> {
  const before = await readPatientProfileFromDbf(dataRoot, patientId);
  if (before.kind === "not_found") {
    return {
      ok: false,
      httpStatus: 404,
      code: "PATIENT_NOT_FOUND",
      message: "patient not found",
    };
  }
  if (before.kind !== "ok") {
    return {
      ok: false,
      httpStatus: 500,
      code: "PATIENT_READ_ERROR",
      message: "failed to read patient",
    };
  }

  return {
    ok: true,
    plan: buildPatientDemographicsUpdatePlan({
      patientId,
      writeMode: "dry-run",
      fieldsWritten: mapBodyToDbfFields(body),
    }),
  };
}
