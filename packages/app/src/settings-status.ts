import type { BridgeDevStatusResponse } from "@microdent/contracts";
import {
  SETTINGS_BACKUP_CONFIGURED,
  SETTINGS_BACKUP_NOT_CONFIGURED,
  SETTINGS_BACKUP_NOT_REQUIRED,
  SETTINGS_BACKUP_UNKNOWN,
  SETTINGS_SANDBOX_INVALID,
  SETTINGS_SANDBOX_UNKNOWN,
  SETTINGS_SANDBOX_VALID,
} from "./read-only-ui-copy.js";

export type SettingsStatusTone = "neutral" | "ok" | "warn" | "danger";

export type SettingsLabeledStatus = {
  label: string;
  tone: SettingsStatusTone;
};

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
 * When writes are enabled, `writesPermitted` implies BACKUP_DIR is configured on the bridge.
 */
export function resolveBackupConfiguredStatus(
  writeCapability: BridgeDevStatusResponse | null,
): SettingsLabeledStatus {
  if (!writeCapability) {
    return { label: SETTINGS_BACKUP_UNKNOWN, tone: "neutral" };
  }
  if (writeCapability.writeMode !== "enabled") {
    return { label: SETTINGS_BACKUP_NOT_REQUIRED, tone: "neutral" };
  }
  if (writeCapability.writesPermitted) {
    return { label: SETTINGS_BACKUP_CONFIGURED, tone: "ok" };
  }
  return { label: SETTINGS_BACKUP_NOT_CONFIGURED, tone: "warn" };
}
