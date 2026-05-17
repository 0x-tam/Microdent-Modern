import { randomUUID } from "node:crypto";
import type { SafeWritePlan, WriteMode } from "@microdent/contracts";

export const PATIENT_DEMOGRAPHICS_UPDATE_WORKFLOW = "patient.demographics.update";

export function buildPatientDemographicsUpdatePlan(input: {
  patientId: string;
  writeMode: Extract<WriteMode, "dry-run" | "enabled">;
  fieldsWritten: string[];
  committed?: boolean;
  operationId?: string;
}): SafeWritePlan {
  const committed = input.committed ?? false;

  return {
    operationId: input.operationId ?? randomUUID(),
    workflow: PATIENT_DEMOGRAPHICS_UPDATE_WORKFLOW,
    mode: input.writeMode,
    tablesAffected: ["PATIENT"],
    recordIds: [input.patientId],
    fieldsChanged: input.fieldsWritten.map((field) => ({
      table: "PATIENT",
      recordId: input.patientId,
      field,
      changeType: "set" as const,
    })),
    backupRequired: true,
    backupWouldCreate: true,
    warnings: [],
    committed,
    createdAt: new Date().toISOString(),
  };
}
