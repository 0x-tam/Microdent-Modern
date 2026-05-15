import { createBridgeClient } from "@microdent/bridge-client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, EmptyState, ReadOnlyBanner } from "@microdent/ui";
import { probeBridgeHealth, describeBridgeHealthProbeError, type BridgeHealthPhase } from "./bridge-health.js";
import {
  MODULE_PLACEHOLDER_DESCRIPTION,
  MODULE_PLACEHOLDER_TITLE,
  READ_ONLY_BANNER_BODY,
  READ_ONLY_CONNECTED_LABEL,
  READ_ONLY_MODE_LABEL,
  READ_ONLY_VIEWER_LABEL,
} from "./read-only-ui-copy.js";

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
import { AppErrorBoundary } from "./AppErrorBoundary.js";
import { PatientProfilePanel } from "./PatientProfilePanel.js";
import { PatientSearchBar } from "./PatientSearchBar.js";
import { SchedulePanel } from "./SchedulePanel.js";
import { DashboardHome } from "./today-dashboard.js";
import { APP_NAV_MODULES, type AppNavModuleId } from "./app-nav-modules.js";

export { APP_NAV_MODULES, type AppNavModuleId } from "./app-nav-modules.js";

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
    summary: "Browse odontogram rows from your copied data in read-only mode.",
    bullets: ["Open a patient and use the Chart tab", "Chart memos and clinical labels stay hidden"],
  },
  treatments: {
    summary: "Review procedure history with safe fields only in the patient record.",
    bullets: ["Open a patient and use the Treatments tab", "Memos, fees, and raw rows stay hidden"],
  },
  payments: {
    summary: "Review ledger metadata without exposing payment amounts in this viewer.",
    bullets: ["Open a patient and use the Ledger tab", "Amounts and memo text stay hidden"],
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
          title={MODULE_PLACEHOLDER_TITLE}
          description={MODULE_PLACEHOLDER_DESCRIPTION}
        />
      </AppErrorBoundary>
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
  mirrorConnectionDiagnostics = false,
  fetchImpl,
}: AppShellProps) {
  const [active, setActive] = useState<AppNavModuleId>("today");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [bridgePhase, setBridgePhase] = useState<BridgeHealthPhase>(() => (bridgeBaseUrl?.trim() ? "checking" : "offline"));
  const [lastHealthCheckAt, setLastHealthCheckAt] = useState<number | null>(null);
  const [lastHealthOfflineReason, setLastHealthOfflineReason] = useState<string | null>(null);
  const [previewOrigin, setPreviewOrigin] = useState<string>("—");
  const [mirrorDiagLabel, setMirrorDiagLabel] = useState<string | null>(null);

  const mainHeadingId = "app-main-heading";

  const displayClinicLabel = resolveShellClinicLabel(bridgePhase, clinicLabel);

  const runBridgeHealthCheck = useCallback(async () => {
    if (!bridgeBaseUrl?.trim()) {
      setBridgePhase("offline");
      setLastHealthCheckAt(null);
      setLastHealthOfflineReason(null);
      return;
    }
    setBridgePhase("checking");
    setLastHealthOfflineReason(null);
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim(), fetch: fetchImpl });
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
  }, [bridgeBaseUrl, bridgeHealthLogDiagnostics, fetchImpl]);

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

  useEffect(() => {
    if (!mirrorConnectionDiagnostics || !bridgeBaseUrl?.trim()) {
      setMirrorDiagLabel(null);
      return;
    }
    if (bridgePhase !== "connected") {
      setMirrorDiagLabel(null);
      return;
    }
    let cancelled = false;
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim(), fetch: fetchImpl });
    void client
      .getMirrorStatus()
      .then((status) => {
        if (cancelled) return;
        setMirrorDiagLabel(resolveMirrorDiagnosticLabel(true, "connected", status.sqliteUsable));
      })
      .catch(() => {
        if (!cancelled) setMirrorDiagLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mirrorConnectionDiagnostics, bridgeBaseUrl, bridgePhase, fetchImpl]);

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
          <span className="app-topbar__clinic">{displayClinicLabel}</span>
        </div>

        <div className="app-topbar__search" role="search">
          <PatientSearchBar
            bridgePhase={bridgePhase}
            bridgeBaseUrl={bridgeBaseUrl}
            selectedPatientId={selectedPatientId}
            fetchImpl={fetchImpl}
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
              {mirrorConnectionDiagnostics && mirrorDiagLabel ? (
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
                  Day and week views from your copied schedule. Patient names use a safe summary; notes and phones stay hidden.
                </p>
              ) : active === "patients" ? (
                <p className="app-main__lede">
                  Search by name or chart number to open a record — or use the top bar. Browse summary, visits, medical screening,
                  treatments, chart, and ledger read-only; sensitive fields stay hidden.
                </p>
              ) : (
                <p className="app-main__lede">Overview for {moduleLabel(active)}.</p>
              )}
            </div>

            <div className="app-main__content">
              {active === "today" ? (
                <DashboardHome
                  onOpenModule={setActive}
                  bridgeBaseUrl={bridgeBaseUrl}
                  bridgePhase={bridgePhase}
                  fetchImpl={fetchImpl}
                />
              ) : active === "schedule" ? (
                <SchedulePanel
                  isActive={active === "schedule"}
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  fetchImpl={fetchImpl}
                  onBackToday={() => setActive("today")}
                />
              ) : active === "patients" ? (
                <PatientProfilePanel
                  patientId={selectedPatientId}
                  bridgePhase={bridgePhase}
                  bridgeBaseUrl={bridgeBaseUrl}
                  fetchImpl={fetchImpl}
                  onBackToday={() => setActive("today")}
                  onClearPatient={() => setSelectedPatientId(null)}
                  onPatientRecordSelect={(hit) => setSelectedPatientId(hit.patientId)}
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
