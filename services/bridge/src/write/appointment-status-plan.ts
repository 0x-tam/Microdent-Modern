import { randomUUID } from "node:crypto";
import type { SafeWritePlan, WriteMode } from "@microdent/contracts";

export const APPOINTMENT_STATUS_UPDATE_WORKFLOW = "appointment.statusUpdate";

export function buildAppointmentStatusUpdatePlan(input: {
  appointmentId: string;
  writeMode: Extract<WriteMode, "dry-run" | "enabled">;
  committed?: boolean;
  operationId?: string;
}): SafeWritePlan {
  const committed = input.committed ?? false;

  return {
    operationId: input.operationId ?? randomUUID(),
    workflow: APPOINTMENT_STATUS_UPDATE_WORKFLOW,
    mode: input.writeMode,
    tablesAffected: ["SCHEDULE"],
    recordIds: [input.appointmentId],
    fieldsChanged: [
      {
        table: "SCHEDULE",
        recordId: input.appointmentId,
        field: "STATUS",
        changeType: "set",
      },
    ],
    backupRequired: true,
    backupWouldCreate: true,
    warnings: [],
    committed,
    createdAt: new Date().toISOString(),
  };
}
