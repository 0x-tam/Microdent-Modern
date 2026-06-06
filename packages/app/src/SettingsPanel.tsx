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
import { resolveLocalCopyIssue } from "./local-copy-issue.js";
import {
  SETTINGS_BACKUP_SECTION,
  SETTINGS_BACKUP_SETUP_BUTTON,
  SETTINGS_BACKUP_SETUP_HINT,
  SETTINGS_BRIDGE_CHECKING,
  SETTINGS_BRIDGE_CONNECTED,
  SETTINGS_BRIDGE_OFFLINE,
  SETTINGS_BRIDGE_SECTION,
  SETTINGS_DATA_PATHS_SECTION,
  SETTINGS_DESKTOP_BROWSER,
  SETTINGS_DESKTOP_FILE_PROTOCOL,
  SETTINGS_DESKTOP_SECTION,
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
  SETTINGS_PILOT_READINESS_TITLE,
  SETTINGS_PILOT_CHECKLIST_TITLE,
  SETTINGS_PILOT_SECTION,
  SETTINGS_READINESS_BRIDGE_OFFLINE,
  SETTINGS_READINESS_READ_ONLY,
  SETTINGS_READINESS_WRITES_ACTIVE,
  SETTINGS_PILOT_BUILD_APP_VERSION,
  SETTINGS_PILOT_BUILD_BUILT,
  SETTINGS_PILOT_BUILD_CHANNEL,
  SETTINGS_PILOT_BUILD_COMMIT,
  SETTINGS_PILOT_BUILD_LOADING,
  SETTINGS_PILOT_BUILD_PACKAGE_VERSION,
  SETTINGS_PILOT_BUILD_SECTION,
  SETTINGS_PILOT_BUILD_UNAVAILABLE,
  SETTINGS_BACKUP_READONLY_NOTE,
  SETTINGS_MIRROR_FRESHNESS_ACTIVE,
  SETTINGS_MIRROR_FRESHNESS_FALLBACK,
  SETTINGS_MIRROR_FRESHNESS_OFFLINE,
  SETTINGS_MIRROR_FRESHNESS_STALE,
  SETTINGS_MIRROR_FRESHNESS_UNKNOWN,
  SETTINGS_OPEN_TODAY_BUTTON,
  SETTINGS_PANEL_LEDE,
  SETTINGS_PILOT_NOTES_FOOTNOTE,
  SETTINGS_PILOT_NOTES_READINESS,
  SETTINGS_PILOT_NOTES_REMINDERS,
  SETTINGS_PILOT_NOTES_TITLE,
  SETTINGS_READINESS_FIELD_TEST_DOC_HINT,
  SETTINGS_QUICK_FIX_RESTART_SERVICE,
  SETTINGS_QUICK_FIX_RESTART_SERVICE_FAILED,
  SETTINGS_QUICK_FIX_RESTART_SERVICE_SUCCESS,
  SETTINGS_QUICK_FIX_RESTARTING_SERVICE,
  SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG,
  SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG_FAILED,
  SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG_SUCCESS,
  SETTINGS_QUICK_FIX_EXPORTING_SUPPORT_LOG,
  SETTINGS_QUICK_FIX_LOADING_DIAGNOSTICS,
  SETTINGS_QUICK_FIX_PREVIEW_SUPPORT_LOG,
  SETTINGS_QUICK_FIX_PREVIEW_SUPPORT_LOG_FAILED,
  SETTINGS_QUICK_FIX_PREVIEWING_SUPPORT_LOG,
  SETTINGS_QUICK_FIX_VIEW_DIAGNOSTICS,
  SETTINGS_QUICK_FIX_VIEW_DIAGNOSTICS_FAILED,
  SETTINGS_QUICK_FIX_CHECK_PORT,
  SETTINGS_QUICK_FIX_CHECK_PORT_FAILED,
  SETTINGS_QUICK_FIX_CHECKING_PORT,
  SETTINGS_QUICK_FIX_LOADING_PORT_POLICY,
  SETTINGS_QUICK_FIX_PORT_CLEANUP_POLICY,
  SETTINGS_QUICK_FIX_PORT_CLEANUP_POLICY_FAILED,
  SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY,
  SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY_FAILED,
  SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY_SUCCESS,
  SETTINGS_QUICK_FIX_REFRESHING_LOCAL_COPY,
  SETTINGS_SANDBOX_PILOT_OFF,
  SETTINGS_SANDBOX_PILOT_ON,
  SETTINGS_SANDBOX_SECTION,
  SETTINGS_SECTION_BACKUP,
  SETTINGS_SECTION_BACKUP_LEDE,
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
  SETTINGS_SQLITE_MIRROR_SECTION,
  SETTINGS_WRITE_SECTION,
} from "./read-only-ui-copy.js";
import {
  resolvePilotBuildMetadata,
  type PilotBuildMetadata,
} from "./pilot-build-metadata.js";
import {
  resolveBackupConfiguredStatus,
  resolveDataRootConfiguredStatus,
  resolvePilotReadinessSummary,
  resolvePilotReadinessChecklist,
  resolveSandboxValidityStatus,
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
  desktopActions?: SettingsDesktopActions;
};

export type SettingsDesktopActionResult = {
  ok: boolean;
  message?: string;
};

export type SettingsSupportLogExportResult = SettingsDesktopActionResult & {
  fileName?: string;
  lineCount?: number;
};

export type SettingsSupportDiagnosticsResult = SettingsDesktopActionResult & {
  logFileCount: number;
  supportExportCount: number;
  crashDumpCount: number;
  crashDumpFiles: Array<{
    fileName: string;
    kind: "dump" | "metadata" | "other";
    sizeBytes: number;
    updatedAt: string;
  }>;
  latestLogUpdatedAt: string | null;
  latestCrashDumpUpdatedAt: string | null;
  latestSupportExportFileName: string | null;
};

export type SettingsSupportLogPreviewResult = SettingsDesktopActionResult & {
  fileName: string | null;
  lineCount: number;
  lines: Array<{ index: number; level: string; event: string; summary: string }>;
};

export type SettingsPortDiagnosticResult = SettingsDesktopActionResult & {
  configuredPort?: number;
  activePort?: number | null;
  configuredPortState?: "responding" | "not-responding";
  activePortState?: "responding" | "not-responding" | null;
};

export type SettingsPortCleanupPolicyResult = SettingsDesktopActionResult & {
  title: string;
  canAutoClean: false;
  configuredPort: number;
  activePort: number | null;
  steps: string[];
  escalation: string;
};

export type SettingsLocalCopyRefreshProgress = {
  label: string;
  percent: number;
};

export type SettingsDesktopActions = {
  restartClinicService?: () => Promise<SettingsDesktopActionResult>;
  refreshLocalCopy?: () => Promise<SettingsDesktopActionResult>;
  exportSupportLog?: () => Promise<SettingsSupportLogExportResult>;
  getSupportDiagnostics?: () => Promise<SettingsSupportDiagnosticsResult>;
  previewSupportLog?: () => Promise<SettingsSupportLogPreviewResult>;
  diagnoseClinicServicePort?: () => Promise<SettingsPortDiagnosticResult>;
  getPortCleanupPolicy?: () => Promise<SettingsPortCleanupPolicyResult>;
  onLocalCopyRefreshProgress?: (listener: (progress: SettingsLocalCopyRefreshProgress) => void) => () => void;
};

const MIRROR_DOC_PATH = "docs/PILOT-HANDOFF-PACK.md";

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

function formatOptionalTimestamp(iso: string | null): string {
  return iso ? formatFinishedAt(iso) : "None yet";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      className={`app-settings__card-status-dot app-settings__card-status-dot--${tone}`}
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
  desktopActions,
}: SettingsPanelProps) {
  const [mirrorRefreshing, setMirrorRefreshing] = useState(false);
  const [mirrorRefreshError, setMirrorRefreshError] = useState(false);
  const [pilotBuild, setPilotBuild] = useState<PilotBuildMetadata | null | undefined>(undefined);
  const [showBackupSetup, setShowBackupSetup] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [restartPhase, setRestartPhase] = useState<"idle" | "running" | "ok" | "failed">("idle");
  const [localCopyRefreshPhase, setLocalCopyRefreshPhase] =
    useState<"idle" | "running" | "ok" | "failed">("idle");
  const [localCopyRefreshProgress, setLocalCopyRefreshProgress] =
    useState<SettingsLocalCopyRefreshProgress | null>(null);
  const [supportLogPhase, setSupportLogPhase] = useState<"idle" | "running" | "ok" | "failed">("idle");
  const [supportLogFileName, setSupportLogFileName] = useState<string | null>(null);
  const [supportDiagnosticsPhase, setSupportDiagnosticsPhase] =
    useState<"idle" | "running" | "ok" | "failed">("idle");
  const [supportDiagnostics, setSupportDiagnostics] =
    useState<SettingsSupportDiagnosticsResult | null>(null);
  const [supportPreviewPhase, setSupportPreviewPhase] = useState<"idle" | "running" | "ok" | "failed">("idle");
  const [supportPreview, setSupportPreview] = useState<SettingsSupportLogPreviewResult | null>(null);
  const [portDiagnosticPhase, setPortDiagnosticPhase] = useState<"idle" | "running" | "ok" | "failed">("idle");
  const [portDiagnosticMessage, setPortDiagnosticMessage] = useState<string | null>(null);
  const [portPolicyPhase, setPortPolicyPhase] = useState<"idle" | "running" | "ok" | "failed">("idle");
  const [portPolicy, setPortPolicy] = useState<SettingsPortCleanupPolicyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolvePilotBuildMetadata(fetchImpl).then((metadata) => {
      if (!cancelled) setPilotBuild(metadata);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  useEffect(() => {
    if (!desktopActions?.onLocalCopyRefreshProgress) return undefined;
    return desktopActions.onLocalCopyRefreshProgress((progress) => {
      setLocalCopyRefreshProgress(progress);
    });
  }, [desktopActions]);

  const writeChip = resolveWriteModeChip(writeCapability);
  const dataRootStatus = resolveDataRootConfiguredStatus(writeCapability);
  const sandboxStatus = resolveSandboxValidityStatus(writeCapability);
  const backupStatus = resolveBackupConfiguredStatus(writeCapability);
  const sqliteMirrorStatus = resolveSqliteMirrorStatus(bridgePhase, mirrorStatus, writeCapability);
  const pilotReadiness = resolvePilotReadinessSummary(bridgePhase, writeCapability, mirrorStatus);
  const pilotChecklist = resolvePilotReadinessChecklist(bridgePhase, writeCapability, mirrorStatus, {
    sandboxWritePilot,
  });
  const dangerBanners = resolveSettingsDangerBanners(bridgePhase, mirrorStatus, writeCapability);
  const mirrorStale =
    bridgePhase === "connected" && mirrorStatus !== null && isMirrorImportStale(mirrorStatus, Date.now());
  const localCopyIssue = mirrorStatus ? resolveLocalCopyIssue(mirrorStatus) : null;
  const devHints = showDevPathHints(showConnectionDiagnostics);

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

  const restartClinicService = useCallback(async () => {
    if (!desktopActions?.restartClinicService || restartPhase === "running") return;
    setRestartPhase("running");
    const result = await desktopActions.restartClinicService();
    setRestartPhase(result.ok ? "ok" : "failed");
    if (result.ok) {
      await refreshMirrorStatus();
    }
  }, [desktopActions, refreshMirrorStatus, restartPhase]);

  const refreshLocalCopy = useCallback(async () => {
    if (!desktopActions?.refreshLocalCopy || localCopyRefreshPhase === "running") return;
    setLocalCopyRefreshPhase("running");
    setLocalCopyRefreshProgress({ label: SETTINGS_QUICK_FIX_REFRESHING_LOCAL_COPY, percent: 0 });
    const result = await desktopActions.refreshLocalCopy();
    setLocalCopyRefreshPhase(result.ok ? "ok" : "failed");
    if (result.ok) {
      await refreshMirrorStatus();
    }
  }, [desktopActions, localCopyRefreshPhase, refreshMirrorStatus]);

  const exportSupportLog = useCallback(async () => {
    if (!desktopActions?.exportSupportLog || supportLogPhase === "running") return;
    setSupportLogPhase("running");
    setSupportLogFileName(null);
    const result = await desktopActions.exportSupportLog();
    setSupportLogPhase(result.ok ? "ok" : "failed");
    setSupportLogFileName(result.ok && result.fileName ? result.fileName : null);
  }, [desktopActions, supportLogPhase]);

  const loadSupportDiagnostics = useCallback(async () => {
    if (!desktopActions?.getSupportDiagnostics || supportDiagnosticsPhase === "running") return;
    setSupportDiagnosticsPhase("running");
    const result = await desktopActions.getSupportDiagnostics();
    setSupportDiagnosticsPhase(result.ok ? "ok" : "failed");
    setSupportDiagnostics(result.ok ? result : null);
  }, [desktopActions, supportDiagnosticsPhase]);

  const previewSupportLog = useCallback(async () => {
    if (!desktopActions?.previewSupportLog || supportPreviewPhase === "running") return;
    setSupportPreviewPhase("running");
    const result = await desktopActions.previewSupportLog();
    setSupportPreviewPhase(result.ok ? "ok" : "failed");
    setSupportPreview(result.ok ? result : null);
  }, [desktopActions, supportPreviewPhase]);

  const diagnoseClinicServicePort = useCallback(async () => {
    if (!desktopActions?.diagnoseClinicServicePort || portDiagnosticPhase === "running") return;
    setPortDiagnosticPhase("running");
    setPortDiagnosticMessage(null);
    const result = await desktopActions.diagnoseClinicServicePort();
    setPortDiagnosticPhase(result.ok ? "ok" : "failed");
    setPortDiagnosticMessage(result.message ?? null);
  }, [desktopActions, portDiagnosticPhase]);

  const loadPortCleanupPolicy = useCallback(async () => {
    if (!desktopActions?.getPortCleanupPolicy || portPolicyPhase === "running") return;
    setPortPolicyPhase("running");
    const result = await desktopActions.getPortCleanupPolicy();
    setPortPolicyPhase(result.ok ? "ok" : "failed");
    setPortPolicy(result.ok ? result : null);
  }, [desktopActions, portPolicyPhase]);

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

      {/* ----- System Status (consolidated diagnostics) ----- */}
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
            <span className="app-settings__status-label">Clinic service</span>
            <span className={`app-settings__status-value app-settings__status-value--${bridgePhase}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${bridgePhase}`} />
              {bridgeLabel}
            </span>
          </div>

          {/* Data connection */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">Data connection</span>
            <span className={`app-settings__status-value app-settings__status-value--${mirrorCardTone(bridgePhase, mirrorStale)}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${mirrorCardTone(bridgePhase, mirrorStale)}`} />
              {bridgePhase !== "connected"
                ? "Not configured"
                : mirrorStatus === null
                  ? "Not configured"
                  : mirrorStatus.sqliteUsable
                    ? "Data sync active"
                    : "Using legacy data"}
            </span>
          </div>

          {/* Editing */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">Editing</span>
            <span className={`app-settings__status-value app-settings__status-value--${writeCardTone(writeCapability)}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${writeCardTone(writeCapability)}`} />
              {writeCapability === null
                ? "Connect the clinic service"
                : writeCapability.writeMode === "disabled"
                  ? "Read-only"
                  : writeCapability.writeMode === "dry-run"
                    ? "Preview (dry-run)"
                    : "Sandbox available"}
            </span>
          </div>

          {/* Local copy */}
          <div className="app-settings__status-row">
            <span className="app-settings__status-label">Local copy</span>
            <span className={`app-settings__status-value app-settings__status-value--${sqliteMirrorStatus.tone}`}>
              <span className={`app-settings__status-dot app-settings__status-dot--${sqliteMirrorStatus.tone}`} />
              {sqliteMirrorStatus.label}
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

      {/* First-run guidance: service is up but the local copy has never been prepared. */}
      {bridgePhase === "connected" &&
      mirrorStatus !== null &&
      mirrorStatus.latestImportRuns.length === 0 ? (
        <div className="app-settings__first-run-callout" role="status" aria-label="First-run setup complete">
          <p className="app-settings__first-run-callout-title">
            <strong>Setup complete — next step: prepare your local copy</strong>
          </p>
          <p className="app-settings__first-run-callout-body">
            The clinic service is running. To enable search and schedule, complete first-run setup
            with a copied clinic data folder, then click Refresh status above.
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

      <div
        className="clinic-stat-grid clinic-settings-readiness-grid"
        role="region"
        aria-label="Clinic readiness overview"
      >
        <SettingsReadinessCard
          title={SETTINGS_BRIDGE_SECTION}
          statusLabel={bridgeLabel}
          explanation={bridgeLabel}
          tone={bridgePhase}
          statTone={clinicStatTone(bridgePhase)}
          cardKey="bridge"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
        <SettingsReadinessCard
          title={SETTINGS_DATA_PATHS_SECTION}
          statusLabel={dataRootStatus.label}
          explanation={dataRootStatus.label}
          tone={dataRootStatus.tone}
          cardKey="dataRoot"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
        <SettingsReadinessCard
          title={SETTINGS_MIRROR_SECTION}
          statusLabel={mirrorHeroValue}
          explanation={SETTINGS_MIRROR_DBF_SOURCE_TRUTH}
          tone={mirrorCardTone(bridgePhase, mirrorStale)}
          cardKey="mirror"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
        <SettingsReadinessCard
          title={SETTINGS_WRITE_SECTION}
          statusLabel={writeHeroValue}
          explanation={writeHeroValue}
          tone={writeCardTone(writeCapability)}
          statTone={writeStatTone(writeCapability)}
          cardKey="write"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
        <SettingsReadinessCard
          title={SETTINGS_SANDBOX_SECTION}
          statusLabel={sandboxStatus.label}
          explanation={sandboxStatus.label}
          tone={sandboxStatus.tone}
          cardKey="sandbox"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
        <SettingsReadinessCard
          title={SETTINGS_BACKUP_SECTION}
          statusLabel={backupStatus.label}
          explanation={backupStatus.label}
          tone={backupStatus.tone}
          cardKey="backup"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
        <SettingsReadinessCard
          title={SETTINGS_PILOT_BUILD_SECTION}
          statusLabel={buildReadinessLabel}
          explanation={buildReadinessExplanation}
          tone={buildReadinessTone}
          cardKey="pilot"
          bridgePhase={bridgePhase}
          writeCapability={writeCapability}
          mirrorStatus={mirrorStatus}
          sandboxWritePilot={sandboxWritePilot}
        />
      </div>

      <div className="clinic-settings-sections">
        <SettingsSection
          title={SETTINGS_SECTION_DIAGNOSTICS}
          lede={SETTINGS_SECTION_DIAGNOSTICS_LEDE}
          sectionId="settings-section-diagnostics"
        >
        <ClinicPanel
          title={SETTINGS_BRIDGE_SECTION}
          className={settingsPanelClassName(bridgeCardTone(bridgePhase))}
          headerActions={<SettingsPanelStatusDot tone={bridgeCardTone(bridgePhase)} />}
        >
          <p className={`app-settings__status app-settings__status--${bridgePhase}`}>{bridgeLabel}</p>
          <SettingsNextStep card="bridge" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
          {desktopActions?.restartClinicService ? (
            <div className="app-settings__quick-fix">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={restartPhase === "running"}
                onClick={() => void restartClinicService()}
              >
                {restartPhase === "running"
                  ? SETTINGS_QUICK_FIX_RESTARTING_SERVICE
                  : SETTINGS_QUICK_FIX_RESTART_SERVICE}
              </Button>
              {restartPhase === "ok" ? (
                <p className="app-settings__muted" role="status">
                  {SETTINGS_QUICK_FIX_RESTART_SERVICE_SUCCESS}
                </p>
              ) : restartPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {SETTINGS_QUICK_FIX_RESTART_SERVICE_FAILED}
                </p>
              ) : null}
            </div>
          ) : null}
          {desktopActions?.exportSupportLog ? (
            <div className="app-settings__quick-fix">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={supportLogPhase === "running"}
                onClick={() => void exportSupportLog()}
              >
                {supportLogPhase === "running"
                  ? SETTINGS_QUICK_FIX_EXPORTING_SUPPORT_LOG
                  : SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG}
              </Button>
              {supportLogPhase === "ok" ? (
                <p className="app-settings__muted" role="status">
                  {SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG_SUCCESS}
                  {supportLogFileName ? ` File: ${supportLogFileName}` : ""}
                </p>
              ) : supportLogPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {SETTINGS_QUICK_FIX_EXPORT_SUPPORT_LOG_FAILED}
                </p>
              ) : null}
            </div>
          ) : null}
          {desktopActions?.getSupportDiagnostics ? (
            <div className="app-settings__quick-fix">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={supportDiagnosticsPhase === "running"}
                onClick={() => void loadSupportDiagnostics()}
              >
                {supportDiagnosticsPhase === "running"
                  ? SETTINGS_QUICK_FIX_LOADING_DIAGNOSTICS
                  : SETTINGS_QUICK_FIX_VIEW_DIAGNOSTICS}
              </Button>
              {supportDiagnosticsPhase === "ok" && supportDiagnostics ? (
                <ul className="app-settings__facts" role="status" aria-label="Support diagnostics summary">
                  <li>Log files: {supportDiagnostics.logFileCount}</li>
                  <li>Support exports: {supportDiagnostics.supportExportCount}</li>
                  <li>Crash dumps: {supportDiagnostics.crashDumpCount}</li>
                  <li>Latest log update: {formatOptionalTimestamp(supportDiagnostics.latestLogUpdatedAt)}</li>
                  <li>Latest crash dump: {formatOptionalTimestamp(supportDiagnostics.latestCrashDumpUpdatedAt)}</li>
                  {supportDiagnostics.latestSupportExportFileName ? (
                    <li>Latest support export: {supportDiagnostics.latestSupportExportFileName}</li>
                  ) : null}
                  {supportDiagnostics.crashDumpFiles.length > 0 ? (
                    <li>
                      Recent crash files:
                      <ul className="app-settings__facts app-settings__facts--nested" aria-label="Recent crash files">
                        {supportDiagnostics.crashDumpFiles.map((file) => (
                          <li key={`${file.fileName}-${file.updatedAt}`}>
                            {file.fileName} · {file.kind} · {formatBytes(file.sizeBytes)} ·{" "}
                            {formatFinishedAt(file.updatedAt)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null}
                </ul>
              ) : supportDiagnosticsPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {SETTINGS_QUICK_FIX_VIEW_DIAGNOSTICS_FAILED}
                </p>
              ) : null}
            </div>
          ) : null}
          {desktopActions?.previewSupportLog ? (
            <div className="app-settings__quick-fix">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={supportPreviewPhase === "running"}
                onClick={() => void previewSupportLog()}
              >
                {supportPreviewPhase === "running"
                  ? SETTINGS_QUICK_FIX_PREVIEWING_SUPPORT_LOG
                  : SETTINGS_QUICK_FIX_PREVIEW_SUPPORT_LOG}
              </Button>
              {supportPreviewPhase === "ok" && supportPreview ? (
                <div className="app-settings__support-preview" role="status" aria-label="Support log preview">
                  <p className="app-settings__muted">
                    Previewing {supportPreview.lineCount} sanitized support event
                    {supportPreview.lineCount === 1 ? "" : "s"}
                    {supportPreview.fileName ? ` from ${supportPreview.fileName}` : ""}.
                  </p>
                  <ul className="app-settings__facts">
                    {supportPreview.lines.map((line) => (
                      <li key={line.index}>
                        {line.level} · {line.event}: {line.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : supportPreviewPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {SETTINGS_QUICK_FIX_PREVIEW_SUPPORT_LOG_FAILED}
                </p>
              ) : null}
            </div>
          ) : null}
          {desktopActions?.diagnoseClinicServicePort ? (
            <div className="app-settings__quick-fix">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={portDiagnosticPhase === "running"}
                onClick={() => void diagnoseClinicServicePort()}
              >
                {portDiagnosticPhase === "running"
                  ? SETTINGS_QUICK_FIX_CHECKING_PORT
                  : SETTINGS_QUICK_FIX_CHECK_PORT}
              </Button>
              {portDiagnosticPhase === "ok" ? (
                <p className="app-settings__muted" role="status">
                  {portDiagnosticMessage}
                </p>
              ) : portDiagnosticPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {portDiagnosticMessage ?? SETTINGS_QUICK_FIX_CHECK_PORT_FAILED}
                </p>
              ) : null}
            </div>
          ) : null}
          {desktopActions?.getPortCleanupPolicy ? (
            <div className="app-settings__quick-fix">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className="ui-focusable"
                disabled={portPolicyPhase === "running"}
                onClick={() => void loadPortCleanupPolicy()}
              >
                {portPolicyPhase === "running"
                  ? SETTINGS_QUICK_FIX_LOADING_PORT_POLICY
                  : SETTINGS_QUICK_FIX_PORT_CLEANUP_POLICY}
              </Button>
              {portPolicyPhase === "ok" && portPolicy ? (
                <div className="app-settings__support-preview" role="status" aria-label="Port cleanup policy">
                  <p className="app-settings__muted">
                    {portPolicy.message} Automatic cleanup: {portPolicy.canAutoClean ? "available" : "off"}.
                  </p>
                  <ul className="app-settings__facts">
                    {portPolicy.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                    <li>{portPolicy.escalation}</li>
                  </ul>
                </div>
              ) : portPolicyPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {SETTINGS_QUICK_FIX_PORT_CLEANUP_POLICY_FAILED}
                </p>
              ) : null}
            </div>
          ) : null}
          {showConnectionDiagnostics && bridgeBaseUrl?.trim() ? (
            <p className="app-settings__diag" role="note">
              Clinic service URL: {bridgeBaseUrl.trim()}
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
                Clinic data folder: <code>{maskOperatorPath("C:\\Microdent\\Write-Sandbox\\DATA")}</code>
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
              Fast local copy: <code>{MASKED_PATH_HINT_EXAMPLES.sqlite}</code>
            </p>
          ) : null}
        </ClinicPanel>
        </SettingsSection>

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
              {desktopActions?.refreshLocalCopy ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="ui-focusable"
                  disabled={localCopyRefreshPhase === "running"}
                  onClick={() => void refreshLocalCopy()}
                >
                  {localCopyRefreshPhase === "running"
                    ? SETTINGS_QUICK_FIX_REFRESHING_LOCAL_COPY
                    : SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY}
                </Button>
              ) : null}
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
              {localCopyIssue ? (
                <div
                  className={`app-settings__mirror-banner app-settings__mirror-banner--${localCopyIssue.tone === "error" ? "warning" : "info"}`}
                  role={localCopyIssue.tone === "error" ? "alert" : "status"}
                >
                  <strong>{localCopyIssue.title}</strong>
                  <p>{localCopyIssue.body}</p>
                </div>
              ) : null}
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
              {localCopyRefreshPhase === "running" ? (
                <p className="app-settings__muted" role="status">
                  {localCopyRefreshProgress
                    ? `${localCopyRefreshProgress.label} (${Math.round(localCopyRefreshProgress.percent)}%)`
                    : SETTINGS_QUICK_FIX_REFRESHING_LOCAL_COPY}
                </p>
              ) : localCopyRefreshPhase === "ok" ? (
                <p className="app-settings__muted" role="status">
                  {SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY_SUCCESS}
                </p>
              ) : localCopyRefreshPhase === "failed" ? (
                <p className="app-settings__error" role="alert">
                  {SETTINGS_QUICK_FIX_REFRESH_LOCAL_COPY_FAILED}
                </p>
              ) : null}
              {runs.length === 0 ? (
                <>
                  <div className="app-settings__import-prompt">
                    {desktopActions?.refreshLocalCopy ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        className="ui-focusable"
                        disabled={localCopyRefreshPhase === "running"}
                        onClick={() => void refreshLocalCopy()}
                      >
                        {localCopyRefreshPhase === "running"
                          ? SETTINGS_QUICK_FIX_REFRESHING_LOCAL_COPY
                          : SETTINGS_IMPORT_LOCAL_COPY_BUTTON}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        className="ui-focusable"
                        onClick={() => setShowImportGuide((prev) => !prev)}
                      >
                        {SETTINGS_IMPORT_LOCAL_COPY_BUTTON}
                      </Button>
                    )}
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
                    <caption className="app-sr-only">Latest local copy refresh runs per table</caption>
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
                              semanticLabel={`Local copy refresh for ${run.tableName}: ${mirrorRunStatusLabel(run.status)}`}
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

        <SettingsSection
          title={SETTINGS_SECTION_EDITING}
          lede={SETTINGS_SECTION_EDITING_LEDE}
          sectionId="settings-section-editing"
        >
        <ClinicPanel
          title={SETTINGS_WRITE_SECTION}
          className={settingsPanelClassName(writeCardTone(writeCapability), { primary: true })}
          headerActions={<SettingsPanelStatusDot tone={writeCardTone(writeCapability)} />}
        >
          {writeChip ? (
            <Badge
              variant={writeChip.variant}
              className="app-settings__chip"
              semanticLabel={`Editing mode: ${writeChip.label}`}
            >
              {writeChip.label}
            </Badge>
          ) : (
            <p className="app-settings__muted">Connect the clinic service to load write mode.</p>
          )}
          <SettingsNextStep card="write" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
        </ClinicPanel>

        <ClinicPanel
          title={SETTINGS_SANDBOX_SECTION}
          className={settingsPanelClassName(sandboxStatus.tone)}
          headerActions={<SettingsPanelStatusDot tone={sandboxStatus.tone} />}
        >
          <p className={`app-settings__status app-settings__status--${sandboxStatus.tone}`}>{sandboxStatus.label}</p>
          <SettingsNextStep card="sandbox" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
        </ClinicPanel>

        <ClinicPanel
          title={SETTINGS_PILOT_SECTION}
          className={settingsPanelClassName("neutral")}
          headerActions={<SettingsPanelStatusDot tone="neutral" />}
        >
          <p className="app-settings__muted">
            {sandboxWritePilot ? SETTINGS_SANDBOX_PILOT_ON : SETTINGS_SANDBOX_PILOT_OFF}
          </p>
          <SettingsNextStep card="pilot" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
        </ClinicPanel>
        </SettingsSection>

        <SettingsSection
          title={SETTINGS_SECTION_BACKUP}
          lede={SETTINGS_SECTION_BACKUP_LEDE}
          sectionId="settings-section-backup"
        >
        <ClinicPanel
          title={SETTINGS_BACKUP_SECTION}
          className={settingsPanelClassName(backupStatus.tone)}
          headerActions={<SettingsPanelStatusDot tone={backupStatus.tone} />}
        >
          <p className={`app-settings__status app-settings__status--${backupStatus.tone}`}>{backupStatus.label}</p>
          {showBackupReadonlyNote ? (
            <p className="app-settings__muted" role="note">
              {SETTINGS_BACKUP_READONLY_NOTE}
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

        <SettingsSection
          title={SETTINGS_SECTION_PACKAGE}
          lede={SETTINGS_SECTION_PACKAGE_LEDE}
          sectionId="settings-section-package"
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
        </ClinicPanel>
        </SettingsSection>

        <SettingsSection
          title={SETTINGS_SECTION_FIELD_TEST}
          lede={SETTINGS_SECTION_FIELD_TEST_LEDE}
          sectionId="settings-section-field-test"
        >
        <ClinicPanel
          title={SETTINGS_PILOT_NOTES_TITLE}
          className={`${settingsPanelClassName("neutral")} clinic-settings-panel--field-test`}
          headerActions={<SettingsPanelStatusDot tone="neutral" />}
        >
          <ul className="app-settings__pilot-notes">
            <li>{SETTINGS_PILOT_NOTES_READINESS}</li>
            <li>{SETTINGS_PILOT_NOTES_REMINDERS}</li>
            <li>{SETTINGS_PILOT_NOTES_FOOTNOTE}</li>
          </ul>
          <p className="app-settings__muted app-settings__field-test-doc" role="note">
            {SETTINGS_READINESS_FIELD_TEST_DOC_HINT}
          </p>
        </ClinicPanel>
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
