import { randomUUID } from "node:crypto";
import type { SafeWritePlan, WriteMode } from "@microdent/contracts";

export const APPOINTMENT_CREATE_WORKFLOW = "appointment.create";

export function buildAppointmentCreatePlan(input: {
  appointmentId: string;
  writeMode: Extract<WriteMode, "dry-run" | "enabled">;
  committed?: boolean;
  operationId?: string;
}): SafeWritePlan {
  const committed = input.committed ?? false;

  return {
    operationId: input.operationId ?? randomUUID(),
    workflow: APPOINTMENT_CREATE_WORKFLOW,
    mode: input.writeMode,
    tablesAffected: ["SCHEDULE"],
    recordIds: [input.appointmentId],
    fieldsChanged: [
      { table: "SCHEDULE", recordId: input.appointmentId, field: "ID", changeType: "set" },
      { table: "SCHEDULE", recordId: input.appointmentId, field: "DATE", changeType: "set" },
      { table: "SCHEDULE", recordId: input.appointmentId, field: "TIME", changeType: "set" },
      { table: "SCHEDULE", recordId: input.appointmentId, field: "ROOM", changeType: "set" },
      { table: "SCHEDULE", recordId: input.appointmentId, field: "DURATION", changeType: "set" },
      { table: "SCHEDULE", recordId: input.appointmentId, field: "PAT_ID", changeType: "set" },
      { table: "SCHEDULE", recordId: input.appointmentId, field: "STATUS", changeType: "set" },
    ],
    backupRequired: true,
    backupWouldCreate: true,
    warnings: [],
    committed,
    createdAt: new Date().toISOString(),
  };
}
