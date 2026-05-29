import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge, Button } from "@microdent/ui";
import { ClinicPage, ClinicPageHero } from "./clinic-page.js";
import { ClinicPanel } from "./clinic-panel.js";
import { ClinicStatCard, type ClinicStatCardTone } from "./clinic-stat-card.js";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import { MASKED_PATH_HINT_EXAMPLES, maskOperatorPath } from "./mask-operator-path.js";
import {
  SETTINGS_BACKUP_READONLY_NOTE,
  SETTINGS_BACKUP_SECTION,
  SETTINGS_BACKUP_SETUP_BUTTON,
  SETTINGS_BACKUP_SETUP_HINT,
  SETTINGS_BRIDGE_CHECKING,
  SETTINGS_BRIDGE_CONNECTED,
  SETTINGS_BRIDGE_OFFLINE,
  SETTINGS_BRIDGE_SECTION,
  SETTINGS_BUILD_WINDOWS_DEFERRED_NOTICE,
  SETTINGS_DATA_PATHS_SECTION,
  SETTINGS_DESKTOP_BROWSER,
  SETTINGS_DESKTOP_FILE_PROTOCOL,
  SETTINGS_DESKTOP_SECTION,
  SETTINGS_DIAGNOSTICS_COLLAPSED_LABEL,
  SETTINGS_DIAGNOSTICS_EXPANDED_LABEL,
  SETTINGS_EDITING_DISABLED,
  SETTINGS_EDITING_DISABLED_EXPLAIN,
  SETTINGS_EDITING_DRY_RUN,
  SETTINGS_EDITING_DRY_RUN_EXPLAIN,
  SETTINGS_SECTION_EDITING_MODE,
  SETTINGS_SECTION_EDITING_MODE_LEDE,
  SETTINGS_EDITING_READ_ONLY,
  SETTINGS_EDITING_READ_ONLY_EXPLAIN,
  SETTINGS_EDITING_SANDBOX,
  SETTINGS_EDITING_SANDBOX_EXPLAIN,
  SETTINGS_EDITING_UNKNOWN,
  SETTINGS_FIELD_TEST_NOT_READY,
  SETTINGS_FIELD_TEST_PENDING,
  SETTINGS_FIELD_TEST_READY,
  SETTINGS_IMPORT_LOCAL_COPY_BUTTON,
  SETTINGS_IMPORT_LOCAL_COPY_HINT,
  SETTINGS_MIRROR_DOC_LINK,
  SETTINGS_MIRROR_IMPORTED_COUNT,
  SETTINGS_MIRROR_IMPORT_CLI,
  SETTINGS_MIRROR_IMPORT_COMMAND,
  SETTINGS_MIRROR_NO_RUNS,
  SETTINGS_MIRROR_REFRESH,
  SETTINGS_MIRROR_RUN_STATUS_FAILED,
  SETTINGS_MIRROR_RUN_STATUS_PARTIAL,
  SETTINGS_MIRROR_RUN_STATUS_RUNNING,
  SETTINGS_MIRROR_RUN_STATUS_SUCCESS,
  SETTINGS_MIRROR_SECTION,
  SETTINGS_MIRROR_DBF_SOURCE_TRUTH,
  SETTINGS_MIRROR_FRESHNESS_ACTIVE,
  SETTINGS_MIRROR_FRESHNESS_FALLBACK,
  SETTINGS_MIRROR_FRESHNESS_OFFLINE,
  SETTINGS_MIRROR_FRESHNESS_STALE,
  SETTINGS_MIRROR_FRESHNESS_UNKNOWN,
  SETTINGS_MIRROR_STALE_CALLOUT,
  SETTINGS_NEXT_STEP_LABEL,
  SETTINGS_NEXT_STEP_CHOOSE_DATA,
  SETTINGS_NEXT_STEP_CHOOSE_DATA_DONE,
  SETTINGS_NEXT_STEP_IMPORT_COPY,
  SETTINGS_NEXT_STEP_IMPORT_COPY_DONE,
  SETTINGS_NEXT_STEP_SETUP_BACKUP,
  SETTINGS_NEXT_STEP_SETUP_BACKUP_DONE,
  SETTINGS_NEXT_STEP_REVIEW_DATA,
  SETTINGS_NEXT_STEP_REVIEW_DATA_DONE,
  SETTINGS_NEXT_STEPS_TITLE,
  SETTINGS_NEXT_STEPS_LEDE,
  SETTINGS_OPEN_TODAY_BUTTON,
  SETTINGS_PANEL_LEDE,
  SETTINGS_PILOT_BUILD_APP_VERSION,
  SETTINGS_PILOT_BUILD_BUILT,
  SETTINGS_PILOT_BUILD_CHANNEL,
  SETTINGS_PILOT_BUILD_COMMIT,
  SETTINGS_PILOT_BUILD_LOADING,
  SETTINGS_PILOT_BUILD_PACKAGE_VERSION,
  SETTINGS_PILOT_BUILD_SECTION,
  SETTINGS_PILOT_BUILD_UNAVAILABLE,
  SETTINGS_PILOT_CHECKLIST_TITLE,
  SETTINGS_PILOT_NOTES_FOOTNOTE,
  SETTINGS_PILOT_NOTES_READINESS,
  SETTINGS_PILOT_NOTES_REMINDERS,
  SETTINGS_PILOT_NOTES_TITLE,
  SETTINGS_PILOT_READINESS_TITLE,
  SETTINGS_READINESS_BRIDGE_OFFLINE,
  SETTINGS_READINESS_FIELD_TEST_DOC_HINT,
  SETTINGS_READINESS_READ_ONLY,
  SETTINGS_READINESS_WRITES_ACTIVE,
  SETTINGS_SANDBOX_PILOT_OFF,
  SETTINGS_SANDBOX_PILOT_ON,
  SETTINGS_SANDBOX_SECTION,
  SETTINGS_SECTION_BACKUP,
  SETTINGS_SECTION_BACKUP_LEDE,
  SETTINGS_SECTION_BACKUP_READINESS,
  SETTINGS_SECTION_BACKUP_READINESS_LEDE,
  SETTINGS_SECTION_CLINIC_SERVICE,
  SETTINGS_SECTION_CLINIC_SERVICE_LEDE,
  SETTINGS_SECTION_DATA_SOURCE,
  SETTINGS_SECTION_DATA_SOURCE_LEDE,
  SETTINGS_SECTION_DIAGNOSTICS,
  SETTINGS_SECTION_DIAGNOSTICS_LEDE,
  SETTINGS_SECTION_EDITING,
  SETTINGS_SECTION_EDITING_LEDE,
  SETTINGS_SECTION_FIELD_TEST,
  SETTINGS_SECTION_FIELD_TEST_LEDE,
  SETTINGS_SECTION_LOCAL_COPY,
  SETTINGS_SECTION_LOCAL_COPY_LEDE,
  SETTINGS_SECTION_PACKAGE,
  SETTINGS_SECTION_PACKAGE_LEDE,
  SETTINGS_SERVICE_PORT_MASKED,
  SETTINGS_SERVICE_RESTART_ACTION,
  SETTINGS_SERVICE_RUNNING,
  SETTINGS_SERVICE_START_ACTION,
  SETTINGS_SERVICE_STOPPED,
  SETTINGS_SERVICE_UNKNOWN,
  SETTINGS_SETUP_RERUN_BUTTON,
  SETTINGS_SETUP_RERUN_HINT,
  SETTINGS_SQLITE_MIRROR_SECTION,
  SETTINGS_WRITE_SECTION,
} from "./read-only-ui-copy.js";
import {
  resolvePilotBuildMetadata,
  type PilotBuildMetadata,
} from "./pilot-build-metadata.js";
import {
  resolveBackupConfiguredStatus,
  resolveBackupReadinessSummary,
  resolveDataRootConfiguredStatus,
  resolveDataSourceStatus,
  resolveEditingModeSummary,
  resolvePilotReadinessSummary,
  resolvePilotReadinessChecklist,
  resolveSandboxValidityStatus,
  resolveServiceStatusSummary,
  resolveSqliteMirrorStatus,
  type SettingsStatusTone,
} from "./settings-status.js";
import {
  resolveSettingsOperatorNextStep,
  type SettingsCardKey,
} from "./settings-operator-next-step.js";
import {
  resolveSettingsDangerBanners,
  resolveWriteModeChip,
} from "./shell-status-banners.js";
import {
  CLINIC_FRIENDLY_BACKUP_NOT_NEEDED_READONLY,
  CLINIC_FRIENDLY_CHECKING,
  CLINIC_FRIENDLY_EDITING_LABEL,
  CLINIC_FRIENDLY_EDITING_SANDBOX,
  CLINIC_FRIENDLY_EDITING_UNKNOWN,
  CLINIC_FRIENDLY_LOCAL_COPY_LABEL,
  CLINIC_FRIENDLY_LOCAL_COPY_OFFLINE,
  CLINIC_FRIENDLY_LOCAL_COPY_READY,
  CLINIC_FRIENDLY_LOCAL_COPY_STALE,
  CLINIC_FRIENDLY_LOCAL_COPY_UNKNOWN,
  CLINIC_FRIENDLY_PREVIEW_ONLY,
  CLINIC_FRIENDLY_READ_ONLY,
  CLINIC_FRIENDLY_SERVICE_CONNECTED,
  CLINIC_FRIENDLY_SERVICE_LABEL,
  CLINIC_FRIENDLY_SERVICE_OFFLINE,
  friendlyBridgeStatus,
  friendlyEditingStatus,
  friendlyLocalCopyStatus,
} from "./clinic-friendly-copy.js";

export type SettingsPanelProps = {
  moduleTitle?: string;
  moduleDescription?: string;
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  writeCapability: BridgeDevStatusResponse | null;
  mirrorStatus: MirrorStatusResponse | null;
  onMirrorStatusChange: (status: MirrorStatusResponse | null) => void;
  /** When true, sandbox write pilot UI may appear elsewhere (from host env). */
  sandboxWritePilot?: boolean;
  showConnectionDiagnostics?: boolean;
  onOpenToday?: () => void;
};

const MIRROR_DOC_PATH = "docs/phase-4-mirror-import-operator.md";

function formatFinishedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function mirrorRunStatusLabel(status: MirrorStatusResponse["latestImportRuns"][number]["status"]): string {
  switch (status) {
    case "success":
      return SETTINGS_MIRROR_RUN_STATUS_SUCCESS;
    case "partial":
      return SETTINGS_MIRROR_RUN_STATUS_PARTIAL;
    case "failed":
      return SETTINGS_MIRROR_RUN_STATUS_FAILED;
    case "running":
      return SETTINGS_MIRROR_RUN_STATUS_RUNNING;
    default:
      return status;
  }
}

function mirrorRunBadgeVariant(
  status: MirrorStatusResponse["latestImportRuns"][number]["status"],
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "success":
      return "success";
    case "partial":
      return "warning";
    case "failed":
      return "danger";
    case "running":
      return "info";
    default:
      return "neutral";
  }
}

function isDesktopFileProtocol(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

function showDevPathHints(showConnectionDiagnostics: boolean): boolean {
  return import.meta.env.DEV && showConnectionDiagnostics;
}

function formatBuildTimestamp(iso: string): string {
  if (!iso.trim()) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function clinicStatTone(tone: SettingsStatusTone | BridgeHealthPhase): ClinicStatCardTone {
  switch (tone) {
    case "ok":
    case "connected":
      return "green";
    case "warn":
      return "amber";
    case "danger":
    case "offline":
      return "red";
    case "checking":
      return "cyan";
    default:
      return "neutral";
  }
}

function writeStatTone(writeCapability: BridgeDevStatusResponse | null): ClinicStatCardTone {
  const chip = resolveWriteModeChip(writeCapability);
  if (!chip) return "neutral";
  switch (chip.variant) {
    case "warning":
      return "amber";
    case "danger":
      return "red";
    default:
      return "blue";
  }
}

function statusPillTone(tone: SettingsStatusTone | BridgeHealthPhase): string {
  switch (tone) {
    case "ok":
    case "connected":
      return "ok";
    case "warn":
      return "warn";
    case "danger":
    case "offline":
      return "danger";
    case "checking":
      return "info";
    default:
      return "neutral";
  }
}

function resolveHeroReadinessBadge(
  bridgePhase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
): { label: string; tone: SettingsStatusTone } {
  if (bridgePhase !== "connected") {
    return { label: SETTINGS_READINESS_BRIDGE_OFFLINE, tone: "warn" };
  }
  if (writeCapability?.writeMode && writeCapability.writeMode !== "disabled") {
    return { label: SETTINGS_READINESS_WRITES_ACTIVE, tone: "danger" };
  }
  return { label: SETTINGS_READINESS_READ_ONLY, tone: "ok" };
}

function bridgeCardTone(bridgePhase: BridgeHealthPhase): SettingsStatusTone {
  if (bridgePhase === "connected") return "ok";
  if (bridgePhase === "checking") return "neutral";
  return "danger";
}

function writeCardTone(writeCapability: BridgeDevStatusResponse | null): SettingsStatusTone {
  const chip = resolveWriteModeChip(writeCapability);
  if (!chip) return "neutral";
  switch (chip.variant) {
    case "warning":
      return "warn";
    case "danger":
      return "danger";
    default:
      return "neutral";
  }
}

function mirrorCardTone(
  bridgePhase: BridgeHealthPhase,
  mirrorStale: boolean,
): SettingsStatusTone {
  if (bridgePhase !== "connected") return "neutral";
  if (mirrorStale) return "warn";
  return "ok";
}

function settingsPanelClassName(tone: SettingsStatusTone, opts?: { primary?: boolean; mirror?: boolean }): string {
  return [
    "clinic-settings-panel",
    "app-settings__card",
    `app-settings__card--${tone}`,
    opts?.primary ? "app-settings__card--primary" : "",
    opts?.mirror ? "app-settings__card--mirror" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function SettingsPanelStatusDot({ tone }: { tone: SettingsStatusTone }) {
  return (
    <span
      className={`app-settings__card/status-dot app-settings__card-status-dot--${tone}`}
      aria-hidden="true"
    />
  );
}

function SettingsStatusPill({ label, tone }: { label: string; tone: SettingsStatusTone | BridgeHealthPhase }) {
  return <span className={`clinic-status-pill clinic-status-pill--${statusPillTone(tone)}`}>{label}</span>;
}

type SettingsReadinessCardProps = {
  title: string;
  statusLabel: string;
  explanation: string;
  tone: SettingsStatusTone | BridgeHealthPhase;
  cardKey: SettingsCardKey;
  bridgePhase: BridgeHealthPhase;
  writeCapability: BridgeDevStatusResponse | null;
  mirrorStatus: MirrorStatusResponse | null;
  sandboxWritePilot?: boolean;
  statTone?: ClinicStatCardTone;
};

function SettingsReadinessCard({
  title,
  statusLabel,
  explanation,
  tone,
  cardKey,
  bridgePhase,
  writeCapability,
  mirrorStatus,
  sandboxWritePilot,
  statTone,
}: SettingsReadinessCardProps) {
  return (
    <div className="clinic-settings-readiness-card">
      <ClinicStatCard
        label={title}
        value={<SettingsStatusPill label={statusLabel} tone={tone} />}
        hint={explanation}
        tone={statTone ?? clinicStatTone(tone)}
      />
      <SettingsNextStep
        card={cardKey}
        bridgePhase={bridgePhase}
        writeCapability={writeCapability}
        mirrorStatus={mirrorStatus}
        sandboxWritePilot={sandboxWritePilot}
      />
    </div>
  );
}

type SettingsNextStepProps = {
  card: SettingsCardKey;
  bridgePhase: BridgeHealthPhase;
  writeCapability: BridgeDevStatusResponse | null;
  mirrorStatus: MirrorStatusResponse | null;
  sandboxWritePilot?: boolean;
};

function resolveSettingsMirrorFreshnessNote(
  bridgePhase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  nowMs: number,
): string {
  if (bridgePhase !== "connected") {
    return SETTINGS_MIRROR_FRESHNESS_OFFLINE;
  }
  if (mirrorStatus === null) {
    return SETTINGS_MIRROR_FRESHNESS_UNKNOWN;
  }
  if (!mirrorStatus.sqliteUsable) {
    return SETTINGS_MIRROR_FRESHNESS_FALLBACK;
  }
  if (isMirrorImportStale(mirrorStatus, nowMs)) {
    return SETTINGS_MIRROR_FRESHNESS_STALE;
  }
  return SETTINGS_MIRROR_FRESHNESS_ACTIVE;
}

type SettingsSectionProps = {
  title: string;
  lede: string;
  sectionId: string;
  children: ReactNode;
};

function SettingsSection({ title, lede, sectionId, children }: SettingsSectionProps) {
  return (
    <section
      className="clinic-settings-section"
      role="region"
      aria-labelledby={sectionId}
    >
      <h2 id={sectionId} className="clinic-settings-section__title">
        {title}
      </h2>
      <p className="clinic-settings-section__lede">{lede}</p>
      <div className="clinic-settings-section__grid">{children}</div>
    </section>
  );
}

function SettingsNextStep({
  card,
  bridgePhase,
  writeCapability,
  mirrorStatus,
  sandboxWritePilot,
}: SettingsNextStepProps) {
  const step = resolveSettingsOperatorNextStep(card, bridgePhase, writeCapability, mirrorStatus, {
    sandboxWritePilot,
  });
  if (!step) return null;
  return (
    <p className="app-settings__next-step" role="note">
      <strong>{SETTINGS_NEXT_STEP_LABEL}:</strong> {step}
    </p>
  );
}

export function SettingsPanel({
  moduleTitle = "Settings",
  moduleDescription,
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  writeCapability,
  mirrorStatus,
  onMirrorStatusChange,
  sandboxWritePilot = false,
  showConnectionDiagnostics = false,
  onOpenToday,
}: SettingsPanelProps) {
  const [mirrorRefreshing, setMirrorRefreshing] = useState(false);
  const [mirrorRefreshError, setMirrorRefreshError] = useState(false);
  const [pilotBuild, setPilotBuild] = useState<PilotBuildMetadata | null | undefined>(undefined);
  const [showBackupSetup, setShowBackupSetup] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<{
    status: "running" | "stopped";
    port: number | null;
    lastError: string | null;
  } | null>(null);

  // Fetch pilot build metadata
  useEffect(() => {
    let cancelled = false;
    void resolvePilotBuildMetadata(fetchImpl).then((metadata) => {
      if (!cancelled) setPilotBuild(metadata);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  // Query service status via Electron IPC when available
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;
    let cancelled = false;
    void window.electronAPI.getServiceStatus().then((status) => {
      if (!cancelled) setServiceStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const writeChip = resolveWriteModeChip(writeCapability);
  const dataRootStatus = resolveDataRootConfiguredStatus(writeCapability);
  const dataSourceStatus = resolveDataSourceStatus(writeCapability);
  const sandboxStatus = resolveSandboxValidityStatus(writeCapability);
  const backupStatus = resolveBackupConfiguredStatus(writeCapability);
  const backupReadiness = resolveBackupReadinessSummary(writeCapability);
  const sqliteMirrorStatus = resolveSqliteMirrorStatus(bridgePhase, mirrorStatus, writeCapability);
  const pilotReadiness = resolvePilotReadinessSummary(bridgePhase, writeCapability, mirrorStatus);
  const pilotChecklist = resolvePilotReadinessChecklist(bridgePhase, writeCapability, mirrorStatus, {
    sandboxWritePilot,
  });
  const dangerBanners = resolveSettingsDangerBanners(bridgePhase, mirrorStatus, writeCapability);
  const mirrorStale =
    bridgePhase === "connected" && mirrorStatus !== null && isMirrorImportStale(mirrorStatus, Date.now());
  const devHints = showDevPathHints(showConnectionDiagnostics);

  // Clinic-friendly summaries for the control center sections
  const serviceSummary = resolveServiceStatusSummary(bridgePhase, serviceStatus);
  const editingModeSummary = resolveEditingModeSummary(writeCapability, sandboxWritePilot);
  const friendlyBridge = friendlyBridgeStatus(bridgePhase);
  const friendlyLocalCopy = friendlyLocalCopyStatus(bridgePhase, mirrorStatus);
  const friendlyEditing = friendlyEditingStatus(writeCapability, sandboxWritePilot);

  const bridgeLabel =
    bridgePhase === "connected"
      ? SETTINGS_BRIDGE_CONNECTED
      : bridgePhase === "checking"
        ? SETTINGS_BRIDGE_CHECKING
        : SETTINGS_BRIDGE_OFFLINE;

  const refreshMirrorStatus = useCallback(async () => {
    if (!bridgeBaseUrl?.trim() || bridgePhase !== "connected") {
      return;
    }
    setMirrorRefreshing(true);
    setMirrorRefreshError(false);
    const client = createBridgeClient({ baseUrl: bridgeBaseUrl.trim(), fetch: fetchImpl });
    try {
      const status = await client.getMirrorStatus();
      onMirrorStatusChange(status);
    } catch {
      setMirrorRefreshError(true);
    } finally {
      setMirrorRefreshing(false);
    }
  }, [bridgeBaseUrl, bridgePhase, fetchImpl, onMirrorStatusChange]);

  const importedCount = mirrorStatus?.importedTables.length ?? 0;
  const runs = mirrorStatus?.latestImportRuns ?? [];
  const writeHeroValue = writeChip?.label ?? "Connect the clinic service";
  const mirrorHeroValue = sqliteMirrorStatus.label;
  const heroBadge = resolveHeroReadinessBadge(bridgePhase, writeCapability);
  const buildReadinessLabel =
    pilotBuild === undefined
      ? "Loading"
      : pilotBuild === null
        ? "Unavailable"
        : pilotBuild.packageVersion;
  const buildReadinessExplanation =
    pilotBuild === undefined
      ? SETTINGS_PILOT_BUILD_LOADING
      : pilotBuild === null
        ? SETTINGS_PILOT_BUILD_UNAVAILABLE
        : `${SETTINGS_PILOT_BUILD_CHANNEL}: ${pilotBuild.releaseChannel}`;
  const buildReadinessTone: SettingsStatusTone =
    pilotBuild === undefined ? "neutral" : pilotBuild === null ? "warn" : "ok";
  const mirrorFreshnessNote = resolveSettingsMirrorFreshnessNote(bridgePhase, mirrorStatus, Date.now());
  const showBackupReadonlyNote =
    writeCapability !== null &&
    writeCapability.writeMode === "disabled" &&
    !writeCapability.backupDirConfigured;

  // Field test readiness badge
  const fieldTestBadge =
    bridgePhase === "connected" &&
    writeCapability?.dataRootConfigured &&
    writeCapability.backupDirConfigured &&
    mirrorStatus?.sqliteUsable
      ? { label: SETTINGS_FIELD_TEST_READY, tone: "ok" as SettingsStatusTone }
      : bridgePhase === "connected"
        ? { label: SETTINGS_FIELD_TEST_PENDING, tone: "warn" as SettingsStatusTone }
        : { label: SETTINGS_FIELD_TEST_NOT_READY, tone: "danger" as SettingsStatusTone };

  return (
    <ClinicPage className="clinic-settings-page app-settings" aria-labelledby="settings-panel-title">
      <ClinicPageHero
        title={moduleTitle}
        subtitle={moduleDescription ?? SETTINGS_PANEL_LEDE}
        meta={
          <>
            <span className={`clinic-status-pill clinic-status-pill--${statusPillTone(heroBadge.tone)}`}>
              {heroBadge.label}
            </span>
            {onOpenToday ? (
              <Button type="button" variant="secondary" className="ui-focusable" onClick={onOpenToday}>
                {SETTINGS_OPEN_TODAY_BUTTON}
              </Button>
            ) : null}
          </>
        }
      />
      <h2 id="settings-panel-title" className="app-sr-only">
        {moduleTitle}
      </h2>

      {/* ----- Operator Control Center: System Status ----- */}
      <section className="app-settings__system-status" role="region" aria-labelledby="system-status-heading">
        <div className="app-settings__system-status-header">
          <h2 id="system-status-heading" className="app-settings__system-status-title">
            System Status
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="compact"
            className="ui-focusable"
            disabled={bridgePhase !== "connected" || !bridgeBaseUrl?.trim() || mirrorRefreshing}
            onClick={() => void refreshMirrorStatus()}
          >
            {mirrorRefreshing ? "Refreshing…" : "Refresh status"}
          </Button>
        </div>
        <div className="app-settings__system-status-grid">
          {/* Clinic service */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">{CLINIC_FRIENDLY_SERVICE_LABEL}</span>
            <span className={`app-settings__status-value app-settings__status-value--${serviceSummary.tone}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${serviceSummary.tone}`} />
              {serviceSummary.label}
            </span>
          </div>

          {/* Data connection */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">{CLINIC_FRIENDLY_LOCAL_COPY_LABEL}</span>
            <span className={`app-settings__status-value app-settings__status-value--${friendlyLocalCopy.tone}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${friendlyLocalCopy.tone}`} />
              {friendlyLocalCopy.label}
            </span>
          </div>

          {/* Editing */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">Editing</span>
            <span className={`app-settings__status-value app-settings__status-value--${friendlyEditing.tone}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${friendlyEditing.tone}`} />
              {friendlyEditing.label}
            </span>
          </div>

          {/* Backup */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">Backup</span>
            <span className={`app-settings__status-value app-settings__status-value--${backupReadiness.tone}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${backupReadiness.tone}`} />
              {backupReadiness.label}
            </span>
          </div>

          {/* Last data sync */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">Last data sync</span>
            <span className="app-settings__status-value">
              {bridgePhase !== "connected" || mirrorStatus === null || mirrorStatus.latestImportRuns.length === 0
                ? "—"
                : formatFinishedAt(mirrorStatus.latestImportRuns[0].finishedAt)}
            </span>
          </div>

          {/* Build info */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">App version</span>
            <span className="app-settings__status-value">
              {pilotBuild === undefined
                ? "Loading…"
                : pilotBuild === null
                  ? "Unavailable"
                  : pilotBuild.packageVersion}
            </span>
          </div>
        </div>
      </section>

      {dangerBanners.length > 0 ? (
        <div className="app-settings__danger-banners" role="region" aria-label="Operator alerts">
          {dangerBanners.map((banner) => (
            <p
              key={banner.key}
              className={`app-settings__danger-banner app-settings__danger-banner--${banner.tone}`}
              role={banner.tone === "danger" ? "alert" : "status"}
            >
              <strong>{banner.label}</strong> — {banner.body}
            </p>
          ))}
        </div>
      ) : null}

      {/* First-run guidance: bridge is up but mirror has never been imported */}
      {bridgePhase === "connected" &&
      mirrorStatus !== null &&
      mirrorStatus.latestImportRuns.length === 0 ? (
        <div className="app-settings__first-run-callout" role="status" aria-label="First-run setup complete">
          <p className="app-settings__first-run-callout-title">
            <strong>Setup complete — next step: import your local data</strong>
          </p>
          <p className="app-settings__first-run-callout-body">
            The clinic service is running. To enable search and schedule, run the safe mirror import
            from the command line, then click Refresh status above.
          </p>
          <p className="app-settings__cli-hint" role="note">
            {SETTINGS_MIRROR_IMPORT_COMMAND}
          </p>
        </div>
      ) : null}

      {pilotReadiness.length > 0 ? (
        <div className="app-settings__readiness" role="region" aria-labelledby="settings-readiness-title">
          <h2 id="settings-readiness-title" className="app-settings__readiness-title">
            {SETTINGS_PILOT_READINESS_TITLE}
          </h2>
          <ul className="app-settings__readiness-chips">
            {pilotReadiness.map((chip) => (
              <li
                key={chip.key}
                className={`app-settings__readiness-chip app-settings__readiness-chip--${chip.tone}`}
              >
                {chip.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pilotChecklist.length > 0 ? (
        <div className="app-settings__checklist" role="region" aria-labelledby="settings-checklist-title">
          <h2 id="settings-checklist-title" className="app-settings__checklist-title">
            {SETTINGS_PILOT_CHECKLIST_TITLE}
          </h2>
          <ul className="app-settings__checklist-items">
            {pilotChecklist.map((item) => (
              <li
                key={item.key}
                className={`app-settings__checklist-item app-settings__checklist-item--${item.tone}`}
              >
                <span className="app-settings__checklist-label">{item.label}</span>
                {item.nextStep ? (
                  <span className="app-settings__checklist-next">
                    <strong>{SETTINGS_NEXT_STEP_LABEL}:</strong> {item.nextStep}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ====== CLINIC-FRIENDLY OPERATOR SECTIONS ====== */}
      <div className="clinic-settings-sections">

        {/* ---- Clinic Service ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_CLINIC_SERVICE}
          lede={SETTINGS_SECTION_CLINIC_SERVICE_LEDE}
          sectionId="settings-section-clinic-service"
        >
          <ClinicPanel
            title={CLINIC_FRIENDLY_SERVICE_LABEL}
            className={settingsPanelClassName(serviceSummary.tone as SettingsStatusTone, { primary: true })}
            headerActions={<SettingsPanelStatusDot tone={serviceSummary.tone as SettingsStatusTone} />}
          >
            <p className={`app-settings__status app-settings__status--${serviceSummary.tone}`}>
              {serviceSummary.label}
            </p>
            <p className="app-settings__muted" role="note">{SETTINGS_SERVICE_PORT_MASKED}</p>
            <SettingsNextStep card="serviceStatus" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Data Source ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_DATA_SOURCE}
          lede={SETTINGS_SECTION_DATA_SOURCE_LEDE}
          sectionId="settings-section-data-source"
        >
          <ClinicPanel
            title="Data folder"
            className={settingsPanelClassName(dataSourceStatus.tone)}
            headerActions={<SettingsPanelStatusDot tone={dataSourceStatus.tone} />}
          >
            <p className={`app-settings__status app-settings__status--${dataSourceStatus.tone}`}>
              {dataSourceStatus.label}
            </p>
            <p className="app-settings__muted" role="note">{dataSourceStatus.maskedPathHint}</p>
            <SettingsNextStep card="dataSource" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Local Copy ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_LOCAL_COPY}
          lede={SETTINGS_SECTION_LOCAL_COPY_LEDE}
          sectionId="settings-section-local-copy"
        >
          <p className="clinic-settings-section__note app-settings__mirror-truth" role="note">
            {mirrorFreshnessNote}
          </p>
          <ClinicPanel
            title={SETTINGS_MIRROR_SECTION}
            className={settingsPanelClassName(mirrorCardTone(bridgePhase, mirrorStale), { mirror: true })}
            headerActions={
              <>
                <SettingsPanelStatusDot tone={mirrorCardTone(bridgePhase, mirrorStale)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  className="ui-focusable"
                  disabled={bridgePhase !== "connected" || !bridgeBaseUrl?.trim() || mirrorRefreshing}
                  onClick={() => void refreshMirrorStatus()}
                >
                  {mirrorRefreshing ? "Refreshing…" : SETTINGS_MIRROR_REFRESH}
                </Button>
              </>
            }
          >
            {bridgePhase !== "connected" ? (
              <p className="app-settings__muted">Connect the clinic service to load mirror status.</p>
            ) : mirrorStatus === null ? (
              <p className="app-settings__muted">Mirror status unavailable.</p>
            ) : (
              <>
                <p className="app-settings__mirror-truth" role="note">
                  {SETTINGS_MIRROR_DBF_SOURCE_TRUTH}
                </p>
                <SettingsNextStep card="mirror" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
                <ul className="app-settings__facts">
                  <li>
                    {SETTINGS_MIRROR_IMPORTED_COUNT}: {importedCount}
                  </li>
                </ul>
                {mirrorStale ? (
                  <p className="app-settings__stale" role="status">
                    {SETTINGS_MIRROR_STALE_CALLOUT}{" "}
                    <span className="app-settings__doc-ref">{SETTINGS_MIRROR_DOC_LINK}</span> (
                    <code>{MIRROR_DOC_PATH}</code>)
                  </p>
                ) : null}
                {mirrorRefreshError ? (
                  <p className="app-settings__error" role="alert">
                    Could not refresh.
                  </p>
                ) : null}
                {runs.length === 0 ? (
                  <>
                    <div className="app-settings__import-prompt">
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        className="ui-focusable"
                        onClick={() => setShowImportGuide((prev) => !prev)}
                      >
                        {SETTINGS_IMPORT_LOCAL_COPY_BUTTON}
                      </Button>
                      {showImportGuide ? (
                        <p className="app-settings__muted" role="note">
                          {SETTINGS_IMPORT_LOCAL_COPY_HINT}
                        </p>
                      ) : null}
                    </div>
                    <p className="app-settings__muted">
                      {SETTINGS_MIRROR_NO_RUNS} {SETTINGS_MIRROR_IMPORT_CLI}{" "}
                      <span className="app-settings__doc-ref">{SETTINGS_MIRROR_DOC_LINK}</span> (
                      <code>{MIRROR_DOC_PATH}</code>)
                    </p>
                    <p className="app-settings__cli-hint" role="note">
                      {SETTINGS_MIRROR_IMPORT_COMMAND}
                    </p>
                  </>
                ) : (
                  <div className="app-settings__table-wrap">
                    <table className="app-settings__table">
                      <caption className="app-sr-only">Latest mirror import runs per table</caption>
                      <thead>
                        <tr>
                          <th scope="col">Table</th>
                          <th scope="col">Status</th>
                          <th scope="col">Rows</th>
                          <th scope="col">Finished</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => (
                          <tr key={run.tableName}>
                            <td>{run.tableName}</td>
                            <td>
                              <Badge
                                variant={mirrorRunBadgeVariant(run.status)}
                                semanticLabel={`Mirror import for ${run.tableName}: ${mirrorRunStatusLabel(run.status)}`}
                              >
                                {mirrorRunStatusLabel(run.status)}
                              </Badge>
                            </td>
                            <td>{run.rowCount}</td>
                            <td>{formatFinishedAt(run.finishedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="app-settings__doc-link">
                      <span className="app-settings__doc-ref">{SETTINGS_MIRROR_DOC_LINK}</span> (
                      <code>{MIRROR_DOC_PATH}</code>)
                    </p>
                  </div>
                )}
              </>
            )}
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Editing Mode ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_EDITING_MODE}
          lede={SETTINGS_SECTION_EDITING_MODE_LEDE}
          sectionId="settings-section-editing-mode"
        >
          <ClinicPanel
            title="Editing mode"
            className={settingsPanelClassName(editingModeSummary.tone, { primary: true })}
            headerActions={<SettingsPanelStatusDot tone={editingModeSummary.tone} />}
          >
            <p className={`app-settings__status app-settings__status--${editingModeSummary.tone}`}>
              {editingModeSummary.label}
            </p>
            <p className="app-settings__muted" role="note">{editingModeSummary.explanation}</p>
            <SettingsNextStep card="editingMode" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Backup Readiness ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_BACKUP_READINESS}
          lede={SETTINGS_SECTION_BACKUP_READINESS_LEDE}
          sectionId="settings-section-backup-readiness"
        >
          <ClinicPanel
            title={SETTINGS_BACKUP_SECTION}
            className={settingsPanelClassName(backupReadiness.tone)}
            headerActions={<SettingsPanelStatusDot tone={backupReadiness.tone} />}
          >
            <p className={`app-settings__status app-settings__status--${backupReadiness.tone}`}>
              {backupReadiness.label}
            </p>
            {showBackupReadonlyNote ? (
              <p className="app-settings__muted" role="note">
                {CLINIC_FRIENDLY_BACKUP_NOT_NEEDED_READONLY}
              </p>
            ) : null}
            {writeCapability !== null &&
            writeCapability.writeMode === "enabled" &&
            !writeCapability.backupDirConfigured ? (
              <div className="app-settings__backup-setup">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="ui-focusable"
                  onClick={() => setShowBackupSetup((prev) => !prev)}
                >
                  {SETTINGS_BACKUP_SETUP_BUTTON}
                </Button>
                {showBackupSetup ? (
                  <p className="app-settings__muted" role="note">
                    {SETTINGS_BACKUP_SETUP_HINT}
                  </p>
                ) : null}
              </div>
            ) : null}
            <SettingsNextStep card="backup" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            {devHints && writeCapability?.backupDirConfigured ? (
              <p className="app-settings__path-hints" role="note">
                <code>{MASKED_PATH_HINT_EXAMPLES.backup}</code>
              </p>
            ) : null}
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Build Info ---- */}
        <SettingsSection
          title="Build Info"
          lede="App version, build metadata, and platform notes."
          sectionId="settings-section-build-info"
        >
          <ClinicPanel
            title={SETTINGS_PILOT_BUILD_SECTION}
            className={settingsPanelClassName("neutral")}
            headerActions={<SettingsPanelStatusDot tone="neutral" />}
          >
            {pilotBuild === undefined ? (
              <p className="app-settings__muted">{SETTINGS_PILOT_BUILD_LOADING}</p>
            ) : pilotBuild === null ? (
              <p className="app-settings__muted">{SETTINGS_PILOT_BUILD_UNAVAILABLE}</p>
            ) : (
              <ul className="app-settings__facts">
                <li>
                  {SETTINGS_PILOT_BUILD_PACKAGE_VERSION}: {pilotBuild.packageVersion}
                </li>
                <li>
                  {SETTINGS_PILOT_BUILD_APP_VERSION}: {pilotBuild.appVersion}
                </li>
                <li>
                  {SETTINGS_PILOT_BUILD_COMMIT}: {pilotBuild.gitCommit}
                </li>
                <li>
                  {SETTINGS_PILOT_BUILD_CHANNEL}: {pilotBuild.releaseChannel}
                </li>
                <li>
                  {SETTINGS_PILOT_BUILD_BUILT}: {formatBuildTimestamp(pilotBuild.buildTimestampUtc)}
                </li>
              </ul>
            )}
            <p className="app-settings__muted" role="note">{SETTINGS_BUILD_WINDOWS_DEFERRED_NOTICE}</p>
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Field Test Readiness ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_FIELD_TEST}
          lede={SETTINGS_SECTION_FIELD_TEST_LEDE}
          sectionId="settings-section-field-test"
        >
          <ClinicPanel
            title="Field test readiness"
            className={`${settingsPanelClassName(fieldTestBadge.tone)} clinic-settings-panel--field-test`}
            headerActions={<SettingsPanelStatusDot tone={fieldTestBadge.tone} />}
          >
            <p className={`app-settings__status app-settings__status--${fieldTestBadge.tone}`}>
              {fieldTestBadge.label}
            </p>
            <p className="app-settings__muted app-settings__field-test-doc" role="note">
              {SETTINGS_READINESS_FIELD_TEST_DOC_HINT}
            </p>
          </ClinicPanel>

          <ClinicPanel
            title={SETTINGS_PILOT_NOTES_TITLE}
            className={settingsPanelClassName("neutral")}
            headerActions={<SettingsPanelStatusDot tone="neutral" />}
          >
            <ul className="app-settings__pilot-notes">
              <li>{SETTINGS_PILOT_NOTES_READINESS}</li>
              <li>{SETTINGS_PILOT_NOTES_REMINDERS}</li>
              <li>{SETTINGS_PILOT_NOTES_FOOTNOTE}</li>
            </ul>
          </ClinicPanel>

          {/* First-run setup re-run action */}
          <ClinicPanel
            title="First-run setup"
            className={settingsPanelClassName("neutral")}
            headerActions={<SettingsPanelStatusDot tone="neutral" />}
          >
            <div className="app-settings__setup-action">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                onClick={() => {
                  if (window.electronAPI) {
                    void window.electronAPI.reRunSetup();
                  } else {
                    setShowSetupGuide((prev) => !prev);
                  }
                }}
              >
                {SETTINGS_SETUP_RERUN_BUTTON}
              </Button>
              {showSetupGuide ? (
                <p className="app-settings__muted" role="note">
                  {SETTINGS_SETUP_RERUN_HINT}
                </p>
              ) : null}
            </div>
          </ClinicPanel>
        </SettingsSection>

        {/* ---- Diagnostics (collapsed by default, technical only) ---- */}
        <SettingsSection
          title={SETTINGS_SECTION_DIAGNOSTICS}
          lede={SETTINGS_SECTION_DIAGNOSTICS_LEDE}
          sectionId="settings-section-diagnostics"
        >
          <details
            className="app-settings__diagnostics-toggle"
            open={showDiagnostics}
            onToggle={(e) => setShowDiagnostics((e.target as HTMLDetailsElement).open)}
          >
            <summary className="app-settings__diagnostics-summary">
              {showDiagnostics ? SETTINGS_DIAGNOSTICS_EXPANDED_LABEL : SETTINGS_DIAGNOSTICS_COLLAPSED_LABEL}
            </summary>

            <ClinicPanel
              title={SETTINGS_BRIDGE_SECTION}
              className={settingsPanelClassName(bridgeCardTone(bridgePhase))}
              headerActions={<SettingsPanelStatusDot tone={bridgeCardTone(bridgePhase)} />}
            >
              <p className={`app-settings__status app-settings__status--${bridgePhase}`}>{bridgeLabel}</p>
              <SettingsNextStep card="bridge" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
              {showConnectionDiagnostics && bridgeBaseUrl?.trim() ? (
                <p className="app-settings__diag" role="note">
                  Bridge URL: {bridgeBaseUrl.trim()}
                </p>
              ) : null}
            </ClinicPanel>

            <ClinicPanel
              title={SETTINGS_DATA_PATHS_SECTION}
              className={settingsPanelClassName(dataRootStatus.tone)}
              headerActions={<SettingsPanelStatusDot tone={dataRootStatus.tone} />}
            >
              <p className={`app-settings__status app-settings__status--${dataRootStatus.tone}`}>{dataRootStatus.label}</p>
              <SettingsNextStep card="dataRoot" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
              {devHints ? (
                <ul className="app-settings__path-hints" role="note">
                  <li>
                    DATA layout: <code>{maskOperatorPath("C:\\Microdent\\Write-Sandbox\\DATA")}</code>
                  </li>
                </ul>
              ) : null}
            </ClinicPanel>

            <ClinicPanel
              title={SETTINGS_DESKTOP_SECTION}
              className={settingsPanelClassName("neutral")}
              headerActions={<SettingsPanelStatusDot tone="neutral" />}
            >
              <p className="app-settings__muted">
                {isDesktopFileProtocol() ? SETTINGS_DESKTOP_FILE_PROTOCOL : SETTINGS_DESKTOP_BROWSER}
              </p>
            </ClinicPanel>

            <ClinicPanel
              title={SETTINGS_SQLITE_MIRROR_SECTION}
              className={settingsPanelClassName(sqliteMirrorStatus.tone)}
              headerActions={<SettingsPanelStatusDot tone={sqliteMirrorStatus.tone} />}
            >
              <p className={`app-settings__status app-settings__status--${sqliteMirrorStatus.tone}`}>
                {sqliteMirrorStatus.label}
              </p>
              <SettingsNextStep
                card="sqliteMirror"
                {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }}
              />
              {devHints && writeCapability?.sqlitePathConfigured ? (
                <p className="app-settings__path-hints" role="note">
                  SQLite: <code>{MASKED_PATH_HINT_EXAMPLES.sqlite}</code>
                </p>
              ) : null}
            </ClinicPanel>

            {/* Write mode technical detail */}
            <ClinicPanel
              title={SETTINGS_WRITE_SECTION}
              className={settingsPanelClassName(writeCardTone(writeCapability), { primary: true })}
              headerActions={<SettingsPanelStatusDot tone={writeCardTone(writeCapability)} />}
            >
              {writeChip ? (
                <Badge
                  variant={writeChip.variant}
                  className="app-settings__chip"
                  semanticLabel={`Bridge write mode: ${writeChip.label}`}
                >
                  {writeChip.label}
                </Badge>
              ) : (
                <p className="app-settings__muted">Connect the clinic service to load write mode.</p>
              )}
              <SettingsNextStep card="write" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            </ClinicPanel>

            {/* Sandbox validity (technical detail) */}
            <ClinicPanel
              title={SETTINGS_SANDBOX_SECTION}
              className={settingsPanelClassName(sandboxStatus.tone)}
              headerActions={<SettingsPanelStatusDot tone={sandboxStatus.tone} />}
            >
              <p className={`app-settings__status app-settings__status--${sandboxStatus.tone}`}>{sandboxStatus.label}</p>
              <SettingsNextStep card="sandbox" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            </ClinicPanel>

            {/* Sandbox write pilot flag (technical detail) */}
            <ClinicPanel
              title="Sandbox write pilot"
              className={settingsPanelClassName("neutral")}
              headerActions={<SettingsPanelStatusDot tone="neutral" />}
            >
              <p className="app-settings__muted">
                {sandboxWritePilot ? SETTINGS_SANDBOX_PILOT_ON : SETTINGS_SANDBOX_PILOT_OFF}
              </p>
              <SettingsNextStep card="pilot" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            </ClinicPanel>
          </details>
        </SettingsSection>

      </div>

      {/* ----- Next steps for new operators ----- */}
      <section className="app-settings__next-steps" role="region" aria-labelledby="next-steps-heading">
        <h2 id="next-steps-heading" className="app-settings__next-steps-title">
          {SETTINGS_NEXT_STEPS_TITLE}
        </h2>
        <p className="app-settings__next-steps-lede">{SETTINGS_NEXT_STEPS_LEDE}</p>
        <ol className="app-settings__next-steps-list">
          {/* Step 1: Choose data folder */}
          <li
            className={`app-settings__next-step app-settings__next-step--${dataRootStatus.tone === "ok" ? "done" : "pending"}`}
          >
            <span className="app-settings__next-step-icon" aria-hidden="true">
              {dataRootStatus.tone === "ok" ? "✓" : "1"}
            </span>
            <span className="app-settings__next-step-label">
              {dataRootStatus.tone === "ok"
                ? SETTINGS_NEXT_STEP_CHOOSE_DATA_DONE
                : SETTINGS_NEXT_STEP_CHOOSE_DATA}
            </span>
          </li>
          {/* Step 2: Import local copy */}
          <li
            className={`app-settings__next-step app-settings__next-step--${
              bridgePhase === "connected" && mirrorStatus !== null && mirrorStatus.sqliteUsable
                ? "done"
                : "pending"
            }`}
          >
            <span className="app-settings__next-step-icon" aria-hidden="true">
              {bridgePhase === "connected" && mirrorStatus !== null && mirrorStatus.sqliteUsable ? "✓" : "2"}
            </span>
            <span className="app-settings__next-step-label">
              {bridgePhase === "connected" && mirrorStatus !== null && mirrorStatus.sqliteUsable
                ? SETTINGS_NEXT_STEP_IMPORT_COPY_DONE
                : SETTINGS_NEXT_STEP_IMPORT_COPY}
            </span>
          </li>
          {/* Step 3: Set up backup folder */}
          <li
            className={`app-settings__next-step app-settings__next-step--${
              writeCapability !== null && writeCapability.backupDirConfigured ? "done" : "pending"
            }`}
          >
            <span className="app-settings__next-step-icon" aria-hidden="true">
              {writeCapability !== null && writeCapability.backupDirConfigured ? "✓" : "3"}
            </span>
            <span className="app-settings__next-step-label">
              {writeCapability !== null && writeCapability.backupDirConfigured
                ? SETTINGS_NEXT_STEP_SETUP_BACKUP_DONE
                : SETTINGS_NEXT_STEP_SETUP_BACKUP}
            </span>
          </li>
          {/* Step 4: Review read-only data */}
          <li
            className={`app-settings__next-step app-settings__next-step--${
              dataRootStatus.tone === "ok" &&
              bridgePhase === "connected" &&
              mirrorStatus !== null &&
              mirrorStatus.sqliteUsable
                ? "done"
                : "pending"
            }`}
          >
            <span className="app-settings__next-step-icon" aria-hidden="true">
              {dataRootStatus.tone === "ok" &&
              bridgePhase === "connected" &&
              mirrorStatus !== null &&
              mirrorStatus.sqliteUsable
                ? "✓"
                : "4"}
            </span>
            <span className="app-settings__next-step-label">
              {dataRootStatus.tone === "ok" &&
              bridgePhase === "connected" &&
              mirrorStatus !== null &&
              mirrorStatus.sqliteUsable
                ? SETTINGS_NEXT_STEP_REVIEW_DATA_DONE
                : SETTINGS_NEXT_STEP_REVIEW_DATA}
            </span>
          </li>
        </ol>
      </section>
    </ClinicPage>
  );
}
