import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useState } from "react";
import { Button } from "@microdent/ui";
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_STATUS_WRITE_CONFIRM,
  appointmentStatusWriteUnavailableMessage,
  formatWriteOperationFeedbackLines,
} from "./appointment-status-write.js";
import {
  APPOINTMENT_STATUS_APPLY_LABEL,
  APPOINTMENT_STATUS_PREVIEW_LABEL,
} from "./read-only-ui-copy.js";
import { isSandboxWritePilotEnabled, isSandboxWriteReady } from "./sandbox-write-pilot.js";
import {
  SafeWritePlanResult,
  SandboxWriteBanner,
  summarizeWritePlan,
  type WritePlanResultSummary,
} from "./safe-write-plan-display.js";
import { buildWriteOperationFeedback } from "./write-operation-feedback.js";

export type AppointmentStatusWriteActionProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  /** Host enables pilot write UI (production builds stay read-only unless set). */
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  /** When true, rendered inside {@link AppointmentWriteActionsPanel} (no outer chrome or banner). */
  embedded?: boolean;
  onCommitted?: () => void;
};

type WriteUiState =
  | { kind: "idle" }
  | { kind: "loading"; action: "preview" | "commit" }
  | { kind: "preview"; summary: WritePlanResultSummary }
  | { kind: "result"; committed: boolean; mode: string; feedbackLines: string[] }
  | { kind: "error"; message: string };

export function AppointmentStatusWriteAction({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  embedded = false,
  onCommitted,
}: AppointmentStatusWriteActionProps) {
  const [nextStatus, setNextStatus] = useState(() => appointment.status);
  const [state, setState] = useState<WriteUiState>({ kind: "idle" });

  const runPreview = useCallback(async () => {
    if (nextStatus === appointment.status) {
      setState({ kind: "error", message: "Choose a different status before preview." });
      return;
    }
    setState({ kind: "loading", action: "preview" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.dryRunAppointmentStatusUpdate(appointment.id, { status: nextStatus });
      setState({ kind: "preview", summary: summarizeWritePlan(plan) });
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
  }, [appointment.id, appointment.status, bridgeBaseUrl, fetchImpl, nextStatus]);

  const runCommit = useCallback(async () => {
    if (state.kind !== "preview") {
      setState({ kind: "error", message: "Preview the status change before applying." });
      return;
    }
    if (!window.confirm(APPOINTMENT_STATUS_WRITE_CONFIRM)) {
      return;
    }

    setState({ kind: "loading", action: "commit" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.applyAppointmentStatusInSandbox(appointment.id, { status: nextStatus });
      let audit = null;
      if (plan.committed) {
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
        committed: plan.committed,
        mode: plan.mode,
        feedbackLines,
      });
      if (plan.committed) {
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
  }, [appointment.id, bridgeBaseUrl, fetchImpl, nextStatus, onCommitted, state.kind]);

  if (!embedded) {
    if (!isSandboxWritePilotEnabled(writePilotEnabled)) {
      return null;
    }
    if (!writeCapability || !isSandboxWriteReady(writeCapability)) {
      return null;
    }
  }

  const loading = state.kind === "loading";
  const rootClass = embedded
    ? "app-appt-status-write app-appt-status-write--embedded"
    : "app-sandbox-write app-appt-status-write";

  return (
    <div className={rootClass} data-testid="appt-status-write-pilot">
      {!embedded ? <SandboxWriteBanner className="app-appt-status-write__banner" /> : null}
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
          variant="secondary"
          className="ui-focusable app-appt-status-write__btn"
          disabled={loading}
          onClick={() => void runPreview()}
        >
          {state.kind === "loading" && state.action === "preview"
            ? "Previewing…"
            : APPOINTMENT_STATUS_PREVIEW_LABEL}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="ui-focusable app-appt-status-write__btn"
          disabled={loading || state.kind !== "preview"}
          onClick={() => void runCommit()}
        >
          {state.kind === "loading" && state.action === "commit"
            ? "Applying…"
            : APPOINTMENT_STATUS_APPLY_LABEL}
        </Button>
      </div>
      {state.kind === "preview" ? (
        <SafeWritePlanResult summary={state.summary} testId="appt-status-write-plan" />
      ) : null}
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
