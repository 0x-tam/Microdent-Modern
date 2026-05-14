import { createBridgeClient } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Card, CardBody, CardHeader, EmptyState, ReadOnlyBanner } from "@microdent/ui";
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
  /**
   * Shown in the top bar when set (e.g. a named clinic in tests).
   * When omitted, the label follows bridge status: connected → copied-data line; otherwise read-only preview.
   */
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

const COMING_NEXT_COPY: Record<
  Exclude<AppNavModuleId, "today" | "patients" | "schedule">,
  { title: string; description: string }
> = {
  "dental-chart": {
    title: "Dental chart — coming next",
    description:
      "Dental chart view is coming next. No chart data is shown yet. This area will stay read-only in this phase.",
  },
  treatments: {
    title: "Treatments — coming next",
    description: "Treatment history is coming next. No treatment data is shown yet.",
  },
  payments: {
    title: "Payments — coming next",
    description: "Payments and ledger view are coming next. No payment data is shown yet.",
  },
  reports: {
    title: "Reports — coming later",
    description: "Reports are coming later. No report data is shown yet.",
  },
  settings: {
    title: "Settings",
    description: "Settings are not editable in this read-only preview.",
  },
};

/** Exported for unit tests. */
export function resolveShellClinicLabel(bridgePhase: BridgeHealthPhase, clinicLabel?: string): string {
  const trimmed = clinicLabel?.trim();
  if (trimmed) {
    return trimmed;
  }
  return bridgePhase === "connected" ? "Connected to copied clinic data" : "Read-only preview";
}

function moduleLabel(id: AppNavModuleId): string {
  const m = APP_NAV_MODULES.find((x) => x.id === id);
  return m?.label ?? id;
}

function mainLedeText(active: AppNavModuleId): string {
  switch (active) {
    case "today":
      return "Today’s dashboard is still being wired. Use Schedule for the live read-only appointment list.";
    case "schedule":
      return "Read-only view of appointments from your copied data. Names and notes stay off this screen.";
    case "patients":
      return "Read-only summary from your copied data. Search in the top bar, pick a patient, and only safe fields load here — no address, insurance, or clinical notes in this preview.";
    case "dental-chart":
      return "Dental charting is not available yet in this preview.";
    case "treatments":
      return "Treatment history is not available yet in this preview.";
    case "payments":
      return "Payments and ledger views are not available yet in this preview.";
    case "reports":
      return "Reports are not available yet in this preview.";
    case "settings":
      return "Settings are view-only in this preview; nothing here can be changed.";
    default: {
      const _x: never = active;
      return _x;
    }
  }
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

function ModuleComingNext({
  moduleId,
  onOpenModule,
  onBackToday,
}: {
  moduleId: Exclude<AppNavModuleId, "today" | "patients" | "schedule">;
  onOpenModule: (id: AppNavModuleId) => void;
  onBackToday: () => void;
}) {
  const copy = COMING_NEXT_COPY[moduleId];
  return (
    <div className="app-module-home">
      <AppErrorBoundary>
        <EmptyState className="ui-empty--start" title={copy.title} description={copy.description} />
      </AppErrorBoundary>

      <div className="app-module-home__actions">
        <Button type="button" variant="secondary" className="ui-focusable" onClick={onBackToday}>
          Back to Today
        </Button>
        <Button type="button" variant="ghost" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
          Open schedule
        </Button>
      </div>
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
              <p className="ui-card__title app-card-title-lg">Today&apos;s schedule</p>
            </CardHeader>
            <CardBody>
              <AppErrorBoundary>
                <EmptyState
                  className="ui-empty--start"
                  title="Schedule not on this page yet"
                  description="Today's real schedule will load here once the dashboard is wired. Until then, open Schedule for read-only appointments (safe fields only)."
                />
              </AppErrorBoundary>
              <div className="app-appt-list__footer">
                <Button type="button" variant="secondary" className="ui-focusable" onClick={() => onOpenModule("schedule")}>
                  Open schedule
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="app-dashboard__aside" aria-label="Shortcuts and developer diagnostics">
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
                  onClick={() => onOpenModule("patients")}
                  title="Opens the Patients area; search stays in the top bar"
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
                  title="Payments are not available in this read-only preview"
                >
                  Record payment
                </Button>
              </div>
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
  clinicLabel,
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

  const resolvedClinicLabel = resolveShellClinicLabel(bridgePhase, clinicLabel);

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
          <span className="app-topbar__clinic">{resolvedClinicLabel}</span>
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
        <p className="app-shell__privacy-note" role="note">
          Names, notes, and phone numbers are hidden in this preview.
        </p>
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
              <p className="app-main__lede">{mainLedeText(active)}</p>
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
                <ModuleComingNext
                  moduleId={active as Exclude<AppNavModuleId, "today" | "patients" | "schedule">}
                  onOpenModule={setActive}
                  onBackToday={() => setActive("today")}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
