export {
  containsForbiddenWriteResultToken,
  FORBIDDEN_WRITE_RESULT_TOKENS,
  summarizeWritePlan,
  type WritePlanResultSummary,
} from "./safe-write-plan-display.js";

function isViteDevBuild(): boolean {
  const meta = import.meta as unknown as { env?: { DEV?: boolean } };
  return meta.env?.DEV === true;
}

/** Dev-only write diagnostics UI: requires Vite dev build and an explicit host flag. */
export function isAppointmentStatusWriteActionsVisible(enabled: boolean): boolean {
  return isViteDevBuild() && enabled;
}

/** @deprecated Use {@link isAppointmentStatusWriteActionsVisible}. */
export const isAppointmentStatusDryRunVisible = isAppointmentStatusWriteActionsVisible;

/** Synthetic next status for rehearsal — never applied locally. */
export function proposedDryRunStatus(current: number): number {
  if (current >= 1 && current < 5) return current + 1;
  return 1;
}

export function dryRunRouteUnavailableMessage(status?: number): string {
  if (status === 404) {
    return "Status route is not available on this bridge yet.";
  }
  if (status === 403) {
    return "Writes are disabled on this bridge.";
  }
  return "Status request failed. Check bridge logs in dev.";
}
