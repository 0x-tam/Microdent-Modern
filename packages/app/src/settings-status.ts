import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import {
  SETTINGS_BACKUP_CONFIGURED,
  SETTINGS_BACKUP_NOT_CONFIGURED,
  SETTINGS_BACKUP_NOT_REQUIRED,
  SETTINGS_BACKUP_UNKNOWN,
  SETTINGS_DATA_ROOT_CONFIGURED,
  SETTINGS_DATA_ROOT_MISSING,
  SETTINGS_DATA_ROOT_UNKNOWN,
  SETTINGS_MIRROR_FALLBACK,
  SETTINGS_MIRROR_SQLITE_CONFIGURED,
  SETTINGS_MIRROR_SQLITE_MISSING,
  SETTINGS_MIRROR_USABLE,
  SETTINGS_PILOT_READINESS_TITLE,
  SETTINGS_READINESS_BRIDGE_OFFLINE,
  SETTINGS_READINESS_MIRROR_ACTIVE,
  SETTINGS_READINESS_MIRROR_FALLBACK,
  SETTINGS_READINESS_MIRROR_STALE,
  SETTINGS_READINESS_MIRROR_UNKNOWN,
  SETTINGS_READINESS_READ_ONLY,
  SETTINGS_READINESS_SANDBOX_NOT_READY,
  SETTINGS_READINESS_SANDBOX_READY,
  SETTINGS_READINESS_WRITES_ACTIVE,
  SETTINGS_SANDBOX_INVALID,
  SETTINGS_SANDBOX_UNKNOWN,
  SETTINGS_SANDBOX_VALID,
  SETTINGS_SQLITE_MIRROR_UNKNOWN,
} from "./read-only-ui-copy.js";
import { isMirrorImportStale } from "./mirror-stale.js";

export type SettingsStatusTone = "neutral" | "ok" | "warn" | "danger";

export type SettingsLabeledStatus = {
  label: string;
  tone: SettingsStatusTone;
};

export function resolveDataRootConfiguredStatus(
  writeCapability: BridgeDevStatusResponse | null,
): SettingsLabeledStatus {
  if (!writeCapability) {
    return { label: SETTINGS_DATA_ROOT_UNKNOWN, tone: "neutral" };
  }
  if (writeCapability.dataRootConfigured) {
    return { label: SETTINGS_DATA_ROOT_CONFIGURED, tone: "ok" };
  }
  return { label: SETTINGS_DATA_ROOT_MISSING, tone: "warn" };
}

export function resolveSandboxValidityStatus(
  writeCapability: BridgeDevStatusResponse | null,
): SettingsLabeledStatus {
  if (!writeCapability) {
    return { label: SETTINGS_SANDBOX_UNKNOWN, tone: "neutral" };
  }
  if (writeCapability.writableSandbox) {
    return { label: SETTINGS_SANDBOX_VALID, tone: "ok" };
  }
  return { label: SETTINGS_SANDBOX_INVALID, tone: "warn" };
}

/**
 * Backup readiness from write-capability metadata only (no paths).
 */
export function resolveSqliteMirrorStatus(
  bridgePhase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  writeCapability: BridgeDevStatusResponse | null,
): SettingsLabeledStatus {
  if (bridgePhase !== "connected") {
    return { label: SETTINGS_SQLITE_MIRROR_UNKNOWN, tone: "neutral" };
  }
  if (mirrorStatus === null) {
    return { label: SETTINGS_SQLITE_MIRROR_UNKNOWN, tone: "neutral" };
  }
  const configured = mirrorStatus.sqliteConfigured ?? writeCapability?.sqlitePathConfigured ?? false;
  if (!configured) {
    return { label: SETTINGS_MIRROR_SQLITE_MISSING, tone: "warn" };
  }
  if (mirrorStatus.sqliteUsable) {
    return { label: SETTINGS_MIRROR_USABLE, tone: "ok" };
  }
  return { label: SETTINGS_MIRROR_FALLBACK, tone: "warn" };
}

export function resolveBackupConfiguredStatus(
  writeCapability: BridgeDevStatusResponse | null,
): SettingsLabeledStatus {
  if (!writeCapability) {
    return { label: SETTINGS_BACKUP_UNKNOWN, tone: "neutral" };
  }
  if (writeCapability.writeMode !== "enabled") {
    return { label: SETTINGS_BACKUP_NOT_REQUIRED, tone: "neutral" };
  }
  if (writeCapability.backupDirConfigured) {
    return { label: SETTINGS_BACKUP_CONFIGURED, tone: "ok" };
  }
  return { label: SETTINGS_BACKUP_NOT_CONFIGURED, tone: "warn" };
}

export type PilotReadinessChip = {
  key: string;
  label: string;
  tone: SettingsStatusTone;
};

/**
 * Compact pilot readiness strip for Settings (no paths or PHI).
 */
export function resolvePilotReadinessSummary(
  bridgePhase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
  mirrorStatus: MirrorStatusResponse | null,
  options?: { nowMs?: number },
): PilotReadinessChip[] {
  const nowMs = options?.nowMs ?? Date.now();
  const chips: PilotReadinessChip[] = [];

  if (bridgePhase !== "connected") {
    chips.push({
      key: "bridge-offline",
      label: SETTINGS_READINESS_BRIDGE_OFFLINE,
      tone: "warn",
    });
    return chips;
  }

  if (!writeCapability || writeCapability.writeMode === "disabled") {
    chips.push({ key: "read-only", label: SETTINGS_READINESS_READ_ONLY, tone: "ok" });
  } else {
    chips.push({ key: "writes-active", label: SETTINGS_READINESS_WRITES_ACTIVE, tone: "danger" });
  }

  if (mirrorStatus === null) {
    chips.push({ key: "mirror-unknown", label: SETTINGS_READINESS_MIRROR_UNKNOWN, tone: "neutral" });
  } else if (!mirrorStatus.sqliteUsable) {
    chips.push({ key: "mirror-fallback", label: SETTINGS_READINESS_MIRROR_FALLBACK, tone: "warn" });
  } else if (isMirrorImportStale(mirrorStatus, nowMs)) {
    chips.push({ key: "mirror-stale", label: SETTINGS_READINESS_MIRROR_STALE, tone: "warn" });
  } else {
    chips.push({ key: "mirror-active", label: SETTINGS_READINESS_MIRROR_ACTIVE, tone: "ok" });
  }

  if (writeCapability?.writableSandbox && writeCapability.dataRootConfigured) {
    chips.push({ key: "sandbox-ready", label: SETTINGS_READINESS_SANDBOX_READY, tone: "ok" });
  } else if (writeCapability) {
    chips.push({ key: "sandbox-not-ready", label: SETTINGS_READINESS_SANDBOX_NOT_READY, tone: "warn" });
  }

  return chips;
}
