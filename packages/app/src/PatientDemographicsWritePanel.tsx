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
import { isSandboxWritePilotEnabled, isSandboxWriteReady } from "./sandbox-write-pilot.js";
import {
  SafeWritePlanResult,
  SandboxWriteBanner,
  summarizeWritePlan,
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
  if (!writeCapability || !isSandboxWriteReady(writeCapability)) {
    return null;
  }

  const loading = state.kind === "loading";

  return (
    <section
      className="app-sandbox-write app-patient-demographics-write"
      data-testid="patient-demographics-write-pilot"
      aria-labelledby="patient-demographics-write-heading"
    >
      <h3 id="patient-demographics-write-heading" className="app-sandbox-write__heading">
        Sandbox: edit demographics
      </h3>
      <SandboxWriteBanner />
      <p className="app-sandbox-write__hint">
        Allowlisted fields only — no phone, address, insurance, or notes.
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
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Chart number</span>
          <input
            type="text"
            className="ui-focusable"
            value={form.chartNumber}
            disabled={loading}
            onChange={(e) => patchField("chartNumber", e.target.value)}
            maxLength={15}
          />
        </label>
        <label className="app-sandbox-write__label">
          <span>Active</span>
          <select
            className="ui-focusable"
            value={form.active}
            disabled={loading}
            onChange={(e) => patchField("active", e.target.value as PatientDemographicsFormState["active"])}
          >
            <option value="">—</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label className="app-sandbox-write__label">
          <span>Doctor id</span>
          <input
            type="text"
            className="ui-focusable"
            value={form.doctorId}
            disabled={loading}
            onChange={(e) => patchField("doctorId", e.target.value)}
            aria-label="Doctor id"
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
          {state.kind === "loading" && state.action === "preview" ? "Previewing…" : "Preview changes"}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="ui-focusable"
          disabled={loading || state.kind !== "preview"}
          onClick={() => void runCommit()}
        >
          {state.kind === "loading" && state.action === "commit" ? "Applying…" : "Apply demographics"}
        </Button>
      </div>
      {state.kind === "preview" ? (
        <SafeWritePlanResult summary={state.summary} testId="patient-demographics-plan" />
      ) : null}
      {state.kind === "result" ? (
        <div className="app-sandbox-write__result" role="status" data-committed={String(state.committed)}>
          <p>
            {state.committed
              ? "Committed: true — demographics updated."
              : "Committed: false — nothing was saved."}
          </p>
          <ul className="app-sandbox-write__feedback" aria-label="Write operation feedback">
            {state.feedbackLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.kind === "error" ? (
        <p className="app-sandbox-write__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
