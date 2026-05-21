import type { BridgeDevStatusResponse, MirrorStatusResponse, WriteMode } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import {
  MIRROR_ACTIVE_BANNER_BODY,
  MIRROR_ACTIVE_BANNER_LABEL,
  MIRROR_FALLBACK_BANNER_BODY,
  MIRROR_FALLBACK_BANNER_LABEL,
  MIRROR_STALE_BANNER_BODY,
  MIRROR_STALE_BANNER_LABEL,
  SANDBOX_WRITE_WARNING_BANNER_BODY,
  SANDBOX_WRITE_WARNING_BANNER_LABEL,
  SETTINGS_BRIDGE_OFFLINE_BANNER_BODY,
  SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_BODY,
  SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_LABEL,
  SETTINGS_BRIDGE_OFFLINE_BANNER_LABEL,
  SETTINGS_ENABLED_NON_SANDBOX_BANNER_BODY,
  SETTINGS_ENABLED_NON_SANDBOX_BANNER_LABEL,
  WRITE_MODE_CHIP_DISABLED,
  WRITE_MODE_CHIP_DRY_RUN,
  WRITE_MODE_CHIP_ENABLED,
  WRITE_MODE_DISABLED_BANNER_BODY,
  WRITE_MODE_DISABLED_BANNER_LABEL,
  WRITE_MODE_DRY_RUN_BANNER_BODY,
  WRITE_MODE_DRY_RUN_BANNER_LABEL,
  WRITE_MODE_ENABLED_BANNER_BODY,
  WRITE_MODE_ENABLED_BANNER_LABEL,
} from "./read-only-ui-copy.js";
import { isMirrorImportStale, resolveMirrorStaleBanner } from "./mirror-stale.js";

export type ShellStatusBanner = {
  key: string;
  label: string;
  body: string;
  tone: "info" | "warning" | "danger";
};

export type WriteModeChip = {
  label: string;
  variant: "neutral" | "warning" | "danger";
};

/**
 * Mirror connection banner: stale (warning), DBF fallback (warning), or active (info).
 * Returns null when the bridge is offline or mirror status is unknown.
 */
export function resolveMirrorConnectionBanner(
  phase: BridgeHealthPhase,
  status: MirrorStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner | null {
  if (phase !== "connected" || status === null) return null;

  const stale = resolveMirrorStaleBanner(phase, status, {
    label: MIRROR_STALE_BANNER_LABEL,
    body: MIRROR_STALE_BANNER_BODY,
  }, nowMs);
  if (stale) {
    return {
      key: "mirror-stale",
      label: stale.label,
      body: stale.body,
      tone: "warning",
    };
  }

  if (!status.sqliteUsable) {
    return {
      key: "mirror-fallback",
      label: MIRROR_FALLBACK_BANNER_LABEL,
      body: MIRROR_FALLBACK_BANNER_BODY,
      tone: "warning",
    };
  }

  return {
    key: "mirror-active",
    label: MIRROR_ACTIVE_BANNER_LABEL,
    body: MIRROR_ACTIVE_BANNER_BODY,
    tone: "info",
  };
}

/** Exposed for tests that assert stale detection without duplicating mirror-stale imports. */
export { isMirrorImportStale };

const WRITE_MODE_BANNERS: Record<
  WriteMode,
  Pick<ShellStatusBanner, "label" | "body" | "tone">
> = {
  disabled: {
    label: WRITE_MODE_DISABLED_BANNER_LABEL,
    body: WRITE_MODE_DISABLED_BANNER_BODY,
    tone: "info",
  },
  "dry-run": {
    label: WRITE_MODE_DRY_RUN_BANNER_LABEL,
    body: WRITE_MODE_DRY_RUN_BANNER_BODY,
    tone: "warning",
  },
  enabled: {
    label: WRITE_MODE_ENABLED_BANNER_LABEL,
    body: WRITE_MODE_ENABLED_BANNER_BODY,
    tone: "danger",
  },
};

/**
 * Write-mode banner from `GET /v1/meta/write-capability`.
 */
export function resolveWriteModeBanner(
  phase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
): ShellStatusBanner | null {
  if (phase !== "connected" || writeCapability === null) return null;
  const copy = WRITE_MODE_BANNERS[writeCapability.writeMode];
  return {
    key: `write-mode-${writeCapability.writeMode}`,
    label: copy.label,
    body: copy.body,
    tone: copy.tone,
  };
}

/**
 * Danger when write mode is enabled but BACKUP_DIR is not configured.
 */
export function resolveBackupNotConfiguredBanner(
  phase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
): ShellStatusBanner | null {
  if (phase !== "connected" || writeCapability === null) return null;
  if (writeCapability.writeMode !== "enabled" || writeCapability.backupDirConfigured) {
    return null;
  }
  return {
    key: "backup-not-configured",
    label: SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_LABEL,
    body: SETTINGS_BACKUP_NOT_CONFIGURED_BANNER_BODY,
    tone: "danger",
  };
}

/**
 * Danger when write mode is enabled but DATA_ROOT is not a validated disposable sandbox.
 */
export function resolveEnabledNonSandboxBanner(
  phase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
): ShellStatusBanner | null {
  if (phase !== "connected" || writeCapability === null) return null;
  if (writeCapability.writeMode !== "enabled" || writeCapability.writableSandbox) {
    return null;
  }
  return {
    key: "enabled-non-sandbox",
    label: SETTINGS_ENABLED_NON_SANDBOX_BANNER_LABEL,
    body: SETTINGS_ENABLED_NON_SANDBOX_BANNER_BODY,
    tone: "danger",
  };
}

/** Settings-only callout when the clinic service is not connected. */
export function resolveBridgeOfflineBanner(phase: BridgeHealthPhase): ShellStatusBanner | null {
  if (phase === "connected") return null;
  return {
    key: "bridge-offline",
    label: SETTINGS_BRIDGE_OFFLINE_BANNER_LABEL,
    body: SETTINGS_BRIDGE_OFFLINE_BANNER_BODY,
    tone: phase === "checking" ? "info" : "warning",
  };
}

/**
 * Danger and warning banners for the Settings dashboard (excludes informational mirror-active).
 */
export function resolveSettingsDangerBanners(
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const banners: ShellStatusBanner[] = [];
  const offline = resolveBridgeOfflineBanner(phase);
  if (offline && offline.tone !== "info") banners.push(offline);
  const mirror = resolveMirrorConnectionBanner(phase, mirrorStatus, nowMs);
  if (mirror && mirror.tone !== "info") banners.push(mirror);
  const writeMode = resolveWriteModeBanner(phase, writeCapability);
  if (writeMode && writeMode.tone === "danger") banners.push(writeMode);
  const nonSandbox = resolveEnabledNonSandboxBanner(phase, writeCapability);
  if (nonSandbox) banners.push(nonSandbox);
  const backupMissing = resolveBackupNotConfiguredBanner(phase, writeCapability);
  if (backupMissing) banners.push(backupMissing);
  const sandbox = resolveSandboxWriteWarningBanner(phase, writeCapability);
  if (sandbox) banners.push(sandbox);
  return banners;
}

/**
 * Extra warning when enabled writes target a disposable sandbox.
 */
export function resolveSandboxWriteWarningBanner(
  phase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
): ShellStatusBanner | null {
  if (phase !== "connected" || writeCapability === null) return null;
  if (writeCapability.writeMode !== "enabled" || !writeCapability.writableSandbox) {
    return null;
  }
  return {
    key: "sandbox-write-warning",
    label: SANDBOX_WRITE_WARNING_BANNER_LABEL,
    body: SANDBOX_WRITE_WARNING_BANNER_BODY,
    tone: "danger",
  };
}

export type AppShellModuleId = "today" | "patients" | "schedule" | "settings";

/** Sidebar recent-patient mini-list cap (session store may hold more). */
export const SIDEBAR_RECENT_PATIENTS_MAX = 4;

export type ShellHeaderMirrorPill = {
  label: string;
  tone: "ok" | "warn" | "neutral";
};

/**
 * Compact mirror label for the workspace header pill cluster (not a full-width strip).
 */
export function resolveShellHeaderMirrorPill(
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  nowMs: number = Date.now(),
): ShellHeaderMirrorPill | null {
  if (phase !== "connected" || mirrorStatus === null) return null;
  if (isMirrorImportStale(mirrorStatus, nowMs)) {
    return { label: "Mirror stale", tone: "warn" };
  }
  if (!mirrorStatus.sqliteUsable) {
    return { label: "Mirror: DBF fallback", tone: "warn" };
  }
  return { label: "Mirror OK", tone: "ok" };
}

/**
 * Critical-only banners for the optional compact strip (bridge down, writes blocked, sandbox danger).
 * Warning/info mirror and write-mode copy live in header pills or page panels — not duplicate strips.
 */
export function resolveShellCriticalStripBanners(
  active: AppShellModuleId,
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const contextual = resolveContextualStatusForModule(active, phase, mirrorStatus, writeCapability, nowMs);
  return contextual.filter((b) => b.tone === "danger");
}

/**
 * Non-critical banners for `clinic-panel` inner surfaces (pages render these inside panels).
 */
export function resolveShellPanelBanners(
  active: AppShellModuleId,
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const stripKeys = new Set(
    resolveShellCriticalStripBanners(active, phase, mirrorStatus, writeCapability, nowMs).map((b) => b.key),
  );
  let banners = resolveShellStatusBanners(phase, mirrorStatus, writeCapability, nowMs).filter(
    (b) => b.tone !== "danger" && !stripKeys.has(b.key),
  );
  if (active === "settings") {
    banners = omitShellBannersDetailedInSettings(banners, phase, mirrorStatus, writeCapability, nowMs);
  }
  return banners;
}

/**
 * Side-column ops hints (stale mirror, dry-run writes) — not shown as global strips.
 */
export function resolveShellSideOpsBanners(
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const banners: ShellStatusBanner[] = [];
  const mirror = resolveMirrorConnectionBanner(phase, mirrorStatus, nowMs);
  if (mirror && (mirror.tone === "warning" || mirror.key === "mirror-stale")) {
    banners.push(mirror);
  }
  const writeMode = resolveWriteModeBanner(phase, writeCapability);
  if (writeMode && writeMode.tone === "warning") {
    banners.push(writeMode);
  }
  return banners;
}

/**
 * @deprecated Prefer {@link resolveShellCriticalStripBanners} for the shell strip.
 * Returns danger-only banners for the global status strip.
 */
export function resolveContextualStatusForModule(
  active: AppShellModuleId,
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const all = resolveShellStatusBanners(phase, mirrorStatus, writeCapability, nowMs);
  const dangerOnly = all.filter((b) => b.tone === "danger");
  if (active === "settings") {
    return omitShellBannersDetailedInSettings(dangerOnly, phase, mirrorStatus, writeCapability, nowMs);
  }
  return dangerOnly;
}

/** Ordered production banners (read-only banner is rendered separately in AppShell). */
export function resolveShellStatusBanners(
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const banners: ShellStatusBanner[] = [];
  const mirror = resolveMirrorConnectionBanner(phase, mirrorStatus, nowMs);
  if (mirror) banners.push(mirror);
  const writeMode = resolveWriteModeBanner(phase, writeCapability);
  if (writeMode) banners.push(writeMode);
  const sandbox = resolveSandboxWriteWarningBanner(phase, writeCapability);
  if (sandbox) banners.push(sandbox);
  return banners;
}

/**
 * Omits shell banners that are expanded in Settings danger callouts so operators do not see duplicates.
 * Informational shell banners (e.g. mirror-active, writes off) remain visible globally.
 */
export function omitShellBannersDetailedInSettings(
  shellBanners: ShellStatusBanner[],
  phase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
  nowMs: number = Date.now(),
): ShellStatusBanner[] {
  const detailKeys = new Set(
    resolveSettingsDangerBanners(phase, mirrorStatus, writeCapability, nowMs).map((b) => b.key),
  );
  return shellBanners.filter((banner) => !detailKeys.has(banner.key));
}

/** Compact schedule chip label; null when capability is unknown. */
export function resolveWriteModeChip(
  writeCapability: BridgeDevStatusResponse | null,
): WriteModeChip | null {
  if (!writeCapability) return null;
  switch (writeCapability.writeMode) {
    case "disabled":
      return { label: WRITE_MODE_CHIP_DISABLED, variant: "neutral" };
    case "dry-run":
      return { label: WRITE_MODE_CHIP_DRY_RUN, variant: "warning" };
    case "enabled":
      return { label: WRITE_MODE_CHIP_ENABLED, variant: "danger" };
    default:
      return null;
  }
}
