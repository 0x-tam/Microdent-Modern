import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { AppointmentCreateBody, BridgeDevStatusResponse } from "@microdent/contracts";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@microdent/ui";
import {
  APPOINTMENT_CREATE_WRITE_CONFIRM,
  appointmentCreateWriteUnavailableMessage,
} from "./appointment-create-write.js";
import {
  APPOINTMENT_CREATE_APPLY_LABEL,
  APPOINTMENT_CREATE_PATIENT_ID_HINT,
  APPOINTMENT_CREATE_PREVIEW_LABEL,
  APPOINTMENT_CREATE_SUMMARY,
} from "./read-only-ui-copy.js";
import { isSandboxWritePilotEnabled, resolveSandboxWriteBlockReason } from "./sandbox-write-pilot.js";
import {
  SafeWritePlanResult,
  SandboxWriteBanner,
  SandboxWriteBlockedNotice,
  summarizeWritePlan,
  WriteOperationResult,
  type WritePlanResultSummary,
} from "./safe-write-plan-display.js";
import {
  APPOINTMENT_STATUS_OPTIONS,
  buildWriteOperationFeedback,
  formatWriteOperationFeedbackLines,
} from "./appointment-status-write.js";

export type AppointmentCreateWriteActionProps = {
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  /** Default date for new rows (YYYY-MM-DD). */
  defaultDate: string;
  defaultRoom?: number;
  onCommitted?: () => void;
};

type UiState =
  | { kind: "idle" }
  | { kind: "loading"; action: "preview" | "commit" }
  | { kind: "preview"; summary: WritePlanResultSummary }
  | { kind: "result"; committed: boolean; feedbackLines: string[] }
  | { kind: "error"; message: string };

export function AppointmentCreateWriteAction({
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  defaultDate,
  defaultRoom = 1,
  onCommitted,
}: AppointmentCreateWriteActionProps) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [room, setRoom] = useState(String(defaultRoom));
  const [patId, setPatId] = useState("0");
  const [docId, setDocId] = useState("0");
  const [durationSlots, setDurationSlots] = useState("1");
  const [status, setStatus] = useState("1");
  const [state, setState] = useState<UiState>({ kind: "idle" });

  useEffect(() => {
    setDate(defaultDate);
  }, [defaultDate]);

  useEffect(() => {
    setRoom(String(defaultRoom));
  }, [defaultRoom]);

  const buildBody = useCallback((): AppointmentCreateBody | null => {
    const roomNum = Number(room);
    const pat = patId.trim();
    if (!date || !time || !Number.isFinite(roomNum) || roomNum < 1 || pat.length === 0) {
      return null;
    }
    const body: AppointmentCreateBody = {
      date,
      time,
      room: roomNum,
      patId: pat,
      durationSlots: Math.max(1, Math.trunc(Number(durationSlots) || 1)),
    };
    const doc = Number(docId);
    if (Number.isFinite(doc) && doc >= 0) body.docId = Math.trunc(doc);
    const st = Number(status);
    if (Number.isFinite(st) && st >= 0 && st <= 5) body.status = Math.trunc(st);
    return body;
  }, [date, docId, durationSlots, patId, room, status, time]);

  const runPreview = useCallback(async () => {
    const body = buildBody();
    if (!body) {
      setState({ kind: "error", message: "Enter date, time, room, and patient id before preview." });
      return;
    }
    setState({ kind: "loading", action: "preview" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.postAppointmentCreate(body, "dry-run");
      setState({ kind: "preview", summary: summarizeWritePlan(plan) });
    } catch (err) {
      if (err instanceof BridgeClientError) {
        setState({
          kind: "error",
          message: appointmentCreateWriteUnavailableMessage(err.status, err.apiCode),
        });
        return;
      }
      setState({ kind: "error", message: appointmentCreateWriteUnavailableMessage() });
    }
  }, [bridgeBaseUrl, buildBody, fetchImpl]);

  const runCommit = useCallback(async () => {
    if (state.kind !== "preview") {
      setState({ kind: "error", message: "Preview the new appointment before applying." });
      return;
    }
    const body = buildBody();
    if (!body) {
      setState({ kind: "error", message: "Enter required fields before applying." });
      return;
    }
    if (!window.confirm(APPOINTMENT_CREATE_WRITE_CONFIRM)) {
      return;
    }
    setState({ kind: "loading", action: "commit" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.postAppointmentCreate(body, "commit");
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
      setState({ kind: "result", committed: plan.committed, feedbackLines });
      if (plan.committed) {
        onCommitted?.();
      }
    } catch (err) {
      if (err instanceof BridgeClientError) {
        setState({
          kind: "error",
          message: appointmentCreateWriteUnavailableMessage(err.status, err.apiCode),
        });
        return;
      }
      setState({ kind: "error", message: appointmentCreateWriteUnavailableMessage() });
    }
  }, [bridgeBaseUrl, buildBody, fetchImpl, onCommitted, state.kind]);

  if (!isSandboxWritePilotEnabled(writePilotEnabled)) {
    return null;
  }

  const blockReason = resolveSandboxWriteBlockReason(writePilotEnabled, writeCapability);
  if (blockReason) {
    return (
      <SandboxWriteBlockedNotice
        reason={blockReason}
        className="app-sandbox-write app-appt-create-write app-sandbox-write--blocked"
        testId="appt-create-write-blocked"
      />
    );
  }

  const invalidatePreview = () => {
    setState((prev) => (prev.kind === "preview" ? { kind: "idle" } : prev));
  };

  const loading = state.kind === "loading";
  const previewOk = state.kind === "preview";

  return (
    <details className="app-sandbox-write app-appt-create-write" data-testid="appt-create-write-pilot">
      <summary className="app-sandbox-write__summary">{APPOINTMENT_CREATE_SUMMARY}</summary>
      <SandboxWriteBanner />
      <p className="app-sandbox-write__hint">{APPOINTMENT_CREATE_PATIENT_ID_HINT}</p>
      <div className="app-sandbox-write__fields app-sandbox-write__fields--grid">
        <label className="app-sandbox-write__label">
          <span>Date</span>
          <input
            type="date"
            className="ui-focusable"
            value={date}
            disabled={loading}
            onChange={(e) => {
              setDate(e.target.value);
              invalidatePreview();
            }}
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Time</span>
          <input
            type="text"
            className="ui-focusable"
            value={time}
            disabled={loading}
            onChange={(e) => {
              setTime(e.target.value);
              invalidatePreview();
            }}
            aria-label="Appointment time"
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Room</span>
          <input
            type="number"
            min={1}
            max={99}
            className="ui-focusable"
            value={room}
            disabled={loading}
            onChange={(e) => {
              setRoom(e.target.value);
              invalidatePreview();
            }}
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Patient id</span>
          <input
            type="text"
            className="ui-focusable"
            value={patId}
            disabled={loading}
            onChange={(e) => {
              setPatId(e.target.value);
              invalidatePreview();
            }}
            aria-label="Patient id"
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Doctor id</span>
          <input
            type="number"
            min={0}
            className="ui-focusable"
            value={docId}
            disabled={loading}
            onChange={(e) => {
              setDocId(e.target.value);
              invalidatePreview();
            }}
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Duration slots</span>
          <input
            type="number"
            min={1}
            max={99}
            className="ui-focusable"
            value={durationSlots}
            disabled={loading}
            onChange={(e) => {
              setDurationSlots(e.target.value);
              invalidatePreview();
            }}
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Status</span>
          <select
            className="ui-focusable"
            value={status}
            disabled={loading}
            onChange={(e) => {
              setStatus(e.target.value);
              invalidatePreview();
            }}
          >
            {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="app-sandbox-write__actions">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          disabled={loading}
          onClick={() => void runPreview()}
        >
          {state.kind === "loading" && state.action === "preview" ? "Previewing…" : APPOINTMENT_CREATE_PREVIEW_LABEL}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="ui-focusable"
          disabled={loading || !previewOk}
          aria-disabled={loading || !previewOk}
          title={previewOk ? undefined : `${APPOINTMENT_CREATE_PREVIEW_LABEL} before applying`}
          onClick={() => void runCommit()}
        >
          {state.kind === "loading" && state.action === "commit" ? "Creating…" : APPOINTMENT_CREATE_APPLY_LABEL}
        </Button>
      </div>
      {state.kind === "preview" ? (
        <SafeWritePlanResult summary={state.summary} testId="appt-create-plan" />
      ) : null}
      {state.kind === "result" ? (
        <WriteOperationResult
          committed={state.committed}
          successLabel="appointment created"
          feedbackLines={state.feedbackLines}
          testId="appt-create-write-result"
        />
      ) : null}
      {state.kind === "error" ? (
        <p className="app-sandbox-write__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </details>
  );
}
