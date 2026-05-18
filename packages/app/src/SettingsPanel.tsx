import { createBridgeClient } from "@microdent/bridge-client";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { useCallback, useState } from "react";
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
  SETTINGS_MIRROR_NO_RUNS,
  SETTINGS_MIRROR_REFRESH,
  SETTINGS_MIRROR_RUN_STATUS_FAILED,
  SETTINGS_MIRROR_RUN_STATUS_PARTIAL,
  SETTINGS_MIRROR_RUN_STATUS_RUNNING,
  SETTINGS_MIRROR_RUN_STATUS_SUCCESS,
  SETTINGS_MIRROR_SECTION,
  SETTINGS_MIRROR_STALE_CALLOUT,
  SETTINGS_PILOT_SECTION,
  SETTINGS_PANEL_LEDE,
  SETTINGS_SANDBOX_PILOT_OFF,
  SETTINGS_SANDBOX_PILOT_ON,
  SETTINGS_SANDBOX_SECTION,
  SETTINGS_SQLITE_MIRROR_SECTION,
  SETTINGS_WRITE_SECTION,
} from "./read-only-ui-copy.js";
import {
  resolveBackupConfiguredStatus,
  resolveDataRootConfiguredStatus,
  resolveSandboxValidityStatus,
  resolveSqliteMirrorStatus,
} from "./settings-status.js";
import {
  resolveSettingsDangerBanners,
  resolveWriteModeChip,
} from "./shell-status-banners.js";

export type SettingsPanelProps = {
  bridgePhase: BridgeHealthPhase;
  bridgeBaseUrl?: string;
  fetchImpl?: typeof fetch;
  writeCapability: BridgeDevStatusResponse | null;
  mirrorStatus: MirrorStatusResponse | null;
  onMirrorStatusChange: (status: MirrorStatusResponse | null) => void;
  /** When true, sandbox write pilot UI may appear elsewhere (from host env). */
  sandboxWritePilot?: boolean;
  showConnectionDiagnostics?: boolean;
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
  return showConnectionDiagnostics;
}

export function SettingsPanel({
  bridgePhase,
  bridgeBaseUrl,
  fetchImpl,
  writeCapability,
  mirrorStatus,
  onMirrorStatusChange,
  sandboxWritePilot = false,
  showConnectionDiagnostics = false,
}: SettingsPanelProps) {
  const [mirrorRefreshing, setMirrorRefreshing] = useState(false);
  const [mirrorRefreshError, setMirrorRefreshError] = useState(false);

  const writeChip = resolveWriteModeChip(writeCapability);
  const dataRootStatus = resolveDataRootConfiguredStatus(writeCapability);
  const sandboxStatus = resolveSandboxValidityStatus(writeCapability);
  const backupStatus = resolveBackupConfiguredStatus(writeCapability);
  const sqliteMirrorStatus = resolveSqliteMirrorStatus(bridgePhase, mirrorStatus, writeCapability);
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
    <div className="app-settings" aria-labelledby="settings-panel-title">
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

      <div className="app-settings__grid">
        <Card className="app-settings__card">
          <CardHeader>
            <h3 id="settings-panel-title">{SETTINGS_BRIDGE_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${bridgePhase}`}>{bridgeLabel}</p>
            {showConnectionDiagnostics && bridgeBaseUrl?.trim() ? (
              <p className="app-settings__diag" role="note">
                Bridge URL: {bridgeBaseUrl.trim()}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="app-settings__card">
          <CardHeader>
            <h3>{SETTINGS_DATA_PATHS_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${dataRootStatus.tone}`}>{dataRootStatus.label}</p>
            {devHints ? (
              <ul className="app-settings__path-hints" role="note">
                <li>
                  DATA layout: <code>{maskOperatorPath("C:\\Microdent\\Write-Sandbox\\DATA")}</code>
                </li>
              </ul>
            ) : null}
          </CardBody>
        </Card>

        <Card className="app-settings__card">
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
          </CardBody>
        </Card>

        <Card className="app-settings__card">
          <CardHeader>
            <h3>{SETTINGS_SANDBOX_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${sandboxStatus.tone}`}>{sandboxStatus.label}</p>
          </CardBody>
        </Card>

        <Card className="app-settings__card">
          <CardHeader>
            <h3>{SETTINGS_BACKUP_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${backupStatus.tone}`}>{backupStatus.label}</p>
            {devHints && writeCapability?.backupDirConfigured ? (
              <p className="app-settings__path-hints" role="note">
                <code>{MASKED_PATH_HINT_EXAMPLES.backup}</code>
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="app-settings__card">
          <CardHeader>
            <h3>{SETTINGS_PILOT_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className="app-settings__muted">
              {sandboxWritePilot ? SETTINGS_SANDBOX_PILOT_ON : SETTINGS_SANDBOX_PILOT_OFF}
            </p>
          </CardBody>
        </Card>

        <Card className="app-settings__card">
          <CardHeader>
            <h3>{SETTINGS_DESKTOP_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className="app-settings__muted">
              {isDesktopFileProtocol() ? SETTINGS_DESKTOP_FILE_PROTOCOL : SETTINGS_DESKTOP_BROWSER}
            </p>
          </CardBody>
        </Card>

        <Card className="app-settings__card">
          <CardHeader>
            <h3>{SETTINGS_SQLITE_MIRROR_SECTION}</h3>
          </CardHeader>
          <CardBody>
            <p className={`app-settings__status app-settings__status--${sqliteMirrorStatus.tone}`}>
              {sqliteMirrorStatus.label}
            </p>
            {devHints && writeCapability?.sqlitePathConfigured ? (
              <p className="app-settings__path-hints" role="note">
                SQLite: <code>{MASKED_PATH_HINT_EXAMPLES.sqlite}</code>
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="app-settings__card app-settings__card--mirror">
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
                  <p className="app-settings__muted">
                    {SETTINGS_MIRROR_NO_RUNS} {SETTINGS_MIRROR_IMPORT_CLI}{" "}
                    <span className="app-settings__doc-ref">{SETTINGS_MIRROR_DOC_LINK}</span> (
                    <code>{MIRROR_DOC_PATH}</code>)
                  </p>
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
