import { randomUUID } from "node:crypto";
import type { SafeWritePlan, SafeWritePlanWarning, WriteMode } from "@microdent/contracts";

export const APPOINTMENT_STATUS_UPDATE_WORKFLOW = "appointment.statusUpdate";

export function buildAppointmentStatusUpdatePlan(input: {
  appointmentId: string;
  writeMode: Extract<WriteMode, "dry-run" | "enabled">;
}): SafeWritePlan {
  const warnings: SafeWritePlanWarning[] = [];
  if (input.writeMode === "enabled") {
    warnings.push({
      code: "REAL_WRITE_NOT_IMPLEMENTED",
      message: "WRITE_MODE=enabled does not commit DBF changes yet; this response is still a dry-run plan only",
      severity: "warn",
    });
  }

  return {
    operationId: randomUUID(),
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
    warnings,
    committed: false,
    createdAt: new Date().toISOString(),
  };
}
