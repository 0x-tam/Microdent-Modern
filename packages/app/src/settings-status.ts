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
  SETTINGS_READINESS_DISTRIBUTION_HINT,
  SETTINGS_READINESS_FIELD_TEST_DOC_HINT,
  SETTINGS_READINESS_READONLY_QA_HINT,
  SETTINGS_READINESS_WINDOWS_EXECUTION_DEFERRED,
  SETTINGS_READINESS_READ_ONLY,
  SETTINGS_READINESS_SANDBOX_NOT_READY,
  SETTINGS_READINESS_SANDBOX_QA_HINT,
  SETTINGS_READINESS_SANDBOX_READY,
  SETTINGS_READINESS_BACKUP_CONFIGURED,
  SETTINGS_READINESS_BACKUP_NOT_CONFIGURED,
  SETTINGS_READINESS_WRITES_ACTIVE,
  SETTINGS_SANDBOX_INVALID,
  SETTINGS_SANDBOX_UNKNOWN,
  SETTINGS_SANDBOX_VALID,
  SETTINGS_SQLITE_MIRROR_UNKNOWN,
  SETTINGS_CHECKLIST_DATA_ROOT_SAFE,
  SETTINGS_CHECKLIST_MIRROR_IMPORT,
} from "./read-only-ui-copy.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import type { SettingsCardKey } from "./settings-operator-next-step.js";
import { resolveSettingsOperatorNextStep } from "./settings-operator-next-step.js";

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

  if (writeCapability?.backupDirConfigured) {
    chips.push({ key: "backup-configured", label: SETTINGS_READINESS_BACKUP_CONFIGURED, tone: "ok" });
  } else if (writeCapability?.writeMode === "enabled") {
    chips.push({
      key: "backup-not-configured",
      label: SETTINGS_READINESS_BACKUP_NOT_CONFIGURED,
      tone: "warn",
    });
  }

  if (writeCapability?.writeMode === "disabled" && writeCapability.dataRootConfigured) {
    chips.push({ key: "readonly-qa-hint", label: SETTINGS_READINESS_READONLY_QA_HINT, tone: "neutral" });
    chips.push({ key: "sandbox-qa-hint", label: SETTINGS_READINESS_SANDBOX_QA_HINT, tone: "neutral" });
    chips.push({
      key: "distribution-hint",
      label: SETTINGS_READINESS_DISTRIBUTION_HINT,
      tone: "neutral",
    });
  }

  chips.push({
    key: "windows-execution-deferred",
    label: SETTINGS_READINESS_WINDOWS_EXECUTION_DEFERRED,
    tone: "neutral",
  });
  chips.push({
    key: "field-test-doc-hint",
    label: SETTINGS_READINESS_FIELD_TEST_DOC_HINT,
    tone: "neutral",
  });

  return chips;
}

export type PilotChecklistItem = {
  key: SettingsCardKey;
  label: string;
  tone: SettingsStatusTone;
  nextStep: string | null;
};

const CHECKLIST_BRIDGE = "Clinic service connected";
const CHECKLIST_DATA_ROOT = "DATA_ROOT configured";
const CHECKLIST_MIRROR = "Mirror ready for search/schedule";
const CHECKLIST_BACKUP = "Backup folder configured";
const CHECKLIST_WRITE = "Write mode safe for pilot";
const CHECKLIST_SANDBOX = "Sandbox valid for commits";
export function resolvePilotReadinessChecklist(
  bridgePhase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
  mirrorStatus: MirrorStatusResponse | null,
  options?: { sandboxWritePilot?: boolean; nowMs?: number },
): PilotChecklistItem[] {
  const nowMs = options?.nowMs ?? Date.now();
  const nextOpts = { sandboxWritePilot: options?.sandboxWritePilot, nowMs };

  const bridgeTone: SettingsStatusTone =
    bridgePhase === "connected" ? "ok" : bridgePhase === "checking" ? "neutral" : "warn";
  const bridgeItem: PilotChecklistItem = {
    key: "bridge",
    label: CHECKLIST_BRIDGE,
    tone: bridgeTone,
    nextStep: resolveSettingsOperatorNextStep("bridge", bridgePhase, writeCapability, mirrorStatus, nextOpts),
  };

  let dataRootTone: SettingsStatusTone = "neutral";
  if (bridgePhase === "connected" && writeCapability) {
    dataRootTone = writeCapability.dataRootConfigured ? "ok" : "warn";
  }
  const dataRootItem: PilotChecklistItem = {
    key: "dataRoot",
    label: CHECKLIST_DATA_ROOT,
    tone: dataRootTone,
    nextStep: resolveSettingsOperatorNextStep("dataRoot", bridgePhase, writeCapability, mirrorStatus, nextOpts),
  };

  let dataRootSafeTone: SettingsStatusTone = "neutral";
  if (bridgePhase === "connected" && writeCapability?.dataRootConfigured) {
    dataRootSafeTone = writeCapability.writableSandbox ? "ok" : "warn";
  }
  const dataRootSafeItem: PilotChecklistItem = {
    key: "dataRootSafe",
    label: SETTINGS_CHECKLIST_DATA_ROOT_SAFE,
    tone: dataRootSafeTone,
    nextStep: resolveSettingsOperatorNextStep(
      "dataRootSafe",
      bridgePhase,
      writeCapability,
      mirrorStatus,
      nextOpts,
    ),
  };

  let mirrorTone: SettingsStatusTone = "neutral";
  if (bridgePhase === "connected" && mirrorStatus !== null) {
    if (!mirrorStatus.sqliteUsable) {
      mirrorTone = "warn";
    } else if (isMirrorImportStale(mirrorStatus, nowMs)) {
      mirrorTone = "warn";
    } else {
      mirrorTone = "ok";
    }
  }
  const mirrorItem: PilotChecklistItem = {
    key: "mirror",
    label: CHECKLIST_MIRROR,
    tone: mirrorTone,
    nextStep: resolveSettingsOperatorNextStep("mirror", bridgePhase, writeCapability, mirrorStatus, nextOpts),
  };

  let mirrorImportTone: SettingsStatusTone = "neutral";
  if (bridgePhase === "connected" && mirrorStatus !== null) {
    if (mirrorStatus.latestImportRuns.length === 0) {
      mirrorImportTone = "warn";
    } else if (mirrorStatus.latestImportRuns.some((r) => r.status === "failed")) {
      mirrorImportTone = "warn";
    } else if (mirrorStatus.latestImportRuns.some((r) => r.status === "partial")) {
      mirrorImportTone = "warn";
    } else if (isMirrorImportStale(mirrorStatus, nowMs)) {
      mirrorImportTone = "warn";
    } else {
      mirrorImportTone = "ok";
    }
  }
  const mirrorImportItem: PilotChecklistItem = {
    key: "mirrorImport",
    label: SETTINGS_CHECKLIST_MIRROR_IMPORT,
    tone: mirrorImportTone,
    nextStep: resolveSettingsOperatorNextStep(
      "mirrorImport",
      bridgePhase,
      writeCapability,
      mirrorStatus,
      nextOpts,
    ),
  };

  let backupTone: SettingsStatusTone = "neutral";
  if (writeCapability?.writeMode === "enabled") {
    backupTone = writeCapability.backupDirConfigured ? "ok" : "warn";
  } else if (writeCapability?.backupDirConfigured) {
    backupTone = "ok";
  }
  const backupItem: PilotChecklistItem = {
    key: "backup",
    label: CHECKLIST_BACKUP,
    tone: backupTone,
    nextStep: resolveSettingsOperatorNextStep("backup", bridgePhase, writeCapability, mirrorStatus, nextOpts),
  };

  let writeTone: SettingsStatusTone = "neutral";
  if (writeCapability?.writeMode === "disabled") {
    writeTone = "ok";
  } else if (writeCapability?.writeMode === "dry-run") {
    writeTone = "neutral";
  } else if (writeCapability?.writeMode === "enabled") {
    writeTone = writeCapability.writableSandbox ? "danger" : "warn";
  }
  const writeItem: PilotChecklistItem = {
    key: "write",
    label: CHECKLIST_WRITE,
    tone: writeTone,
    nextStep: resolveSettingsOperatorNextStep("write", bridgePhase, writeCapability, mirrorStatus, nextOpts),
  };

  let sandboxTone: SettingsStatusTone = "neutral";
  if (bridgePhase === "connected" && writeCapability) {
    sandboxTone = writeCapability.writableSandbox ? "ok" : "warn";
  }
  const sandboxItem: PilotChecklistItem = {
    key: "sandbox",
    label: CHECKLIST_SANDBOX,
    tone: sandboxTone,
    nextStep: resolveSettingsOperatorNextStep("sandbox", bridgePhase, writeCapability, mirrorStatus, nextOpts),
  };

  return [
    bridgeItem,
    dataRootItem,
    dataRootSafeItem,
    mirrorItem,
    mirrorImportItem,
    backupItem,
    writeItem,
    sandboxItem,
  ];
}
