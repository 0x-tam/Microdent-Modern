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
