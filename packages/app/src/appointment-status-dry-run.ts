import type { SafeWritePlan, SafeWritePlanWarning } from "@microdent/contracts";

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

export type WritePlanResultSummary = {
  workflow: string;
  mode: string;
  committed: boolean;
  table: string;
  recordId: string;
  field: string;
  warnings: readonly string[];
};

export function summarizeWritePlan(plan: SafeWritePlan): WritePlanResultSummary {
  const firstChange = plan.fieldsChanged[0];
  return {
    workflow: plan.workflow,
    mode: plan.mode,
    committed: plan.committed,
    table: firstChange?.table ?? plan.tablesAffected[0] ?? "—",
    recordId: firstChange?.recordId ?? plan.recordIds[0] ?? "—",
    field: firstChange?.field ?? "—",
    warnings: plan.warnings.map(formatWarningLabel),
  };
}

function formatWarningLabel(w: SafeWritePlanWarning): string {
  return `${w.code} (${w.severity})`;
}

/** Tokens that must never appear in the dev result panel (PHI / raw row leakage). */
export const FORBIDDEN_WRITE_RESULT_TOKENS = [
  "PAT_NAME",
  "TELEPHONE",
  "COMMENT",
  "rawRow",
  '"before"',
  '"after"',
] as const;

export function containsForbiddenWriteResultToken(text: string): boolean {
  return FORBIDDEN_WRITE_RESULT_TOKENS.some((token) => text.includes(token));
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
