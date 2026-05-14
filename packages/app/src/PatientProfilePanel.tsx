import { BridgeClientError, createBridgeClient } from "@microdent/bridge-client";
import type { PatientProfileResponse } from "@microdent/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";

export type PatientProfilePanelProps = {
  /** When null, shows the “no patient selected” state. */
  patientId: string | null;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  onBackToday: () => void;
  onClearPatient: () => void;
};

type LoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; profile: PatientProfileResponse }
  | { phase: "not_found" }
  | { phase: "error"; message: string };

export function safePatientProfileError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "PATIENT_NOT_FOUND") {
        return "That patient record was not found. Try searching again.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED" || code === "PATIENT_DBF_NOT_FOUND") {
        return "Patient profiles are not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for a profile request.";
      }
      return "The profile could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      return "The clinic service returned data this screen could not read.";
    }
  }
  return "The profile could not be loaded.";
}

const FUTURE_TABS = [
  { id: "appointments", label: "Appointments" },
  { id: "treatments", label: "Treatments" },
  { id: "payments", label: "Payments" },
  { id: "medical", label: "Medical" },
  { id: "chart", label: "Chart" },
] as const;

export function PatientProfilePanel({
  patientId,
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  onBackToday,
  onClearPatient,
}: PatientProfilePanelProps) {
  const base = bridgeBaseUrl?.trim() ?? "";

  const [state, setState] = useState<LoadState>({ phase: "idle" });
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (patientId === null) {
      setState({ phase: "idle" });
      return;
    }
    if (!base) {
      setState({ phase: "offline" });
      return;
    }
    if (bridgePhase !== "connected") {
      setState({ phase: "offline" });
      return;
    }

    const seq = ++requestSeq.current;
    setState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const profile = await client.getPatientProfile(patientId);
        if (cancelled || seq !== requestSeq.current) return;
        setState({ phase: "loaded", profile });
      } catch (e: unknown) {
        if (cancelled || seq !== requestSeq.current) return;
        if (e instanceof BridgeClientError && e.kind === "http" && e.status === 404 && e.apiCode === "PATIENT_NOT_FOUND") {
          setState({ phase: "not_found" });
          return;
        }
        setState({ phase: "error", message: safePatientProfileError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, retryNonce]);

  const activeLabel = useMemo(() => {
    if (state.phase === "loaded") {
      if (state.profile.active === true) return "Active";
      if (state.profile.active === false) return "Inactive";
    }
    return null;
  }, [state]);

  return (
    <div className="app-patient-profile">
      <div className="app-patient-profile__toolbar">
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
        {patientId !== null ? (
          <Button type="button" variant="ghost" className="ui-focusable" onClick={onClearPatient}>
            Clear patient
          </Button>
        ) : null}
      </div>

      <p className="app-patient-profile__readonly-note" role="note">
        Read-only profile — safe summary from the bridge only. Nothing here can be edited.
      </p>

      <AppErrorBoundary>
        {patientId === null ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title="No patient selected"
            description="Use Find a patient in the top bar, pick a row when the clinic service is connected, and this area will open their read-only summary."
          />
        ) : state.phase === "offline" ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title="Clinic service offline"
            description="Connect the bridge and wait until the top bar shows Connected, then try opening the patient again from search."
          />
        ) : state.phase === "loading" ? (
          <p className="app-patient-profile__status" role="status" aria-live="polite">
            Loading profile…
          </p>
        ) : state.phase === "not_found" ? (
          <EmptyState
            className="ui-empty--start app-patient-profile__empty"
            title="Patient not found"
            description="That record may have been removed from the copy, or the list was out of date. Search again."
          />
        ) : state.phase === "error" ? (
          <div className="app-patient-profile__error" role="alert">
            <p>{state.message}</p>
            <Button type="button" variant="secondary" className="ui-focusable" onClick={() => setRetryNonce((n) => n + 1)}>
              Retry
            </Button>
          </div>
        ) : state.phase === "loaded" ? (
          <>
            <Card className="app-patient-profile__card">
              <CardHeader>
                <div className="app-patient-profile__card-head">
                  <div>
                    <p className="app-patient-profile__name">{state.profile.displayName}</p>
                    {state.profile.reverseName ? (
                      <p className="app-patient-profile__rev">{state.profile.reverseName}</p>
                    ) : null}
                  </div>
                  {activeLabel ? (
                    <Badge variant={state.profile.active ? "success" : "neutral"} semanticLabel={`Account status: ${activeLabel}`}>
                      {activeLabel}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardBody>
                <dl className="app-patient-profile__dl">
                  <div className="app-patient-profile__row">
                    <dt>Chart number</dt>
                    <dd>{state.profile.chartNumber ?? "—"}</dd>
                  </div>
                  <div className="app-patient-profile__row">
                    <dt>Record id</dt>
                    <dd>{state.profile.patientId}</dd>
                  </div>
                  <div className="app-patient-profile__row">
                    <dt>Phone (masked)</dt>
                    <dd>{state.profile.phoneMask ?? "—"}</dd>
                  </div>
                  <div className="app-patient-profile__row">
                    <dt>Provider id</dt>
                    <dd>{state.profile.doctorId ?? "—"}</dd>
                  </div>
                  <div className="app-patient-profile__row">
                    <dt>Entry date</dt>
                    <dd>{state.profile.entryDate ?? "—"}</dd>
                  </div>
                  <div className="app-patient-profile__row">
                    <dt>Last visit</dt>
                    <dd>{state.profile.lastVisit ?? "—"}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <nav className="app-patient-profile__tabs" aria-label="Patient sections (preview)">
              <p className="app-patient-profile__tabs-lede">More sections — coming in later phases</p>
              <ul className="app-patient-profile__tablist">
                {FUTURE_TABS.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="app-patient-profile__tab ui-focusable" disabled aria-disabled="true" title="Not available in this read-only preview">
                      {t.label}
                      <span className="app-patient-profile__tab-badge">Soon</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        ) : (
          <EmptyState className="ui-empty--start" title="Nothing to show" description="Unexpected state." />
        )}
      </AppErrorBoundary>
    </div>
  );
}
