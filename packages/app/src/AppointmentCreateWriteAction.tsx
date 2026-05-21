import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { AppointmentCreateBody, BridgeDevStatusResponse } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@microdent/ui";
import {
  APPOINTMENT_CREATE_WRITE_CONFIRM,
  appointmentCreateWriteUnavailableMessage,
} from "./appointment-create-write.js";
import {
  APPOINTMENT_CREATE_APPLY_LABEL,
  APPOINTMENT_CREATE_DOCTOR_NONE,
  APPOINTMENT_CREATE_PATIENT_CONTEXT,
  APPOINTMENT_CREATE_PATIENT_ID_HINT,
  APPOINTMENT_CREATE_PREVIEW_LABEL,
  APPOINTMENT_CREATE_SUMMARY,
  WRITE_BLOCKED_INVALID_HINT,
} from "./read-only-ui-copy.js";
import { roomDisplayLabel, type RoomLabelMap } from "./patient-appointments-display.js";
import { isSandboxWritePilotEnabled, resolveSandboxWriteBlockReason } from "./sandbox-write-pilot.js";
import { useDoctorLabels } from "./useDoctorLabels.js";
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
  roomOptions?: readonly number[];
  roomMap?: RoomLabelMap;
  selectedPatientId?: string | null;
  selectedPatientDisplayName?: string | null;
  selectedPatientChartNumber?: string | null;
  onCommitted?: () => void;
};

type UiState =
  | { kind: "idle" }
  | { kind: "loading"; action: "preview" | "commit" }
  | { kind: "preview"; summary: WritePlanResultSummary }
  | { kind: "result"; committed: boolean; feedbackLines: string[] }
  | { kind: "error"; message: string };

function resolveWriteStep(state: UiState): SandboxWriteStep {
  if (state.kind === "result") return "result";
  if (state.kind === "preview" || (state.kind === "loading" && state.action === "commit")) return "preview";
  return "edit";
}

export function AppointmentCreateWriteAction({
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  defaultDate,
  defaultRoom = 1,
  roomOptions = [],
  roomMap = new Map(),
  selectedPatientId = null,
  selectedPatientDisplayName = null,
  selectedPatientChartNumber = null,
  onCommitted,
}: AppointmentCreateWriteActionProps) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [room, setRoom] = useState(String(defaultRoom));
  const [patId, setPatId] = useState(selectedPatientId && selectedPatientId !== "0" ? selectedPatientId : "0");
  const [docId, setDocId] = useState("0");
  const [durationSlots, setDurationSlots] = useState("1");
  const [status, setStatus] = useState("1");
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const { labels: doctorLabels } = useDoctorLabels({
    bridgePhase: "connected",
    bridgeBaseUrl,
    fetchImpl,
  });
  const doctorOptions = useMemo(() => {
    return [...doctorLabels.entries()].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [doctorLabels]);

  useEffect(() => {
    setDate(defaultDate);
  }, [defaultDate]);

  useEffect(() => {
    setRoom(String(defaultRoom));
  }, [defaultRoom]);

  useEffect(() => {
    if (selectedPatientId && selectedPatientId !== "0") {
      setPatId(selectedPatientId);
    }
  }, [selectedPatientId]);

  const selectedPatientHeadline = useMemo(() => {
    if (!selectedPatientId || selectedPatientId === "0") return null;
    const name = selectedPatientDisplayName?.trim();
    const chart =
      selectedPatientChartNumber && selectedPatientChartNumber.length > 0
        ? ` · Chart ${selectedPatientChartNumber}`
        : "";
    if (name && name.length > 0) return `${name}${chart} · ID ${selectedPatientId}`;
    return `Patient ID ${selectedPatientId}${chart}`;
  }, [selectedPatientChartNumber, selectedPatientDisplayName, selectedPatientId]);

  const effectiveRoomOptions = useMemo(() => {
    if (roomOptions.length > 0) return roomOptions;
    const n = Number(room);
    return Number.isFinite(n) && n >= 1 ? [n] : [1];
  }, [room, roomOptions]);

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
      setState({ kind: "error", message: `${WRITE_BLOCKED_INVALID_HINT} Enter date, time, room, and patient id.` });
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
    <details className="app-sandbox-write app-sandbox-write-zone app-appt-create-write" data-testid="appt-create-write-pilot">
      <summary className="app-sandbox-write__summary app-sandbox-write-zone__header">{APPOINTMENT_CREATE_SUMMARY}</summary>
      <SandboxWriteBanner />
      <SandboxWriteStepIndicator step={resolveWriteStep(state)} />
      {selectedPatientHeadline ? (
        <p className="app-sandbox-write__patient-context" role="status">
          {APPOINTMENT_CREATE_PATIENT_CONTEXT}: {selectedPatientHeadline}
        </p>
      ) : null}
      <p className="app-sandbox-write__hint">{APPOINTMENT_CREATE_PATIENT_ID_HINT}</p>
      <div className="app-sandbox-write__fields app-sandbox-write__fields--grid">
        <label className="app-sandbox-write__label">
          <span className="app-sandbox-write__label-text">Date</span>
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
          <span className="app-sandbox-write__label-text">Time</span>
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
          <span className="app-sandbox-write__label-text">Room</span>
          <select
            className="ui-focusable"
            value={room}
            disabled={loading}
            onChange={(e) => {
              setRoom(e.target.value);
              invalidatePreview();
            }}
            aria-label="Room"
          >
            {effectiveRoomOptions.map((n) => (
              <option key={n} value={String(n)}>
                {roomDisplayLabel(n, roomMap)}
              </option>
            ))}
          </select>
        </label>
        <label className="app-sandbox-write__label">
          <span className="app-sandbox-write__label-text">Patient id</span>
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
          <span className="app-sandbox-write__label-text">Doctor</span>
          <select
            className="ui-focusable"
            value={docId}
            disabled={loading}
            onChange={(e) => {
              setDocId(e.target.value);
              invalidatePreview();
            }}
            aria-label="Doctor"
          >
            <option value="0">{APPOINTMENT_CREATE_DOCTOR_NONE}</option>
            {doctorOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="app-sandbox-write__label">
          <span className="app-sandbox-write__label-text">Duration slots</span>
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
          <span className="app-sandbox-write__label-text">Status</span>
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
        <SafeWritePlanResult className="app-sandbox-write__plan app-sandbox-write__surface app-sandbox-write__surface--preview" summary={state.summary} testId="appt-create-plan" />
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
        <p className="app-sandbox-write__error app-sandbox-write__surface app-sandbox-write__surface--danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </details>
  );
}
