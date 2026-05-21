import { createBridgeClient, BridgeClientError } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, PatientProfileResponse } from "@microdent/contracts";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@microdent/ui";
import {
  buildDemographicsUpdateBody,
  PATIENT_DEMOGRAPHICS_WRITE_CONFIRM,
  patientDemographicsWriteUnavailableMessage,
  profileToDemographicsForm,
  type PatientDemographicsFormState,
} from "./patient-demographics-write.js";
import {
  PATIENT_DEMOGRAPHICS_APPLY_LABEL,
  PATIENT_DEMOGRAPHICS_APPLYING_LABEL,
  PATIENT_DEMOGRAPHICS_DOCTOR_ID_HINT,
  PATIENT_DEMOGRAPHICS_PREVIEW_LABEL,
  PATIENT_DEMOGRAPHICS_PREVIEWING_LABEL,
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
  buildWriteOperationFeedback,
  formatWriteOperationFeedbackLines,
} from "./appointment-status-write.js";

export type PatientDemographicsWritePanelProps = {
  patientId: string;
  profile: PatientProfileResponse;
  bridgeBaseUrl: string;
  fetchImpl?: typeof fetch;
  writePilotEnabled: boolean;
  writeCapability: BridgeDevStatusResponse | null;
  onCommitted?: () => void;
};

type UiState =
  | { kind: "idle" }
  | { kind: "loading"; action: "preview" | "commit" }
  | { kind: "preview"; summary: WritePlanResultSummary }
  | { kind: "result"; committed: boolean; feedbackLines: string[] }
  | { kind: "error"; message: string };

export function PatientDemographicsWritePanel({
  patientId,
  profile,
  bridgeBaseUrl,
  fetchImpl,
  writePilotEnabled,
  writeCapability,
  onCommitted,
}: PatientDemographicsWritePanelProps) {
  const [baseline, setBaseline] = useState<PatientDemographicsFormState>(() =>
    profileToDemographicsForm(profile),
  );
  const [form, setForm] = useState<PatientDemographicsFormState>(() =>
    profileToDemographicsForm(profile),
  );
  const [state, setState] = useState<UiState>({ kind: "idle" });

  useEffect(() => {
    const next = profileToDemographicsForm(profile);
    setBaseline(next);
    setForm(next);
    setState({ kind: "idle" });
  }, [profile.patientId, profile.displayName, profile.chartNumber, profile.reverseName, profile.active, profile.doctorId]);

  const patchField = useCallback(
    <K extends keyof PatientDemographicsFormState>(key: K, value: PatientDemographicsFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setState((prev) => (prev.kind === "preview" ? { kind: "idle" } : prev));
    },
    [],
  );

  const runPreview = useCallback(async () => {
    const body = buildDemographicsUpdateBody(form, baseline);
    if (!body) {
      setState({
        kind: "error",
        message: "Change at least one allowlisted field before preview.",
      });
      return;
    }
    setState({ kind: "loading", action: "preview" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.patchPatientDemographics(patientId, body, "dry-run");
      setState({ kind: "preview", summary: summarizeWritePlan(plan) });
    } catch (err) {
      if (err instanceof BridgeClientError) {
        setState({
          kind: "error",
          message: patientDemographicsWriteUnavailableMessage(err.status),
        });
        return;
      }
      setState({ kind: "error", message: patientDemographicsWriteUnavailableMessage() });
    }
  }, [baseline, bridgeBaseUrl, fetchImpl, form, patientId]);

  const runCommit = useCallback(async () => {
    if (state.kind !== "preview") {
      setState({ kind: "error", message: "Preview changes before applying." });
      return;
    }
    const body = buildDemographicsUpdateBody(form, baseline);
    if (!body) {
      setState({ kind: "error", message: "Change at least one allowlisted field before applying." });
      return;
    }
    if (!window.confirm(PATIENT_DEMOGRAPHICS_WRITE_CONFIRM)) {
      return;
    }
    setState({ kind: "loading", action: "commit" });
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl, fetch: fetchImpl });
    try {
      const plan = await client.patchPatientDemographics(patientId, body, "commit");
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
          message: patientDemographicsWriteUnavailableMessage(err.status),
        });
        return;
      }
      setState({ kind: "error", message: patientDemographicsWriteUnavailableMessage() });
    }
  }, [baseline, bridgeBaseUrl, fetchImpl, form, onCommitted, patientId, state.kind]);

  if (!isSandboxWritePilotEnabled(writePilotEnabled)) {
    return null;
  }

  const blockReason = resolveSandboxWriteBlockReason(writePilotEnabled, writeCapability);
  const loading = state.kind === "loading";
  const previewOk = state.kind === "preview";
  const applyDisabled = loading || !previewOk;

  if (blockReason) {
    return (
      <SandboxWriteBlockedNotice
        reason={blockReason}
        className="app-sandbox-write app-patient-demographics-write app-sandbox-write--blocked"
        testId="patient-demographics-write-unavailable"
      />
    );
  }

  return (
    <div
      className="app-sandbox-write app-patient-demographics-write"
      data-testid="patient-demographics-write-pilot"
      aria-labelledby="patient-demographics-write-heading"
    >
      <h4 id="patient-demographics-write-heading" className="app-sandbox-write__heading">
        Edit allowlisted fields
      </h4>
      <SandboxWriteBanner />
      <p className="app-sandbox-write__hint">
        Preview runs a dry-run backup plan first. Apply stays disabled until preview succeeds. Only allowlisted
        name/chart fields — phone, address, and notes are not editable. Once committed, check operation id and backup
        lines below.
      </p>
      <div className="app-patient-demographics-write__groups">
        <fieldset className="app-sandbox-write__group" disabled={loading}>
          <legend className="app-sandbox-write__group-legend">Name</legend>
          <p className="app-sandbox-write__group-hint">
            First and last name are optional; leave blank to keep legacy DBF values.
          </p>
          <div className="app-sandbox-write__fields app-sandbox-write__fields--grid">
            <label className="app-sandbox-write__label">
              <span>First name</span>
              <input
                type="text"
                className="ui-focusable"
                value={form.firstName}
                disabled={loading}
                onChange={(e) => patchField("firstName", e.target.value)}
                maxLength={25}
                aria-label="First name"
              />
            </label>
            <label className="app-sandbox-write__label">
              <span>Last name</span>
              <input
                type="text"
                className="ui-focusable"
                value={form.lastName}
                disabled={loading}
                onChange={(e) => patchField("lastName", e.target.value)}
                maxLength={25}
                aria-label="Last name"
              />
            </label>
            <label className="app-sandbox-write__label">
              <span>Display name</span>
              <input
                type="text"
                className="ui-focusable"
                value={form.displayName}
                disabled={loading}
                onChange={(e) => patchField("displayName", e.target.value)}
                maxLength={51}
                aria-label="Display name"
              />
            </label>
            <label className="app-sandbox-write__label">
              <span>Reverse name</span>
              <input
                type="text"
                className="ui-focusable"
                value={form.reverseName}
                disabled={loading}
                onChange={(e) => patchField("reverseName", e.target.value)}
                maxLength={51}
                aria-label="Reverse name"
              />
            </label>
          </div>
        </fieldset>
        <fieldset className="app-sandbox-write__group" disabled={loading}>
          <legend className="app-sandbox-write__group-legend">Chart &amp; status</legend>
          <p className="app-sandbox-write__group-hint">Chart number and active flag shown on the summary card.</p>
          <div className="app-sandbox-write__fields app-sandbox-write__fields--grid">
            <label className="app-sandbox-write__label">
              <span>Chart number</span>
              <input
                type="text"
                className="ui-focusable"
                value={form.chartNumber}
                disabled={loading}
                onChange={(e) => patchField("chartNumber", e.target.value)}
                maxLength={15}
                aria-label="Chart number"
              />
            </label>
            <label className="app-sandbox-write__label">
              <span>Active</span>
              <select
                className="ui-focusable"
                value={form.active}
                disabled={loading}
                onChange={(e) => patchField("active", e.target.value as PatientDemographicsFormState["active"])}
                aria-label="Active status"
              >
                <option value="">—</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset className="app-sandbox-write__group" disabled={loading}>
          <legend className="app-sandbox-write__group-legend">Assignment</legend>
          <p id="patient-demographics-doctor-hint" className="app-sandbox-write__group-hint">
            {PATIENT_DEMOGRAPHICS_DOCTOR_ID_HINT}
          </p>
          <div className="app-sandbox-write__fields">
            <label className="app-sandbox-write__label">
              <span>Doctor id</span>
              <input
                type="text"
                inputMode="numeric"
                className="ui-focusable"
                value={form.doctorId}
                disabled={loading}
                onChange={(e) => patchField("doctorId", e.target.value)}
                aria-label="Doctor id"
                aria-describedby="patient-demographics-doctor-hint"
              />
            </label>
          </div>
        </fieldset>
      </div>
      <div className="app-sandbox-write__actions">
        <Button
          type="button"
          variant="secondary"
          className="ui-focusable"
          disabled={loading}
          data-testid="patient-demographics-preview"
          onClick={() => void runPreview()}
        >
          {state.kind === "loading" && state.action === "preview"
            ? PATIENT_DEMOGRAPHICS_PREVIEWING_LABEL
            : PATIENT_DEMOGRAPHICS_PREVIEW_LABEL}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="ui-focusable"
          disabled={applyDisabled}
          data-testid="patient-demographics-apply"
          aria-disabled={applyDisabled}
          title={previewOk ? undefined : `${PATIENT_DEMOGRAPHICS_PREVIEW_LABEL} before applying`}
          onClick={() => void runCommit()}
        >
          {state.kind === "loading" && state.action === "commit"
            ? PATIENT_DEMOGRAPHICS_APPLYING_LABEL
            : PATIENT_DEMOGRAPHICS_APPLY_LABEL}
        </Button>
      </div>
      {previewOk ? (
        <SafeWritePlanResult summary={state.summary} testId="patient-demographics-plan" />
      ) : null}
      {state.kind === "result" ? (
        <WriteOperationResult
          committed={state.committed}
          successLabel="demographics updated"
          feedbackLines={state.feedbackLines}
          testId="patient-demographics-write-result"
        />
      ) : null}
      {state.kind === "error" ? (
        <p className="app-sandbox-write__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
