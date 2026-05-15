import type { SafeWritePlan } from "@microdent/contracts";

function isViteDevBuild(): boolean {
  const meta = import.meta as unknown as { env?: { DEV?: boolean } };
  return meta.env?.DEV === true;
}

/** Dev-only dry-run control: requires Vite dev build and an explicit host flag. */
export function isAppointmentStatusDryRunVisible(enabled: boolean): boolean {
  return isViteDevBuild() && enabled;
}

/** Synthetic next status for rehearsal — never applied locally. */
export function proposedDryRunStatus(current: number): number {
  if (current >= 1 && current < 5) return current + 1;
  return 1;
}

export type DryRunPlanSummary = {
  workflow: string;
  table: string;
  recordId: string;
  field: string;
  committed: false;
};

export function summarizeDryRunPlan(plan: SafeWritePlan): DryRunPlanSummary {
  const firstChange = plan.fieldsChanged[0];
  return {
    workflow: plan.workflow,
    table: firstChange?.table ?? plan.tablesAffected[0] ?? "—",
    recordId: firstChange?.recordId ?? plan.recordIds[0] ?? "—",
    field: firstChange?.field ?? "—",
    committed: false,
  };
}

export function dryRunRouteUnavailableMessage(status?: number): string {
  if (status === 404) {
    return "Dry-run route is not available on this bridge yet.";
  }
  if (status === 403) {
    return "Writes are disabled on this bridge (dry-run not enabled).";
  }
  return "Dry-run request failed. Check bridge logs in dev.";
}
