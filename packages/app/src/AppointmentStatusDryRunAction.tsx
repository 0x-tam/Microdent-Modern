import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useState } from "react";
import { Button } from "@microdent/ui";
import {
  dryRunRouteUnavailableMessage,
  isAppointmentStatusDryRunVisible,
  proposedDryRunStatus,
  summarizeDryRunPlan,
  type DryRunPlanSummary,
} from "./appointment-status-dry-run.js";

export type AppointmentStatusDryRunActionProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  /** Host enables dev dry-run UI (still requires `import.meta.env.DEV`). */
  devDryRunEnabled: boolean;
};

type DryRunUiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "plan"; summary: DryRunPlanSummary }
  | { kind: "error"; message: string };

export function AppointmentStatusDryRunAction({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  devDryRunEnabled,
}: AppointmentStatusDryRunActionProps) {
  const [state, setState] = useState<DryRunUiState>({ kind: "idle" });

  const runDryRun = useCallback(async () => {
    setState({ kind: "loading" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    const status = proposedDryRunStatus(appointment.status);
    try {
      const plan = await client.dryRunAppointmentStatusUpdate(appointment.id, { status });
      setState({ kind: "plan", summary: summarizeDryRunPlan(plan) });
    } catch (err) {
      if (err instanceof BridgeClientError) {
        setState({
          kind: "error",
          message: dryRunRouteUnavailableMessage(err.status),
        });
        return;
      }
      setState({ kind: "error", message: dryRunRouteUnavailableMessage() });
    }
  }, [appointment.id, appointment.status, bridgeBaseUrl, fetchImpl]);

  if (!isAppointmentStatusDryRunVisible(devDryRunEnabled)) {
    return null;
  }

  return (
    <div className="app-appt-dry-run">
      <Button
        type="button"
        variant="ghost"
        className="ui-focusable app-appt-dry-run__btn"
        disabled={state.kind === "loading"}
        onClick={() => void runDryRun()}
        aria-label={`Dry-run status update for appointment ${appointment.id}`}
      >
        {state.kind === "loading" ? "Dry-run…" : "Dry-run status update"}
      </Button>
      {state.kind === "plan" ? (
        <dl className="app-appt-dry-run__summary" aria-label="Safe write plan summary">
          <div className="app-appt-dry-run__row">
            <dt>Workflow</dt>
            <dd>{state.summary.workflow}</dd>
          </div>
          <div className="app-appt-dry-run__row">
            <dt>Table</dt>
            <dd>{state.summary.table}</dd>
          </div>
          <div className="app-appt-dry-run__row">
            <dt>Record id</dt>
            <dd>{state.summary.recordId}</dd>
          </div>
          <div className="app-appt-dry-run__row">
            <dt>Field changed</dt>
            <dd>{state.summary.field}</dd>
          </div>
          <div className="app-appt-dry-run__row">
            <dt>Committed</dt>
            <dd>{String(state.summary.committed)}</dd>
          </div>
        </dl>
      ) : null}
      {state.kind === "error" ? (
        <p className="app-appt-dry-run__error" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
