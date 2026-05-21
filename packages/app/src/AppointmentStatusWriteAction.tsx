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
import { isSandboxWritePilotEnabled, resolveSandboxWriteBlockReason } from "./sandbox-write-pilot.js";
import {
  SafeWritePlanResult,
  SandboxWriteBanner,
  SandboxWriteStepIndicator,
  type SandboxWriteStep,
  SandboxWriteBlockedNotice,
  summarizeWritePlan,
  WriteOperationResult,
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

function resolveWriteStep(state: WriteUiState): SandboxWriteStep {
  if (state.kind === "result") return "result";
  if (state.kind === "preview" || (state.kind === "loading" && state.action === "commit")) return "preview";
  return "edit";
}

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

  if (!embedded && !isSandboxWritePilotEnabled(writePilotEnabled)) {
    return null;
  }

  const blockReason = !embedded
    ? resolveSandboxWriteBlockReason(writePilotEnabled, writeCapability)
    : null;
  if (blockReason) {
    return (
      <SandboxWriteBlockedNotice
        reason={blockReason}
        className="app-sandbox-write app-appt-status-write app-sandbox-write--blocked"
        testId="appt-status-write-blocked"
      />
    );
  }

  const invalidatePreview = () => {
    setState((prev) => (prev.kind === "preview" ? { kind: "idle" } : prev));
  };

  const loading = state.kind === "loading";
  const previewOk = state.kind === "preview";
  const rootClass = embedded
    ? "app-appt-status-write app-appt-status-write--embedded"
    : "clinic-panel clinic-write-panel app-sandbox-write app-sandbox-write-zone app-appt-status-write";

  return (
    <div className={rootClass} data-testid="appt-status-write-pilot">
      {!embedded ? <SandboxWriteBanner className="app-appt-status-write__banner" /> : null}
      <SandboxWriteStepIndicator step={resolveWriteStep(state)} />
      <div className="app-appt-status-write__controls app-sandbox-write__section">
        <label className="app-appt-status-write__label">
          <span className="app-appt-status-write__label-text app-sandbox-write__label-text">New status</span>
          <select
            className="ui-focusable app-appt-status-write__select"
            value={nextStatus}
            disabled={loading}
            onChange={(e) => {
              setNextStatus(Number(e.target.value));
              invalidatePreview();
            }}
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
          disabled={loading || !previewOk}
          aria-disabled={loading || !previewOk}
          title={previewOk ? undefined : `${APPOINTMENT_STATUS_PREVIEW_LABEL} before applying`}
          onClick={() => void runCommit()}
        >
          {state.kind === "loading" && state.action === "commit"
            ? "Applying…"
            : APPOINTMENT_STATUS_APPLY_LABEL}
        </Button>
      </div>
      {state.kind === "preview" ? (
        <SafeWritePlanResult className="app-sandbox-write__plan app-sandbox-write__surface app-sandbox-write__surface--preview" summary={state.summary} testId="appt-status-write-plan" />
      ) : null}
      {state.kind === "result" ? (
        <WriteOperationResult
          committed={state.committed}
          successLabel="status updated"
          feedbackLines={state.feedbackLines}
          mode={state.mode}
          testId="appt-status-write-result"
        />
      ) : null}
      {state.kind === "error" ? (
        <p className="app-appt-status-write__error app-sandbox-write__surface app-sandbox-write__surface--danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
