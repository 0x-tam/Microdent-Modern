import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@microdent/ui";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import { MASKED_PATH_HINT_EXAMPLES, maskOperatorPath } from "./mask-operator-path.js";
import {
  SETTINGS_BACKUP_SECTION,
  SETTINGS_BRIDGE_CHECKING,
  SETTINGS_BRIDGE_CONNECTED,
  SETTINGS_BRIDGE_OFFLINE,
  SETTINGS_BRIDGE_SECTION,
  SETTINGS_DATA_PATHS_SECTION,
  SETTINGS_DESKTOP_BROWSER,
  SETTINGS_DESKTOP_FILE_PROTOCOL,
  SETTINGS_DESKTOP_SECTION,
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
  SETTINGS_PILOT_READINESS_TITLE,
  SETTINGS_PILOT_CHECKLIST_TITLE,
  SETTINGS_PILOT_SECTION,
  SETTINGS_PILOT_BUILD_APP_VERSION,
  SETTINGS_PILOT_BUILD_BUILT,
  SETTINGS_PILOT_BUILD_CHANNEL,
  SETTINGS_PILOT_BUILD_COMMIT,
  SETTINGS_PILOT_BUILD_LOADING,
  SETTINGS_PILOT_BUILD_PACKAGE_VERSION,
  SETTINGS_PILOT_BUILD_SECTION,
  SETTINGS_PILOT_BUILD_UNAVAILABLE,
  SETTINGS_PANEL_LEDE,
  SETTINGS_SANDBOX_PILOT_OFF,
  SETTINGS_SANDBOX_PILOT_ON,
  SETTINGS_SANDBOX_SECTION,
  SETTINGS_SQLITE_MIRROR_SECTION,
  SETTINGS_TODAY_OVERVIEW_HINT,
  SETTINGS_OPEN_TODAY_BUTTON,
  SETTINGS_WRITE_SECTION,
} from "./read-only-ui-copy.js";
import {
  resolvePilotBuildMetadata,
  type PilotBuildMetadata,
} from "./pilot-build-metadata.js";
import type { SettingsStatusTone } from "./settings-status.js";
import {
  resolveBackupConfiguredStatus,
  resolveDataRootConfiguredStatus,
  resolvePilotReadinessSummary,
  resolvePilotReadinessChecklist,
  resolveSandboxValidityStatus,
  resolveSqliteMirrorStatus,
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
  /** Navigate to Today module from operator cross-link. */
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

function settingsCardClassName(
  tone: SettingsStatusTone | null,
  options?: { primary?: boolean; wide?: boolean },
): string {
  const parts = ["app-settings__card"];
  if (options?.primary) parts.push("app-settings__card--primary");
  if (options?.wide) parts.push("app-settings__card--mirror");
  if (tone === "danger") parts.push("app-settings__card--danger");
  else if (tone === "warn") parts.push("app-settings__card--warn");
  else if (tone === "ok") parts.push("app-settings__card--ok");
  return parts.join(" ");
}

function bridgeCardTone(phase: BridgeHealthPhase): SettingsStatusTone {
  if (phase === "connected") return "ok";
  if (phase === "checking") return "neutral";
  return "warn";
}

function writeCardTone(writeCapability: BridgeDevStatusResponse | null): SettingsStatusTone {
  if (!writeCapability) return "neutral";
  if (writeCapability.writeMode === "enabled") {
    return writeCapability.writableSandbox ? "danger" : "warn";
  }
  if (writeCapability.writeMode === "dry-run") return "warn";
  return "ok";
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

type SettingsNextStepProps = {
  card: SettingsCardKey;
  bridgePhase: BridgeHealthPhase;
  writeCapability: BridgeDevStatusResponse | null;
  mirrorStatus: MirrorStatusResponse | null;
  sandboxWritePilot?: boolean;
};

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

  useEffect(() => {
    let cancelled = false;
    void resolvePilotBuildMetadata(fetchImpl).then((metadata) => {
      if (!cancelled) setPilotBuild(metadata);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

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

  const importedCount = mirrorStatus?.importedTables.length ?? 0;
  const runs = mirrorStatus?.latestImportRuns ?? [];

  return (
    <div className="app-workspace-page app-settings" aria-labelledby="settings-panel-title">
      <header className="app-page-hero">
        <div>
          <h2 className="app-page-hero__title" id="settings-panel-title">{moduleTitle}</h2>
          {moduleDescription ? <p className="app-page-hero__meta">{moduleDescription}</p> : null}
        </div>
      </header>
      <p className="app-settings__lede">{SETTINGS_PANEL_LEDE}</p>

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
          <p className="app-settings__today-hint" role="note">
            {SETTINGS_TODAY_OVERVIEW_HINT}
            {onOpenToday ? (
              <>
                {" "}
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="ui-focusable app-settings__today-btn"
                  onClick={onOpenToday}
                >
                  {SETTINGS_OPEN_TODAY_BUTTON}
                </Button>
              </>
            ) : null}
          </p>
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

      <div className="app-settings__grid">
        <Card className={settingsCardClassName(bridgeCardTone(bridgePhase), { primary: true })}>
          <CardHeader>
            <h3 id="settings-panel-title">{SETTINGS_BRIDGE_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${bridgePhase}`}>{bridgeLabel}</p>
            <SettingsNextStep card="bridge" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            {showConnectionDiagnostics && bridgeBaseUrl?.trim() ? (
              <p className="app-settings__diag" role="note">
                Bridge URL: {bridgeBaseUrl.trim()}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className={settingsCardClassName(dataRootStatus.tone)}>
          <CardHeader>
            <h3>{SETTINGS_DATA_PATHS_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${dataRootStatus.tone}`}>{dataRootStatus.label}</p>
            <SettingsNextStep card="dataRoot" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            {devHints ? (
              <ul className="app-settings__path-hints" role="note">
                <li>
                  DATA layout: <code>{maskOperatorPath("C:\\Microdent\\Write-Sandbox\\DATA")}</code>
                </li>
              </ul>
            ) : null}
          </CardBody>
        </Card>

        <Card className={settingsCardClassName(writeCardTone(writeCapability), { primary: true })}>
          <CardHeader>
            <h3>{SETTINGS_WRITE_SECTION}</h3>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>

        <Card className={settingsCardClassName(sandboxStatus.tone)}>
          <CardHeader>
            <h3>{SETTINGS_SANDBOX_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${sandboxStatus.tone}`}>{sandboxStatus.label}</p>
            <SettingsNextStep card="sandbox" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
          </CardBody>
        </Card>

        <Card className={settingsCardClassName(backupStatus.tone)}>
          <CardHeader>
            <h3>{SETTINGS_BACKUP_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${backupStatus.tone}`}>{backupStatus.label}</p>
            <SettingsNextStep card="backup" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
            {devHints && writeCapability?.backupDirConfigured ? (
              <p className="app-settings__path-hints" role="note">
                <code>{MASKED_PATH_HINT_EXAMPLES.backup}</code>
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className={settingsCardClassName("neutral")}>
          <CardHeader>
            <h3>{SETTINGS_PILOT_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className="app-settings__muted">
              {sandboxWritePilot ? SETTINGS_SANDBOX_PILOT_ON : SETTINGS_SANDBOX_PILOT_OFF}
            </p>
            <SettingsNextStep card="pilot" {...{ bridgePhase, writeCapability, mirrorStatus, sandboxWritePilot }} />
          </CardBody>
        </Card>

        <Card className={settingsCardClassName("neutral")}>
          <CardHeader>
            <h3>{SETTINGS_PILOT_BUILD_SECTION}</h3>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>

        <Card className={settingsCardClassName("neutral")}>
          <CardHeader>
            <h3>{SETTINGS_DESKTOP_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className="app-settings__muted">
              {isDesktopFileProtocol() ? SETTINGS_DESKTOP_FILE_PROTOCOL : SETTINGS_DESKTOP_BROWSER}
            </p>
          </CardBody>
        </Card>

        <Card className={settingsCardClassName(sqliteMirrorStatus.tone)}>
          <CardHeader>
            <h3>{SETTINGS_SQLITE_MIRROR_SECTION}</h3>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>

        <Card className={settingsCardClassName(mirrorStale ? "warn" : sqliteMirrorStatus.tone, { primary: true, wide: true })}>
          <CardHeader className="app-settings__mirror-head">
            <h3>{SETTINGS_MIRROR_SECTION}</h3>
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
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
