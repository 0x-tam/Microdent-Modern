export const APPOINTMENT_TIME_MOVE_WRITE_CONFIRM =
  "Move this appointment in the disposable sandbox? A backup runs first. Only use on test data you can restore.";

export const SCHEDULE_CONFLICT_SAFE_MESSAGE =
  "That date, time, and room combination is not available. Choose a different slot.";

export function appointmentTimeMoveWriteUnavailableMessage(
  status?: number,
  apiCode?: string,
): string {
  if (status === 409 && apiCode === "SCHEDULE_CONFLICT") {
    return SCHEDULE_CONFLICT_SAFE_MESSAGE;
  }
  if (status === 403) {
    return "Sandbox writes are not enabled on this bridge.";
  }
  if (status === 503) {
    return "Write backup is not configured on this bridge.";
  }
  return "Time move failed. Check bridge configuration.";
}
