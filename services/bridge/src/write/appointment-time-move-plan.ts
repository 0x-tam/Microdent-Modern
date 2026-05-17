import { randomUUID } from "node:crypto";
import type { SafeWritePlan, WriteMode } from "@microdent/contracts";

export const APPOINTMENT_TIME_MOVE_WORKFLOW = "appointment.timeMove";

export function buildAppointmentTimeMovePlan(input: {
  appointmentId: string;
  writeMode: Extract<WriteMode, "dry-run" | "enabled">;
  fields: Array<{ field: string; changeType: "set" }>;
  committed?: boolean;
  operationId?: string;
}): SafeWritePlan {
  const committed = input.committed ?? false;

  return {
    operationId: input.operationId ?? randomUUID(),
    workflow: APPOINTMENT_TIME_MOVE_WORKFLOW,
    mode: input.writeMode,
    tablesAffected: ["SCHEDULE"],
    recordIds: [input.appointmentId],
    fieldsChanged: input.fields.map((f) => ({
      table: "SCHEDULE",
      recordId: input.appointmentId,
      field: f.field,
      changeType: f.changeType,
    })),
    backupRequired: true,
    backupWouldCreate: true,
    warnings: [],
    committed,
    createdAt: new Date().toISOString(),
  };
}
