/**
 * Clinic-friendly labels for main workspace pages (Today, Patients, Schedule, Profile).
 * Settings and readiness grids keep technical terms via SETTINGS_* exports in read-only-ui-copy.ts.
 */

import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { isMirrorImportStale } from "./mirror-stale.js";

export const CLINIC_FRIENDLY_SERVICE_LABEL = "Service";
export const CLINIC_FRIENDLY_LOCAL_COPY_LABEL = "Local copy";
export const CLINIC_FRIENDLY_EDITING_LABEL = "Editing";

export const CLINIC_FRIENDLY_DBF_FALLBACK = "Using copied clinic files";
export const CLINIC_FRIENDLY_LOCAL_COPY_READY = "Local copy ready";
export const CLINIC_FRIENDLY_LOCAL_COPY_STALE = "Local copy may be outdated";
export const CLINIC_FRIENDLY_LOCAL_COPY_UNKNOWN = "Local copy status unknown";
export const CLINIC_FRIENDLY_LOCAL_COPY_OFFLINE = "Connect the clinic service to check local copy";
export const CLINIC_FRIENDLY_SERVICE_OFFLINE = "Clinic service offline";
export const CLINIC_FRIENDLY_SERVICE_CONNECTED = "Connected";
export const CLINIC_FRIENDLY_CHECKING = "Checking…";
export const CLINIC_FRIENDLY_READ_ONLY = "Read-only";
export const CLINIC_FRIENDLY_EDITING_SANDBOX = "Editing (sandbox)";
export const CLINIC_FRIENDLY_PREVIEW_ONLY = "Preview only";
export const CLINIC_FRIENDLY_EDITING_UNAVAILABLE = "Editing unavailable in this build";
export const CLINIC_FRIENDLY_EDITING_UNKNOWN = "Checking editing status…";
export const CLINIC_FRIENDLY_BACKUP_NOT_NEEDED_READONLY = "Backup not needed while read-only";

export type ClinicFriendlyTone = "neutral" | "ok" | "warn" | "danger";

export type ClinicFriendlyLabeledValue = {
  label: string;
  tone: ClinicFriendlyTone;
};

export function friendlyBridgeStatus(phase: BridgeHealthPhase): ClinicFriendlyLabeledValue {
  switch (phase) {
    case "connected":
      return { label: CLINIC_FRIENDLY_SERVICE_CONNECTED, tone: "ok" };
    case "checking":
      return { label: CLINIC_FRIENDLY_CHECKING, tone: "neutral" };
    default:
      return { label: CLINIC_FRIENDLY_SERVICE_OFFLINE, tone: "warn" };
  }
}

export function friendlyLocalCopyStatus(
  bridgePhase: BridgeHealthPhase,
  mirrorStatus: MirrorStatusResponse | null,
  nowMs: number = Date.now(),
): ClinicFriendlyLabeledValue {
  if (bridgePhase !== "connected") {
    return { label: CLINIC_FRIENDLY_LOCAL_COPY_OFFLINE, tone: "neutral" };
  }
  if (mirrorStatus === null) {
    return { label: CLINIC_FRIENDLY_LOCAL_COPY_UNKNOWN, tone: "neutral" };
  }
  if (!mirrorStatus.sqliteUsable) {
    return { label: CLINIC_FRIENDLY_DBF_FALLBACK, tone: "warn" };
  }
  if (isMirrorImportStale(mirrorStatus, nowMs)) {
    return { label: CLINIC_FRIENDLY_LOCAL_COPY_STALE, tone: "warn" };
  }
  return { label: CLINIC_FRIENDLY_LOCAL_COPY_READY, tone: "ok" };
}

export function friendlyEditingStatus(
  writeCapability: BridgeDevStatusResponse | null,
  sandboxWritePilot = false,
): ClinicFriendlyLabeledValue {
  if (!writeCapability) {
    return { label: CLINIC_FRIENDLY_EDITING_UNKNOWN, tone: "neutral" };
  }
  switch (writeCapability.writeMode) {
    case "disabled":
      return { label: CLINIC_FRIENDLY_READ_ONLY, tone: "ok" };
    case "dry-run":
      return { label: CLINIC_FRIENDLY_PREVIEW_ONLY, tone: "warn" };
    case "enabled":
      if (!sandboxWritePilot) {
        return { label: CLINIC_FRIENDLY_EDITING_UNAVAILABLE, tone: "neutral" };
      }
      if (writeCapability.writableSandbox && writeCapability.writesPermitted) {
        return { label: CLINIC_FRIENDLY_EDITING_SANDBOX, tone: "danger" };
      }
      return { label: CLINIC_FRIENDLY_EDITING_SANDBOX, tone: "warn" };
    default:
      return { label: CLINIC_FRIENDLY_EDITING_UNKNOWN, tone: "neutral" };
  }
}

/** Map technical readiness mirror labels to clinic-friendly display (main pages only). */
export function friendlyMirrorReadinessLabel(technicalLabel: string): string {
  const normalized = technicalLabel.trim().toLowerCase();
  if (normalized.includes("dbf fallback") || normalized.includes("mirror unavailable")) {
    return CLINIC_FRIENDLY_DBF_FALLBACK;
  }
  if (normalized.includes("stale") || normalized.includes("older than 48")) {
    return CLINIC_FRIENDLY_LOCAL_COPY_STALE;
  }
  if (normalized.includes("mirror active") || normalized.includes("mirror in use")) {
    return CLINIC_FRIENDLY_LOCAL_COPY_READY;
  }
  if (normalized.includes("unknown")) {
    return CLINIC_FRIENDLY_LOCAL_COPY_UNKNOWN;
  }
  return technicalLabel;
}

/** Map write-mode chip / banner labels for main-page chrome. */
export function friendlyWriteModeChipLabel(technicalLabel: string): string {
  const normalized = technicalLabel.trim().toLowerCase();
  if (normalized.includes("writes off") || normalized.includes("write mode is off")) {
    return CLINIC_FRIENDLY_READ_ONLY;
  }
  if (normalized.includes("dry-run")) {
    return CLINIC_FRIENDLY_PREVIEW_ONLY;
  }
  if (normalized.includes("writes on") || normalized.includes("write mode: enabled")) {
    return CLINIC_FRIENDLY_EDITING_SANDBOX;
  }
  if (normalized.includes("unknown") || normalized.includes("capability")) {
    return CLINIC_FRIENDLY_CHECKING;
  }
  return technicalLabel;
}
