import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { AppointmentTimeMoveBody, BridgeDevStatusResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useCallback, useState } from "react";
import { Button } from "@microdent/ui";
import {
  APPOINTMENT_TIME_MOVE_WRITE_CONFIRM,
  appointmentTimeMoveWriteUnavailableMessage,
} from "./appointment-time-move-write.js";
import {
  APPOINTMENT_TIME_MOVE_APPLY_LABEL,
  APPOINTMENT_TIME_MOVE_PREVIEW_LABEL,
  APPOINTMENT_MOVE_CONTEXT_TITLE,
  WRITE_BLOCKED_INVALID_HINT,
} from "./read-only-ui-copy.js";
import {
  patientApptStatusLabel,
  roomDisplayLabel,
  type RoomLabelMap,
} from "./patient-appointments-display.js";
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
import {
  formatWriteOperationFeedbackLines,
  buildWriteOperationFeedback,
} from "./appointment-status-write.js";

export type AppointmentTimeMoveWriteActionProps = {
  appointment: ScheduleAppointmentItem;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  embedded?: boolean;
  roomOptions?: readonly number[];
  roomMap?: RoomLabelMap;
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

function bodyFromAppointment(
  appointment: ScheduleAppointmentItem,
  date: string,
  time: string,
  room: number,
  durationSlots: string,
): AppointmentTimeMoveBody {
  const body: AppointmentTimeMoveBody = { date, time, room };
  const slots = Number(durationSlots);
  if (Number.isFinite(slots) && slots >= 1) {
    body.durationSlots = Math.trunc(slots);
  }
  return body;
}

export function AppointmentTimeMoveWriteAction({
  appointment,
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  embedded = false,
  roomOptions = [],
  roomMap = new Map(),
  onCommitted,
}: AppointmentTimeMoveWriteActionProps) {
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState(appointment.time);
  const [room, setRoom] = useState(String(appointment.room));
  const [durationSlots, setDurationSlots] = useState(String(appointment.durationSlots));
  const [state, setState] = useState<UiState>({ kind: "idle" });

  const buildBody = useCallback(
    () =>
      bodyFromAppointment(
        appointment,
        date,
        time,
        Number(room),
        durationSlots,
      ),
    [appointment, date, time, room, durationSlots],
  );

  const runPreview = useCallback(async () => {
    const roomNum = Number(room);
    if (!date || !time || !Number.isFinite(roomNum) || roomNum < 1) {
      setState({ kind: "error", message: `${WRITE_BLOCKED_INVALID_HINT} Enter date, time, and room.` });
      return;
    }
    setState({ kind: "loading", action: "preview" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.patchAppointmentTimeMove(appointment.id, buildBody(), "dry-run");
      setState({ kind: "preview", summary: summarizeWritePlan(plan) });
    } catch (err) {
      if (err instanceof BridgeClientError) {
        setState({
          kind: "error",
          message: appointmentTimeMoveWriteUnavailableMessage(err.status, err.apiCode),
        });
        return;
      }
      setState({ kind: "error", message: appointmentTimeMoveWriteUnavailableMessage() });
    }
  }, [appointment.id, bridgeBaseUrl, buildBody, date, fetchImpl, room, time]);

  const runCommit = useCallback(async () => {
    if (state.kind !== "preview") {
      setState({ kind: "error", message: "Preview the move before applying." });
      return;
    }
    if (!window.confirm(APPOINTMENT_TIME_MOVE_WRITE_CONFIRM)) {
      return;
    }
    setState({ kind: "loading", action: "commit" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.patchAppointmentTimeMove(appointment.id, buildBody(), "commit");
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
          message: appointmentTimeMoveWriteUnavailableMessage(err.status, err.apiCode),
        });
        return;
      }
      setState({ kind: "error", message: appointmentTimeMoveWriteUnavailableMessage() });
    }
  }, [appointment.id, bridgeBaseUrl, buildBody, fetchImpl, onCommitted, state.kind]);

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
        className="app-sandbox-write app-appt-time-move-write app-sandbox-write--blocked"
        testId="appt-time-move-write-blocked"
      />
    );
  }

  const invalidatePreview = () => {
    setState((prev) => (prev.kind === "preview" ? { kind: "idle" } : prev));
  };

  const loading = state.kind === "loading";
  const previewOk = state.kind === "preview";
  const rootClass = embedded
    ? "app-appt-time-move-write app-appt-time-move-write--embedded"
    : "app-sandbox-write app-sandbox-write-zone app-appt-time-move-write";

  const effectiveRoomOptions = roomOptions.length > 0 ? roomOptions : [appointment.room];

  const fields = (
    <>
      <SandboxWriteStepIndicator step={resolveWriteStep(state)} />
      <div className="app-sandbox-write__context-panel app-sandbox-write__section" role="note" data-testid="appt-move-context">
        <p className="app-sandbox-write__context-title">{APPOINTMENT_MOVE_CONTEXT_TITLE}</p>
        <p className="app-sandbox-write__context-line">
          {appointment.date} · {appointment.time} · {roomDisplayLabel(appointment.room, roomMap)} ·{" "}
          {patientApptStatusLabel(appointment.status)}
        </p>
      </div>
      <div className="app-sandbox-write__fields">
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
            placeholder="9:00"
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
      </div>
      <div className="app-sandbox-write__actions">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          disabled={loading}
          onClick={() => void runPreview()}
        >
          {state.kind === "loading" && state.action === "preview"
            ? "Previewing…"
            : APPOINTMENT_TIME_MOVE_PREVIEW_LABEL}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="ui-focusable"
          disabled={loading || !previewOk}
          aria-disabled={loading || !previewOk}
          title={previewOk ? undefined : `${APPOINTMENT_TIME_MOVE_PREVIEW_LABEL} before applying`}
          onClick={() => void runCommit()}
        >
          {state.kind === "loading" && state.action === "commit"
            ? "Applying…"
            : APPOINTMENT_TIME_MOVE_APPLY_LABEL}
        </Button>
      </div>
      {state.kind === "preview" ? (
        <SafeWritePlanResult className="app-sandbox-write__plan app-sandbox-write__surface app-sandbox-write__surface--preview" summary={state.summary} testId="appt-time-move-plan" />
      ) : null}
      {state.kind === "result" ? (
        <WriteOperationResult
          committed={state.committed}
          successLabel="appointment time updated"
          feedbackLines={state.feedbackLines}
          testId="appt-time-move-write-result"
        />
      ) : null}
      {state.kind === "error" ? (
        <p className="app-sandbox-write__error app-sandbox-write__surface app-sandbox-write__surface--danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className={rootClass} data-testid="appt-time-move-write-pilot">
        {fields}
      </div>
    );
  }

  return (
    <details className={rootClass} data-testid="appt-time-move-write-pilot">
      <summary className="app-sandbox-write__summary app-sandbox-write-zone__header">Sandbox: move time</summary>
      <SandboxWriteBanner />
      {fields}
    </details>
  );
}
