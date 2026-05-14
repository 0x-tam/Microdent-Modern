import { createBridgeClient } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ReadOnlyBanner } from "@microdent/ui";
import { probeBridgeHealth, describeBridgeHealthProbeError, type BridgeHealthPhase } from "./bridge-health.js";

export type { BridgeHealthPhase } from "./bridge-health.js";
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import { FixtureConnectionPanel } from "./FixtureConnectionPanel.js";
import { LegacyCatalogPanel } from "./LegacyCatalogPanel.js";
import { PatientProfilePanel } from "./PatientProfilePanel.js";
import { PatientSearchBar } from "./PatientSearchBar.js";
import { SchedulePanel } from "./SchedulePanel.js";

export const APP_NAV_MODULES = [
  { id: "today", label: "Today" },
  { id: "patients", label: "Patients" },
  { id: "schedule", label: "Schedule" },
  { id: "dental-chart", label: "Dental Chart" },
  { id: "treatments", label: "Treatments" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
] as const;

export type AppNavModuleId = (typeof APP_NAV_MODULES)[number]["id"];

export type AppShellProps = {
  /** Shown in the top bar; use a clinic name in production. */
  clinicLabel?: string;
  /** Optional slot above the main landmark (e.g. future alerts). */
  topSlot?: ReactNode;
  /**
   * When set, the shell calls GET /health on this bridge base URL (no trailing slash required).
   * Omit in tests or static render to skip network and stay offline.
   */
  bridgeBaseUrl?: string;
  /**
   * When true, failed health checks log the underlying error to the console (dev only recommended).
   * Never surfaces PHI; keep off in production patient contexts.
   */
  bridgeHealthLogDiagnostics?: boolean;
  /**
   * When true, shows a small dev-only line under the bridge status (URL, last check time, safe offline reason).
   * Do not enable in production patient contexts.
   */
  bridgeConnectionDiagnostics?: boolean;
};

const MODULE_PREVIEW: Record<
  AppNavModuleId,
  { summary: string; bullets: readonly string[] }
> = {
  today: {
    summary: "See who is on the schedule and what is next for your day.",
    bullets: ["Open appointments from one place", "Jump to the patient or chart when you are ready"],
  },
  patients: {
    summary: "Look up patients quickly and open their chart or next visit.",
    bullets: ["Search by name or chart number", "See the details that help you pick the right person"],
  },
  schedule: {
    summary: "Manage the day: who sits where, when, and with which provider.",
    bullets: ["Week and day views tuned for the front desk", "Clear visit status at a glance"],
  },
  "dental-chart": {
    summary: "Review and record what you see in the mouth with a clear tooth chart.",
    bullets: ["Chart by tooth and surface", "Keep clinical notes easy to find later"],
  },
  treatments: {
    summary: "See planned care, phases, and estimates in one place.",
    bullets: ["Share plans with patients in plain language", "Connect plans to visits and payments when enabled"],
  },
  payments: {
    summary: "Understand balances, insurance, and what the family owes.",
    bullets: ["Ledger lines in date order", "Highlights when something needs a follow-up"],
  },
  reports: {
    summary: "Run the lists and summaries your clinic relies on.",
    bullets: ["Day sheets, aging, and activity by provider", "Filters that match how you already work"],
  },
  settings: {
    summary: "Set up people, rooms, hours, and how Microdent fits your clinic.",
    bullets: ["Users and roles", "Locations and schedule templates"],
  },
};

function moduleLabel(id: AppNavModuleId): string {
  const m = APP_NAV_MODULES.find((x) => x.id === id);
  return m?.label ?? id;
}

function formatTodayLine(): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date());
  } catch {
    return "Today";
  }
}

function ModuleHome({
  moduleId,
  onOpenModule,
  onBackToday,
}: {
  moduleId: AppNavModuleId;
  onOpenModule: (id: AppNavModuleId) => void;
  onBackToday: () => void;
}) {
  const copy = MODULE_PREVIEW[moduleId];
  return (
    <div className="app-module-home">
      <div className="app-module-home__header">
        <p className="app-module-home__summary">
          <strong>{moduleLabel(moduleId)}</strong> — {copy.summary}
        </p>
      </div>

      <ul className="app-module-home__bullets" aria-label={`What ${moduleLabel(moduleId)} will include`}>
        {copy.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <div className="app-module-home__actions">
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
        <Button type="button" variant="ghost" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
          Open schedule
        </Button>
      </div>

      <AppErrorBoundary>
        <EmptyState
          className="ui-empty--start"
          title="Nothing to show yet"
          description="When this area is turned on for your clinic, your team's work will show up here."
        />
      </AppErrorBoundary>
    </div>
  );
}

function DashboardHome({
  onOpenModule,
  bridgeBaseUrl,
  bridgePhase,
}: {
  onOpenModule: (id: AppNavModuleId) => void;
  bridgeBaseUrl?: string;
  bridgePhase: BridgeHealthPhase;
}) {
  return (
    <div className="app-dashboard">
      <p className="app-dashboard__kicker">
        <span className="app-dashboard__date">{formatTodayLine()}</span>
      </p>

      <div className="app-dashboard__layout">
        <div className="app-dashboard__primary">
          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Today&apos;s appointments</p>
            </CardHeader>
            <CardBody>
              <ul className="app-appt-list" aria-label="Example appointments for layout only">
                <li className="app-appt-list__row">
                  <span className="app-appt-list__time">8:00</span>
                  <div className="app-appt-list__main">
                    <span className="app-appt-list__patient">Sample patient</span>
                    <span className="app-appt-list__visit">Cleaning · Chair 1</span>
                  </div>
                  <Badge variant="success" semanticLabel="Visit status: confirmed (example)">
                    Confirmed
                  </Badge>
                </li>
                <li className="app-appt-list__row">
                  <span className="app-appt-list__time">9:30</span>
                  <div className="app-appt-list__main">
                    <span className="app-appt-list__patient">Sample patient</span>
                    <span className="app-appt-list__visit">Exam · Chair 2</span>
                  </div>
                  <Badge variant="info" semanticLabel="Visit status: scheduled (example)">
                    Scheduled
                  </Badge>
                </li>
                <li className="app-appt-list__row">
                  <span className="app-appt-list__time">11:15</span>
                  <div className="app-appt-list__main">
                    <span className="app-appt-list__patient">Sample patient</span>
                    <span className="app-appt-list__visit">New patient visit · Chair 1</span>
                  </div>
                  <Badge variant="info" semanticLabel="Visit status: scheduled (example)">
                    Scheduled
                  </Badge>
                </li>
                <li className="app-appt-list__row">
                  <span className="app-appt-list__time">1:00 PM</span>
                  <div className="app-appt-list__main">
                    <span className="app-appt-list__patient">Sample patient</span>
                    <span className="app-appt-list__visit">Filling · Chair 3</span>
                  </div>
                  <Badge variant="warning" semanticLabel="Reminder: verify benefits (example)">
                    Check benefits
                  </Badge>
                </li>
                <li className="app-appt-list__row">
                  <span className="app-appt-list__time">2:45</span>
                  <div className="app-appt-list__main">
                    <span className="app-appt-list__patient">Sample patient</span>
                    <span className="app-appt-list__visit">Child checkup · Chair 2</span>
                  </div>
                  <Badge variant="success" semanticLabel="Visit status: confirmed (example)">
                    Confirmed
                  </Badge>
                </li>
              </ul>
              <div className="app-appt-list__footer">
                <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
                  Open schedule
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="app-dashboard__aside" aria-label="Next visit and shortcuts">
          <Card className="app-next-patient-card">
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Next appointment</p>
            </CardHeader>
            <CardBody>
              <p className="app-next-patient__time">11:15</p>
              <p className="app-next-patient__name">Sample patient</p>
              <p className="app-next-patient__detail">New patient visit · Chair 1</p>
              <Button type="button" variant="primary" className="ui-focusable app-next-patient__btn" onClick={() => onOpenModule("patients")}>
                Open Patients
              </Button>
              <p className="app-next-patient__hint">Use Find a patient in the top bar when the clinic service is connected.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Quick actions</p>
            </CardHeader>
            <CardBody>
              <div className="app-quick-actions">
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  disabled
                  title="Not available in this preview"
                >
                  Find patient
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onOpenModule("schedule")}
                >
                  Open schedule
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  onClick={() => onOpenModule("dental-chart")}
                >
                  Review chart
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="ui-focusable app-quick-actions__btn"
                  disabled
                  title="Recording payments is read-only in this preview"
                >
                  Record payment
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="ui-card__title app-card-title-lg">Reminders</p>
            </CardHeader>
            <CardBody>
              <ul className="app-reminder-list">
                <li>Hygiene recall list for next week — review when Reports is on.</li>
                <li>One benefit check pending for a visit this afternoon (example).</li>
              </ul>
            </CardBody>
          </Card>

          <LegacyCatalogPanel bridgeBaseUrl={bridgeBaseUrl} bridgePhase={bridgePhase} />
          <FixtureConnectionPanel
            bridgeBaseUrl={bridgeBaseUrl}
            bridgePhase={bridgePhase}
            className="app-fixture-panel--deemphasized"
          />
        </aside>
      </div>
    </div>
  );
}

function formatDevCheckTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

/**
 * Application shell: top bar (optional bridge health via GET /health), read-only banner, sidebar (local state),
 * and a main canvas with an error boundary.
 *
 * **Styles:** the host app must import `@microdent/ui/tokens.css`, `@microdent/ui/components.css`,
 * and `@microdent/app/app-shell.css` before rendering.
 */
export function AppShell({
  clinicLabel = "Main clinic",
  topSlot,
  bridgeBaseUrl,
  bridgeHealthLogDiagnostics = false,
  bridgeConnectionDiagnostics = false,
}: AppShellProps) {
  const [active, setActive] = useState<AppNavModuleId>("today");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [bridgePhase, setBridgePhase] = useState<BridgeHealthPhase>(() => (bridgeBaseUrl?.trim() ? "checking" : "offline"));
  const [lastHealthCheckAt, setLastHealthCheckAt] = useState<number | null>(null);
  const [lastHealthOfflineReason, setLastHealthOfflineReason] = useState<string | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<string>("—");

  const mainHeadingId = "app-main-heading";

  const runBridgeHealthCheck = useCallback(async () => {
    if (!bridgeBaseUrl?.trim()) {
      setBridgePhase("offline");
      setLastHealthCheckAt(null);
      setLastHealthOfflineReason(null);
      return;
    }
    setBridgePhase("checking");
    setLastHealthOfflineReason(null);
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim() });
    const probe = await probeBridgeHealth(client);
    setLastHealthCheckAt(Date.now());
    if (probe.status === "connected") {
      setBridgePhase("connected");
      setLastHealthOfflineReason(null);
      return;
    }
    setBridgePhase("offline");
    setLastHealthOfflineReason(describeBridgeHealthProbeError(probe.error));
    if (bridgeHealthLogDiagnostics && probe.error !== undefined) {
      console.warn("[Microdent] Bridge health check did not succeed", probe.error);
    }
  }, [bridgeBaseUrl, bridgeHealthLogDiagnostics]);

  useEffect(() => {
    if (!bridgeBaseUrl?.trim()) {
      setBridgePhase("offline");
      setLastHealthCheckAt(null);
      setLastHealthOfflineReason(null);
      return;
    }
    void runBridgeHealthCheck();
  }, [bridgeBaseUrl, runBridgeHealthCheck]);

  useEffect(() => {
    if (!bridgeConnectionDiagnostics) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    setPreviewOrigin(window.location.origin);
  }, [bridgeConnectionDiagnostics]);

  const sidebar = useMemo(
    () => (
      <ul className="app-sidebar__nav">
        {APP_NAV_MODULES.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={`app-sidebar__btn ui-focusable app-sidebar__btn--${m.id}`}
              aria-current={active === m.id ? "true" : undefined}
              aria-controls="app-main-region"
              onClick={() => setActive(m.id)}
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    ),
    [active],
  );

  return (
    <div className="app-shell">
      <header className="app-topbar" role="banner">
        <div className="app-topbar__brand">
          <h1 className="app-brand">Microdent</h1>
          <span className="app-topbar__clinic">{clinicLabel}</span>
        </div>

        <div className="app-topbar__search" role="search">
          <PatientSearchBar
            bridgePhase={bridgePhase}
            bridgeBaseUrl={bridgeBaseUrl}
            selectedPatientId={selectedPatientId}
            onPatientRecordSelect={(hit) => {
              setSelectedPatientId(hit.patientId);
              setActive("patients");
            }}
            onPatientSelectionClear={() => setSelectedPatientId(null)}
          />
        </div>

        <div className="app-topbar__status-wrap">
          <div className="app-topbar__status-row">
            <div
              className={`app-topbar__status app-topbar__status--${bridgePhase}`}
              role="status"
              aria-live="polite"
              aria-label={
                bridgePhase === "connected"
                  ? "Clinic service: connected"
                  : bridgePhase === "checking"
                    ? "Clinic service: checking"
                    : "Clinic service: offline"
              }
            >
              <span className="app-topbar__status-dot" aria-hidden />
              <span className="app-topbar__status-label">
                {bridgePhase === "connected"
                  ? "Connected"
                  : bridgePhase === "checking"
                    ? "Checking…"
                    : "Offline"}
              </span>
            </div>
            {bridgeBaseUrl?.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="compact"
                className="ui-focusable app-topbar__refresh"
                onClick={() => void runBridgeHealthCheck()}
              >
                Refresh
              </Button>
            ) : null}
          </div>
          {bridgeConnectionDiagnostics && bridgeBaseUrl?.trim() ? (
            <div className="app-topbar__bridge-diag" role="note" aria-label="Development bridge connection details">
              <div className="app-topbar__bridge-diag__line">App origin: {previewOrigin}</div>
              <div className="app-topbar__bridge-diag__line">Bridge URL: {bridgeBaseUrl.trim()}</div>
              <div className="app-topbar__bridge-diag__line">
                Last check:{" "}
                {lastHealthCheckAt !== null ? formatDevCheckTime(lastHealthCheckAt) : "—"}
              </div>
              {bridgePhase === "offline" && lastHealthOfflineReason ? (
                <div className="app-topbar__bridge-diag__line app-topbar__bridge-diag__reason">{lastHealthOfflineReason}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="app-shell__banner">
        <ReadOnlyBanner label="Read-only mode" className="ui-readonly-banner--compact">
          This preview cannot change clinic data.
        </ReadOnlyBanner>
      </div>

      {topSlot}

      <div className="app-shell__body">
        <aside className="app-sidebar" aria-labelledby="sidebar-nav-label">
          <p id="sidebar-nav-label" className="app-sr-only">
            Main navigation
          </p>
          <nav aria-labelledby="sidebar-nav-label">{sidebar}</nav>
        </aside>

        <main className="app-main" id="app-main-region" role="main" aria-labelledby={mainHeadingId}>
          <div className="app-main__inner">
            <div className="app-main__head">
              <h2 className="app-main__heading" id={mainHeadingId}>
                {moduleLabel(active)}
              </h2>
              {active === "today" ? (
                <p className="app-main__lede">Who is on the schedule, what is next, and where to go next.</p>
              ) : active === "schedule" ? (
                <p className="app-main__lede">
                  Read-only view of appointments from your copied data. Names and notes stay off this screen.
                </p>
              ) : active === "patients" ? (
                <p className="app-main__lede">
                  Read-only summary from your copied data. Search in the top bar, pick a patient, and only safe fields load
                  here — no address, insurance, or clinical notes in this preview.
                </p>
              ) : (
                <p className="app-main__lede">Overview for {moduleLabel(active)}.</p>
              )}
            </div>

            <div className="app-main__content">
              {active === "today" ? (
                <DashboardHome onOpenModule={setActive} bridgeBaseUrl={bridgeBaseUrl} bridgePhase={bridgePhase} />
              ) : active === "schedule" ? (
                <SchedulePanel
                  isActive={active === "schedule"}
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  onBackToday={() => setActive("today")}
                />
              ) : active === "patients" ? (
                <PatientProfilePanel
                  patientId={selectedPatientId}
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  onBackToday={() => setActive("today")}
                  onClearPatient={() => setSelectedPatientId(null)}
                />
              ) : (
                <ModuleHome moduleId={active} onOpenModule={setActive} onBackToday={() => setActive("today")} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
