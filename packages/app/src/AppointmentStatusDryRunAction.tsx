import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useState } from "react";
import { Button } from "@microdent/ui";
import {
  dryRunRouteUnavailableMessage,
  isAppointmentStatusWriteActionsVisible,
  proposedDryRunStatus,
  summarizeWritePlan,
  type WritePlanResultSummary,
} from "./appointment-status-dry-run.js";

export type AppointmentStatusDryRunActionProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  /** Host enables dev write diagnostics actions (still requires `import.meta.env.DEV`). */
  writeDiagnosticsActions: boolean;
  /** From `GET /debug/status` — shows sandbox apply when disposable sandbox is ready. */
  sandboxApplyEnabled: boolean;
  /** Called after a committed apply so the schedule list can refresh. */
  onCommitted?: () => void;
};

type WriteActionUiState =
  | { kind: "idle" }
  | { kind: "loading"; action: "dry-run" | "sandbox" }
  | { kind: "result"; summary: WritePlanResultSummary }
  | { kind: "error"; message: string };

function WritePlanResultPanel({ summary }: { summary: WritePlanResultSummary }) {
  return (
    <dl className="app-appt-dry-run__summary" aria-label="Safe write plan summary">
      <div className="app-appt-dry-run__row">
        <dt>Workflow</dt>
        <dd>{summary.workflow}</dd>
      </div>
      <div className="app-appt-dry-run__row">
        <dt>Mode</dt>
        <dd>{summary.mode}</dd>
      </div>
      <div className="app-appt-dry-run__row">
        <dt>Committed</dt>
        <dd>{String(summary.committed)}</dd>
      </div>
      <div className="app-appt-dry-run__row">
        <dt>Table</dt>
        <dd>{summary.table}</dd>
      </div>
      <div className="app-appt-dry-run__row">
        <dt>Record id</dt>
        <dd>{summary.recordId}</dd>
      </div>
      <div className="app-appt-dry-run__row">
        <dt>Field changed</dt>
        <dd>{summary.field}</dd>
      </div>
      <div className="app-appt-dry-run__row">
        <dt>Warnings</dt>
        <dd>{summary.warnings.length > 0 ? summary.warnings.join(", ") : "—"}</dd>
      </div>
    </dl>
  );
}

export function AppointmentStatusDryRunAction({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  writeDiagnosticsActions,
  sandboxApplyEnabled,
  onCommitted,
}: AppointmentStatusDryRunActionProps) {
  const [state, setState] = useState<WriteActionUiState>({ kind: "idle" });

  const runPatch = useCallback(
    async (action: "dry-run" | "sandbox") => {
      setState({ kind: "loading", action });
      const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
      const status = proposedDryRunStatus(appointment.status);
      try {
        const plan =
          action === "dry-run"
            ? await client.dryRunAppointmentStatusUpdate(appointment.id, { status })
            : await client.applyAppointmentStatusInSandbox(appointment.id, { status });
        const summary = summarizeWritePlan(plan);
        setState({ kind: "result", summary });
        if (summary.committed) {
          onCommitted?.();
        }
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
    },
    [appointment.id, appointment.status, bridgeBaseUrl, fetchImpl, onCommitted],
  );

  if (!isAppointmentStatusWriteActionsVisible(writeDiagnosticsActions)) {
    return null;
  }

  const loading = state.kind === "loading";

  return (
    <div className="app-appt-dry-run" data-testid="appt-status-write-dev">
      <div className="app-appt-dry-run__actions" role="group" aria-label="Dev write diagnostics">
        <Button
          type="button"
          variant="ghost"
          className="ui-focusable app-appt-dry-run__btn"
          disabled={loading}
          onClick={() => void runPatch("dry-run")}
          aria-label={`Dry-run status for appointment ${appointment.id}`}
        >
          {state.kind === "loading" && state.action === "dry-run" ? "Dry-run…" : "Dry-run status"}
        </Button>
        {sandboxApplyEnabled ? (
          <Button
            type="button"
            variant="ghost"
            className="ui-focusable app-appt-dry-run__btn app-appt-dry-run__btn--sandbox"
            disabled={loading}
            onClick={() => void runPatch("sandbox")}
            aria-label={`Apply status in sandbox for appointment ${appointment.id}`}
          >
            {state.kind === "loading" && state.action === "sandbox"
              ? "Applying…"
              : "Apply status in sandbox"}
          </Button>
        ) : null}
      </div>
      {state.kind === "result" ? <WritePlanResultPanel summary={state.summary} /> : null}
      {state.kind === "error" ? (
        <p className="app-appt-dry-run__error" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
