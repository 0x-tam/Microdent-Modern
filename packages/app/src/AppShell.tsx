import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, ReadOnlyBanner } from "@microdent/ui";
import { probeBridgeHealth, describeBridgeHealthProbeError, type BridgeHealthPhase } from "./bridge-health.js";
import {
  READ_ONLY_BANNER_BODY,
  READ_ONLY_CONNECTED_LABEL,
  READ_ONLY_MODE_LABEL,
  READ_ONLY_VIEWER_LABEL,
} from "./read-only-ui-copy.js";
import { omitShellBannersDetailedInSettings, resolveShellStatusBanners } from "./shell-status-banners.js";

export function resolveMirrorDiagnosticLabel(
  enabled: boolean,
  phase: BridgeHealthPhase,
  sqliteUsable: boolean | null,
): string | null {
  if (!enabled || phase !== "connected" || sqliteUsable === null) return null;
  return sqliteUsable ? "Mirror: active" : "Mirror: DBF fallback";
}

export function resolveShellClinicLabel(phase: BridgeHealthPhase, clinicLabel?: string): string {
  const trimmed = clinicLabel?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  if (phase === "connected") return READ_ONLY_CONNECTED_LABEL;
  return READ_ONLY_VIEWER_LABEL;
}

export type { BridgeHealthPhase } from "./bridge-health.js";
import { PatientProfilePanel } from "./PatientProfilePanel.js";
import { PatientSearchBar } from "./PatientSearchBar.js";
import { SchedulePanel } from "./SchedulePanel.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { DashboardHome } from "./today-dashboard.js";
import {
  APP_SIDEBAR_MODULES,
  formatSelectedPatientContextLabel,
  getAppSidebarModule,
  resolveSidebarNavHint,
  type AppSidebarModuleId,
} from "./app-nav-modules.js";
import {
  pushSessionRecentPatient,
  type SessionRecentPatient,
} from "./session-recent-patients.js";

export {
  APP_NAV_MODULES,
  APP_NAV_UNSUPPORTED_MODULES,
  APP_SIDEBAR_MODULES,
  formatSelectedPatientContextLabel,
  getAppSidebarModule,
  resolveSidebarNavHint,
  type AppNavModuleId,
  type AppSidebarModuleId,
  type SelectedPatientContext,
} from "./app-nav-modules.js";

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
  /**
   * When true (dev only), fetches `GET /v1/mirror/status` and shows mirror vs DBF fallback under bridge diagnostics.
   */
  mirrorConnectionDiagnostics?: boolean;
  /**
   * Optional fetch override (tests); production uses the bound global `fetch` from the bridge client.
   */
  fetchImpl?: typeof fetch;
  /**
   * When true with Vite dev build, schedule rows show dev write diagnostics (dry-run / sandbox apply).
   */
  writeDiagnosticsActions?: boolean;
  /** @deprecated Use {@link writeDiagnosticsActions}. */
  appointmentStatusDryRunDev?: boolean;
  /**
   * When true, schedule may show the sandbox status write pilot when the bridge permits writes.
   * Default production builds should leave this false.
   */
  appointmentStatusWritePilot?: boolean;
  /**
   * When true, schedule/patient panels may show sandbox write pilot UI when the bridge permits writes.
   * Hosts pass `VITE_SANDBOX_WRITE_PILOT` (or legacy appointment status pilot flag).
   */
  sandboxWritePilot?: boolean;
};

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
  mirrorConnectionDiagnostics = false,
  fetchImpl,
  writeDiagnosticsActions = false,
  appointmentStatusDryRunDev = false,
  appointmentStatusWritePilot = false,
  sandboxWritePilot: sandboxWritePilotProp = false,
}: AppShellProps) {
  const sandboxWritePilot = sandboxWritePilotProp || appointmentStatusWritePilot;
  const devWriteActionsEnabled =
    import.meta.env.DEV && (writeDiagnosticsActions || appointmentStatusDryRunDev);
  const showBridgeConnectionDiagnostics = import.meta.env.DEV && bridgeConnectionDiagnostics;
  const showMirrorConnectionDiagnostics = import.meta.env.DEV && mirrorConnectionDiagnostics;
  const [active, setActive] = useState<AppSidebarModuleId>("today");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientDisplayName, setSelectedPatientDisplayName] = useState<string | null>(null);
  const [selectedPatientChartNumber, setSelectedPatientChartNumber] = useState<string | null>(null);
  const [recentPatients, setRecentPatients] = useState<SessionRecentPatient[]>([]);
  const [bridgePhase, setBridgePhase] = useState<BridgeHealthPhase>(() => (bridgeBaseUrl?.trim() ? "checking" : "offline"));
  const [lastHealthCheckAt, setLastHealthCheckAt] = useState<number | null>(null);
  const [lastHealthOfflineReason, setLastHealthOfflineReason] = useState<string | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<string>("—");
  const [mirrorDiagLabel, setMirrorDiagLabel] = useState<string | null>(null);
  const [mirrorStatus, setMirrorStatus] = useState<MirrorStatusResponse | null>(null);
  const [writeCapability, setWriteCapability] = useState<BridgeDevStatusResponse | null>(null);
  const [scheduleInitialDate, setScheduleInitialDate] = useState<string | null>(null);

  const mainHeadingId = "app-main-heading";

  const displayClinicLabel = resolveShellClinicLabel(bridgePhase, clinicLabel);

  const rememberRecentPatient = useCallback(
    (entry: { patientId: string; displayName: string; chartNumber: string | null }) => {
      const displayName = entry.displayName?.trim();
      if (!displayName) return;
      setRecentPatients((prev) =>
        pushSessionRecentPatient(prev, {
          patientId: entry.patientId,
          displayName,
          chartNumber: entry.chartNumber,
        }),
      );
    },
    [],
  );

  const handleOpenPatient = useCallback(
    (patientId: string, summary?: { displayName?: string | null; chartNumber?: string | null }) => {
      setSelectedPatientId(patientId);
      setSelectedPatientDisplayName(summary?.displayName ?? null);
      setSelectedPatientChartNumber(summary?.chartNumber ?? null);
      if (summary?.displayName?.trim()) {
        rememberRecentPatient({
          patientId,
          displayName: summary.displayName.trim(),
          chartNumber: summary.chartNumber ?? null,
        });
      }
      setActive("patients");
    },
    [rememberRecentPatient],
  );

  const handlePatientRecordSelect = useCallback(
    (hit: { patientId: string; displayName: string; chartNumber: string | null }) => {
      setSelectedPatientId(hit.patientId);
      setSelectedPatientDisplayName(hit.displayName);
      setSelectedPatientChartNumber(hit.chartNumber);
      rememberRecentPatient(hit);
      setActive("patients");
    },
    [rememberRecentPatient],
  );

  const handleRecentPatientSelect = useCallback(
    (entry: SessionRecentPatient) => {
      handlePatientRecordSelect(entry);
    },
    [handlePatientRecordSelect],
  );

  const handlePatientSelectionClear = useCallback(() => {
    setSelectedPatientId(null);
    setSelectedPatientDisplayName(null);
    setSelectedPatientChartNumber(null);
  }, []);

  const handleOpenScheduleAtDate = useCallback((dateIso: string) => {
    setScheduleInitialDate(dateIso);
    setActive("schedule");
  }, []);

  const handleScheduleInitialDateApplied = useCallback(() => {
    setScheduleInitialDate(null);
  }, []);

  const runBridgeHealthCheck = useCallback(
    async (isStale?: () => boolean) => {
      if (!bridgeBaseUrl?.trim()) {
        setBridgePhase("offline");
        setLastHealthCheckAt(null);
        setLastHealthOfflineReason(null);
        return;
      }
      if (isStale?.()) return;
      setBridgePhase("checking");
      setLastHealthOfflineReason(null);
      const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim(), fetch: fetchImpl });
      const probe = await probeBridgeHealth(client);
      if (isStale?.()) return;
      setLastHealthCheckAt(Date.now());
      if (probe.status === "connected") {
        setBridgePhase("connected");
        setLastHealthOfflineReason(null);
        return;
      }
      setBridgePhase("offline");
      setLastHealthOfflineReason(describeBridgeHealthProbeError(probe.error));
      if (bridgeHealthLogDiagnostics && probe.error !== undefined) {
        console.warn(
          "[Microdent] Bridge health check did not succeed:",
          describeBridgeHealthProbeError(probe.error),
        );
      }
    },
    [bridgeBaseUrl, bridgeHealthLogDiagnostics, fetchImpl],
  );

  useEffect(() => {
    if (!bridgeBaseUrl?.trim()) {
      setBridgePhase("offline");
      setLastHealthCheckAt(null);
      setLastHealthOfflineReason(null);
      return;
    }
    let cancelled = false;
    void runBridgeHealthCheck(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [bridgeBaseUrl, runBridgeHealthCheck]);

  useEffect(() => {
    if (!showBridgeConnectionDiagnostics) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    setPreviewOrigin(window.location.origin);
  }, [showBridgeConnectionDiagnostics]);

  useEffect(() => {
    if (!bridgeBaseUrl?.trim()) {
      setMirrorStatus(null);
      setMirrorDiagLabel(null);
      setWriteCapability(null);
      return;
    }
    if (bridgePhase !== "connected") {
      setMirrorStatus(null);
      setMirrorDiagLabel(null);
      setWriteCapability(null);
      return;
    }
    let cancelled = false;
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim(), fetch: fetchImpl });
    void client
      .getMirrorStatus()
      .then((status) => {
        if (cancelled) return;
        setMirrorStatus(status);
        setMirrorDiagLabel(
          showMirrorConnectionDiagnostics
            ? resolveMirrorDiagnosticLabel(true, "connected", status.sqliteUsable)
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setMirrorStatus(null);
          setMirrorDiagLabel(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showMirrorConnectionDiagnostics, bridgeBaseUrl, bridgePhase, fetchImpl]);

  useEffect(() => {
    if (!bridgeBaseUrl?.trim() || bridgePhase !== "connected") {
      setWriteCapability(null);
      return;
    }
    let cancelled = false;
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim(), fetch: fetchImpl });
    void client
      .getWriteCapability()
      .then((cap) => {
        if (!cancelled) setWriteCapability(cap);
      })
      .catch(() => {
        if (!cancelled) setWriteCapability(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bridgeBaseUrl, bridgePhase, fetchImpl]);

  const shellStatusBanners = useMemo(() => {
    const banners = resolveShellStatusBanners(bridgePhase, mirrorStatus, writeCapability);
    if (active !== "settings") return banners;
    return omitShellBannersDetailedInSettings(banners, bridgePhase, mirrorStatus, writeCapability);
  }, [active, bridgePhase, mirrorStatus, writeCapability]);

  const activeModule = useMemo(() => getAppSidebarModule(active), [active]);
  const sidebarNavHint = useMemo(() => resolveSidebarNavHint(), []);
  const selectedPatientContextLabel = useMemo(() => {
    if (!selectedPatientId) return null;
    return formatSelectedPatientContextLabel({
      patientId: selectedPatientId,
      displayName: selectedPatientDisplayName,
      chartNumber: selectedPatientChartNumber,
    });
  }, [selectedPatientChartNumber, selectedPatientDisplayName, selectedPatientId]);

  const sidebar = useMemo(
    () => (
      <ul className="app-sidebar__nav">
        {APP_SIDEBAR_MODULES.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={`app-sidebar__btn ui-focusable app-sidebar__btn--${m.id}`}
              aria-current={active === m.id ? "true" : undefined}
              aria-controls="app-main-region"
              title={m.sublabel}
              onClick={() => setActive(m.id)}
            >
              <span className="app-sidebar__btn-label">{m.label}</span>
              <span className="app-sidebar__btn-sublabel">{m.sublabel}</span>
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
          <span className="app-topbar__clinic">{displayClinicLabel}</span>
        </div>

        <div className="app-topbar__search" role="search">
          <PatientSearchBar
            bridgePhase={bridgePhase}
            bridgeBaseUrl={bridgeBaseUrl}
            selectedPatientId={selectedPatientId}
            selectedDisplayName={selectedPatientDisplayName}
            fetchImpl={fetchImpl}
            recentPatients={recentPatients}
            onRecentPatientSelect={handleRecentPatientSelect}
            onPatientRecordSelect={handlePatientRecordSelect}
            onPatientSelectionClear={handlePatientSelectionClear}
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
          {showBridgeConnectionDiagnostics && bridgeBaseUrl?.trim() ? (
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
              {showMirrorConnectionDiagnostics && mirrorDiagLabel ? (
                <div className="app-topbar__bridge-diag__line">{mirrorDiagLabel}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="app-shell__banner">
        <ReadOnlyBanner label={READ_ONLY_MODE_LABEL} className="ui-readonly-banner--compact">
          {READ_ONLY_BANNER_BODY}
        </ReadOnlyBanner>
      </div>

      {shellStatusBanners.map((banner) => (
        <div key={banner.key} className={`app-shell__status-banner app-shell__status-banner--${banner.tone}`}>
          <ReadOnlyBanner
            label={banner.label}
            className="ui-readonly-banner--compact app-shell__status-banner-inner"
          >
            {banner.body}
          </ReadOnlyBanner>
        </div>
      ))}

      {topSlot}

      <div className="app-shell__body">
        <aside className="app-sidebar" aria-labelledby="sidebar-nav-label">
          <p id="sidebar-nav-label" className="app-sr-only">
            Main navigation
          </p>
          <nav aria-labelledby="sidebar-nav-label">{sidebar}</nav>
          <p className="app-sidebar__hint" role="note">
            {sidebarNavHint}
          </p>
        </aside>

        <main className="app-main" id="app-main-region" role="main" aria-labelledby={mainHeadingId}>
          <div className="app-main__inner">
            <div className="app-main__head">
              <div className="app-main__head-row">
                <h2 className="app-main__heading" id={mainHeadingId}>
                  {activeModule.label}
                </h2>
                <div className="app-main__head-actions">
                  {active !== "today" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="compact"
                      className="ui-focusable app-main__back-today"
                      onClick={() => setActive("today")}
                    >
                      Back to Today
                    </Button>
                  ) : null}
                  {selectedPatientContextLabel ? (
                    <div
                      className="app-main__patient-context"
                      role="status"
                      aria-label={`Selected patient: ${selectedPatientContextLabel}`}
                    >
                      <button
                        type="button"
                        className="app-main__patient-context-chip ui-focusable"
                        onClick={() => setActive("patients")}
                      >
                        {selectedPatientContextLabel}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="compact"
                        className="ui-focusable app-main__patient-context-clear"
                        onClick={handlePatientSelectionClear}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="app-main__lede">{activeModule.description}</p>
            </div>

            <div className="app-main__content">
              {active === "today" ? (
                <DashboardHome
                  onOpenModule={setActive}
                  onOpenPatient={handleOpenPatient}
                  onOpenScheduleAtDate={handleOpenScheduleAtDate}
                  selectedPatientId={selectedPatientId}
                  selectedPatientDisplayName={selectedPatientDisplayName}
                  selectedPatientChartNumber={selectedPatientChartNumber}
                  recentPatients={recentPatients}
                  onRecentPatientSelect={handleRecentPatientSelect}
                  mirrorStatus={mirrorStatus}
                  bridgeBaseUrl={bridgeBaseUrl}
                  bridgePhase={bridgePhase}
                  fetchImpl={fetchImpl}
                  writeCapability={writeCapability}
                  sandboxWritePilot={sandboxWritePilot}
                  sessionRecentPatientCount={recentPatients.length}
                />
              ) : active === "schedule" ? (
                <SchedulePanel
                  isActive={active === "schedule"}
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  fetchImpl={fetchImpl}
                  writeDiagnosticsActions={devWriteActionsEnabled}
                  sandboxWritePilot={sandboxWritePilot}
                  initialDate={scheduleInitialDate}
                  onInitialDateApplied={handleScheduleInitialDateApplied}
                  onBackToday={() => setActive("today")}
                  onOpenPatient={handleOpenPatient}
                  mirrorStatus={mirrorStatus}
                />
              ) : active === "settings" ? (
                <SettingsPanel
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  fetchImpl={fetchImpl}
                  writeCapability={writeCapability}
                  mirrorStatus={mirrorStatus}
                  onMirrorStatusChange={setMirrorStatus}
                  sandboxWritePilot={sandboxWritePilot}
                  showConnectionDiagnostics={showBridgeConnectionDiagnostics}
                />
              ) : (
                <PatientProfilePanel
                  patientId={selectedPatientId}
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  fetchImpl={fetchImpl}
                  sandboxWritePilot={sandboxWritePilot}
                  writeCapability={writeCapability}
                  recentPatients={recentPatients}
                  onBackToday={() => setActive("today")}
                  onClearPatient={handlePatientSelectionClear}
                  onPatientRecordSelect={handlePatientRecordSelect}
                  onRecentPatientSelect={handleRecentPatientSelect}
                  onOpenScheduleAtDate={handleOpenScheduleAtDate}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
