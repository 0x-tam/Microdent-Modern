import type { BridgeDevStatusResponse } from "@microdent/contracts";
import {
  containsForbiddenWriteResultToken,
  FORBIDDEN_WRITE_RESULT_TOKENS,
} from "./safe-write-plan-display.js";
import { isSandboxWritePilotEnabled, isSandboxWriteReady } from "./sandbox-write-pilot.js";

export { containsForbiddenWriteResultToken, FORBIDDEN_WRITE_RESULT_TOKENS };

/** @deprecated Use {@link isSandboxWritePilotEnabled}. */
export const isAppointmentStatusWritePilotEnabled = isSandboxWritePilotEnabled;

/** @deprecated Use {@link isSandboxWriteReady}. */
export const isAppointmentStatusWriteReady = isSandboxWriteReady;

export { isSandboxWritePilotEnabled, isSandboxWriteReady };

export const APPOINTMENT_STATUS_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0, label: "Available" },
  { value: 1, label: "Scheduled" },
  { value: 2, label: "Confirmed" },
  { value: 3, label: "Completed" },
  { value: 4, label: "Cancelled" },
  { value: 5, label: "No-show" },
] as const;

export const APPOINTMENT_STATUS_WRITE_CONFIRM =
  "Change appointment status in the disposable sandbox? A backup runs first. Only use on test data you can restore.";

export function appointmentStatusWriteUnavailableMessage(status?: number): string {
  if (status === 403) {
    return "Sandbox writes are not enabled on this bridge.";
  }
  if (status === 503) {
    return "Write backup is not configured on this bridge.";
  }
  return "Status change failed. Check bridge configuration.";
}

export {
  backupCreatedFromPlan,
  buildWriteOperationFeedback,
  formatWriteOperationFeedbackLines,
  resolveWriteAuditFeedback,
  type WriteOperationFeedback,
} from "./write-operation-feedback.js";
