import { BridgeClientError, createBridgeClient, isInvalidBodySchemaMismatch } from "@microdent/bridge-client";
import type { PatientProfileResponse, ScheduleAppointmentItem } from "@microdent/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import {
  patientApptFormatDuration,
  patientApptRowMeta,
  patientApptStatusBadgeVariant,
  patientApptStatusLabel,
} from "./patient-appointments-display.js";
import {
  defaultPatientApptRange,
  patientApptRangeForPreset,
  type PatientApptRangePreset,
} from "./patient-appointments-range.js";

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

type ProfileTab = "appointments" | "treatments" | "payments" | "medical" | "chart";

type ApptLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "loaded"; appointments: ScheduleAppointmentItem[] }
  | { phase: "empty" }
  | { phase: "error"; message: string };

const COMING_TABS: { id: Exclude<ProfileTab, "appointments">; label: string }[] = [
  { id: "treatments", label: "Treatments" },
  { id: "payments", label: "Payments" },
  { id: "medical", label: "Medical" },
  { id: "chart", label: "Chart" },
];

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
      if (isInvalidBodySchemaMismatch(e)) {
        return "Patient profile needs a small data mapping fix. No clinic data was changed.";
      }
      return "The profile could not read the clinic response format. Try again.";
    }
  }
  return "The profile could not be loaded.";
}

export function safePatientAppointmentsError(e: unknown): string {
  if (e instanceof BridgeClientError) {
    if (e.kind === "network") {
      return "Could not reach the clinic service. Check that the bridge is running.";
    }
    if (e.kind === "http") {
      const code = e.apiCode ?? "";
      if (code === "INVALID_PATIENT_ID") {
        return "This patient id is not valid for an appointment history request.";
      }
      if (code === "INVALID_PATIENT_APPOINTMENTS_QUERY") {
        return "The date range is not valid. Try a shorter range.";
      }
      if (code === "DATA_ROOT_NOT_CONFIGURED" || code === "SCHEDULE_DBF_NOT_FOUND") {
        return "Appointment history is not available on this bridge yet. Ask your administrator to check the data folder.";
      }
      return "Appointment history could not be loaded. Try again in a moment.";
    }
    if (e.kind === "invalid_body") {
      if (isInvalidBodySchemaMismatch(e)) {
        return "Appointment history needs a small data mapping fix. No clinic data was changed.";
      }
      return "Appointment history could not read the clinic response format. Try again.";
    }
    if (e.kind === "invalid_argument") {
      return "The date range is not valid. Try a shorter range.";
    }
  }
  return "Appointment history could not be loaded.";
}

function formatApptRangeHeading(from: string, to: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (from === to) {
      return fmt.format(new Date(from + "T12:00:00"));
    }
    return `${fmt.format(new Date(from + "T12:00:00"))} – ${fmt.format(new Date(to + "T12:00:00"))}`;
  } catch {
    return `${from} – ${to}`;
  }
}

function groupAppointmentsByDate(
  list: ScheduleAppointmentItem[],
): Map<string, ScheduleAppointmentItem[]> {
  const map = new Map<string, ScheduleAppointmentItem[]>();
  for (const a of list) {
    const bucket = map.get(a.date) ?? [];
    bucket.push(a);
    map.set(a.date, bucket);
  }
  for (const [, rows] of map) {
    rows.sort((x, y) => x.time.localeCompare(y.time) || x.id.localeCompare(y.id));
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

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

  const [activeTab, setActiveTab] = useState<ProfileTab | null>(null);
  const [rangePreset, setRangePreset] = useState<PatientApptRangePreset>("default");
  const [apptRange, setApptRange] = useState(() => defaultPatientApptRange());
  const [apptState, setApptState] = useState<ApptLoadState>({ phase: "idle" });
  const [apptRefreshNonce, setApptRefreshNonce] = useState(0);
  const apptRequestSeq = useRef(0);

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

  useEffect(() => {
    if (patientId === null) {
      setApptState({ phase: "idle" });
      return;
    }
    if (activeTab !== "appointments") {
      setApptState({ phase: "idle" });
      return;
    }
    if (!base || bridgePhase !== "connected") {
      setApptState({ phase: "offline" });
      return;
    }

    const seq = ++apptRequestSeq.current;
    setApptState({ phase: "loading" });

    const client = createBridgeClient({ baseUrl: base, fetch: fetchImpl });
    let cancelled = false;

    void (async () => {
      try {
        const data = await client.getPatientAppointments(patientId, apptRange);
        if (cancelled || seq !== apptRequestSeq.current) return;
        if (data.appointments.length === 0) {
          setApptState({ phase: "empty" });
        } else {
          setApptState({ phase: "loaded", appointments: data.appointments });
        }
      } catch (e: unknown) {
        if (cancelled || seq !== apptRequestSeq.current) return;
        setApptState({ phase: "error", message: safePatientAppointmentsError(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, base, bridgePhase, fetchImpl, activeTab, apptRange, apptRefreshNonce]);

  useEffect(() => {
    if (patientId === null) {
      setActiveTab(null);
      setRangePreset("default");
      setApptRange(defaultPatientApptRange());
      setApptState({ phase: "idle" });
    }
  }, [patientId]);

  const activeLabel = useMemo(() => {
    if (state.phase === "loaded") {
      if (state.profile.active === true) return "Active";
      if (state.profile.active === false) return "Inactive";
    }
    return null;
  }, [state]);

  const groupedAppts = useMemo(() => {
    if (apptState.phase !== "loaded") return new Map<string, ScheduleAppointmentItem[]>();
    return groupAppointmentsByDate(apptState.appointments);
  }, [apptState]);

  const rangeHeading = formatApptRangeHeading(apptRange.from, apptRange.to);

  const applyRangePreset = (preset: PatientApptRangePreset) => {
    setRangePreset(preset);
    setApptRange(patientApptRangeForPreset(preset));
  };

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

            <nav className="app-patient-profile__tabs" aria-label="Patient sections">
              <ul className="app-patient-profile__tablist" role="tablist">
                <li role="presentation">
                  <button
                    type="button"
                    role="tab"
                    id="patient-tab-appointments"
                    aria-selected={activeTab === "appointments"}
                    aria-controls="patient-panel-appointments"
                    className={`app-patient-profile__tab ui-focusable${activeTab === "appointments" ? " app-patient-profile__tab--active" : ""}`}
                    onClick={() => setActiveTab("appointments")}
                  >
                    Appointments
                  </button>
                </li>
                {COMING_TABS.map((t) => (
                  <li key={t.id} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      className="app-patient-profile__tab ui-focusable"
                      disabled
                      aria-disabled="true"
                      title="Not available in this read-only preview"
                    >
                      {t.label}
                      <span className="app-patient-profile__tab-badge">Soon</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {activeTab === "appointments" ? (
              <section
                id="patient-panel-appointments"
                role="tabpanel"
                aria-labelledby="patient-tab-appointments"
                className="app-patient-profile__appts"
              >
                <p className="app-patient-profile__appts-lede">
                  Read-only appointment history. Schedule names and notes stay hidden.
                </p>

                <div className="app-patient-profile__appts-controls">
                  <div className="app-patient-profile__appts-presets" role="group" aria-label="Date range">
                    <Button
                      type="button"
                      variant={rangePreset === "past90" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("past90")}
                    >
                      Past 90 days
                    </Button>
                    <Button
                      type="button"
                      variant={rangePreset === "upcoming90" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("upcoming90")}
                    >
                      Upcoming 90 days
                    </Button>
                    <Button
                      type="button"
                      variant={rangePreset === "thisYear" ? "primary" : "secondary"}
                      className="ui-focusable"
                      onClick={() => applyRangePreset("thisYear")}
                    >
                      This year
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => {
                        setApptRefreshNonce((n) => n + 1);
                      }}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <p className="app-patient-profile__appts-range" aria-live="polite">
                  {rangeHeading}
                </p>

                {apptState.phase === "offline" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="Clinic service offline"
                    description="Connect the bridge to load appointment history."
                  />
                ) : apptState.phase === "loading" ? (
                  <p className="app-patient-profile__status" role="status" aria-live="polite">
                    Loading appointments…
                  </p>
                ) : apptState.phase === "error" ? (
                  <div className="app-patient-profile__error" role="alert">
                    <p>{apptState.message}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ui-focusable"
                      onClick={() => setApptRefreshNonce((n) => n + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : apptState.phase === "empty" ? (
                  <EmptyState
                    className="ui-empty--start app-patient-profile__empty"
                    title="No appointments found"
                    description="Nothing is scheduled in this date range. Try another preset or refresh after the bridge loads data."
                  />
                ) : apptState.phase === "loaded" ? (
                  <div className="app-patient-profile__appt-days">
                    {[...groupedAppts.entries()].map(([dateIso, list]) => (
                      <Card key={dateIso} className="app-patient-profile__appt-day">
                        <CardHeader>
                          <p className="ui-card__title app-card-title-lg app-patient-profile__appt-day-title">
                            {dateIso}
                          </p>
                        </CardHeader>
                        <CardBody>
                          <ul className="app-patient-profile__appt-list" aria-label={`Appointments on ${dateIso}`}>
                            {list.map((appt) => (
                              <li key={appt.id} className="app-patient-profile__appt-row">
                                <div className="app-patient-profile__appt-time">{appt.time}</div>
                                <div className="app-patient-profile__appt-main">
                                  <div className="app-patient-profile__appt-line1">
                                    <span className="app-patient-profile__appt-duration">
                                      {patientApptFormatDuration(appt)}
                                    </span>
                                    <span className="app-patient-profile__appt-meta">{patientApptRowMeta(appt)}</span>
                                  </div>
                                  <div className="app-patient-profile__appt-badges">
                                    <Badge
                                      variant={patientApptStatusBadgeVariant(appt.status)}
                                      semanticLabel={`Visit status code ${appt.status}`}
                                    >
                                      {patientApptStatusLabel(appt.status)}
                                    </Badge>
                                    {appt.missed ? (
                                      <Badge variant="danger" semanticLabel="Missed appointment">
                                        Missed
                                      </Badge>
                                    ) : null}
                                    {appt.hasComment ? (
                                      <Badge variant="neutral" semanticLabel="Internal note hidden">
                                        Note hidden
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState className="ui-empty--start" title="Nothing to show" description="Unexpected state." />
        )}
      </AppErrorBoundary>
    </div>
  );
}
