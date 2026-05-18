import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useState } from "react";
import { Button } from "@microdent/ui";
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_STATUS_WRITE_CONFIRM,
  appointmentStatusWriteUnavailableMessage,
  formatWriteOperationFeedbackLines,
  isAppointmentStatusWritePilotEnabled,
  isAppointmentStatusWriteReady,
} from "./appointment-status-write.js";
import { buildWriteOperationFeedback } from "./write-operation-feedback.js";
import { summarizeWritePlan } from "./appointment-status-dry-run.js";

export type AppointmentStatusWriteActionProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  /** Host enables pilot write UI (production builds stay read-only unless set). */
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  onCommitted?: () => void;
};

type WriteUiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; committed: boolean; mode: string; feedbackLines: string[] }
  | { kind: "error"; message: string };

export function AppointmentStatusWriteAction({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  onCommitted,
}: AppointmentStatusWriteActionProps) {
  const [nextStatus, setNextStatus] = useState(() => appointment.status);
  const [state, setState] = useState<WriteUiState>({ kind: "idle" });

  const runCommit = useCallback(async () => {
    if (nextStatus === appointment.status) {
      setState({ kind: "error", message: "Choose a different status before applying." });
      return;
    }
    if (!window.confirm(APPOINTMENT_STATUS_WRITE_CONFIRM)) {
      return;
    }

    setState({ kind: "loading" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.applyAppointmentStatusInSandbox(appointment.id, { status: nextStatus });
      const summary = summarizeWritePlan(plan);
      let audit = null;
      if (summary.committed) {
        try {
          audit = await client.getWriteAuditRecent();
        } catch {
          audit = null;
        }
      }
      const feedback = buildWriteOperationFeedback(plan, audit);
      const feedbackLines = formatWriteOperationFeedbackLines(feedback, audit);
      setState({
        kind: "result",
        committed: summary.committed,
        mode: summary.mode,
        feedbackLines,
      });
      if (summary.committed) {
        onCommitted?.();
      }
    } catch (err) {
      if (err instanceof BridgeClientError) {
        setState({
          kind: "error",
          message: appointmentStatusWriteUnavailableMessage(err.status),
        });
        return;
      }
      setState({ kind: "error", message: appointmentStatusWriteUnavailableMessage() });
    }
  }, [appointment.id, appointment.status, bridgeBaseUrl, fetchImpl, nextStatus, onCommitted]);

  if (!isAppointmentStatusWritePilotEnabled(writePilotEnabled)) {
    return null;
  }
  if (!writeCapability || !isAppointmentStatusWriteReady(writeCapability)) {
    return null;
  }

  const loading = state.kind === "loading";

  return (
    <div className="app-appt-status-write" data-testid="appt-status-write-pilot">
      <p className="app-appt-status-write__banner" role="status">
        Sandbox write mode — changes affect disposable data only.
      </p>
      <div className="app-appt-status-write__controls">
        <label className="app-appt-status-write__label">
          <span className="app-appt-status-write__label-text">New status</span>
          <select
            className="ui-focusable app-appt-status-write__select"
            value={nextStatus}
            disabled={loading}
            onChange={(e) => setNextStatus(Number(e.target.value))}
            aria-label={`New status for appointment ${appointment.id}`}
          >
            {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="danger"
          className="ui-focusable app-appt-status-write__btn"
          disabled={loading}
          onClick={() => void runCommit()}
        >
          {loading ? "Applying…" : "Apply status change"}
        </Button>
      </div>
      {state.kind === "result" ? (
        <div className="app-appt-status-write__result" role="status" data-committed={String(state.committed)}>
          <p className="app-appt-status-write__result-summary">
            {state.committed
              ? `Committed: true — status updated (${state.mode}).`
              : `Committed: false — dry-run plan only; nothing was saved (${state.mode}).`}
          </p>
          <ul className="app-appt-status-write__feedback" aria-label="Write operation feedback">
            {state.feedbackLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.kind === "error" ? (
        <p className="app-appt-status-write__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
