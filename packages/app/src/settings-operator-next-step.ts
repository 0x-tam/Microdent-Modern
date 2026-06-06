import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import { isMirrorImportStale } from "./mirror-stale.js";
import {
  SETTINGS_NEXT_STEP_BACKUP,
  SETTINGS_NEXT_STEP_BRIDGE,
  SETTINGS_NEXT_STEP_DATA_ROOT,
  SETTINGS_NEXT_STEP_DESKTOP_SETUP,
  SETTINGS_NEXT_STEP_MIRROR_IMPORT,
  SETTINGS_NEXT_STEP_MIRROR_REFRESH,
  SETTINGS_NEXT_STEP_MIRROR_STALE,
  SETTINGS_NEXT_STEP_PILOT_BUILD,
  SETTINGS_NEXT_STEP_SANDBOX,
  SETTINGS_NEXT_STEP_WRITE_DISABLED,
  SETTINGS_NEXT_STEP_WRITE_DRY_RUN,
  SETTINGS_NEXT_STEP_WRITE_ENABLED,
  SETTINGS_NEXT_STEP_DATA_ROOT_FORBIDDEN,
  SETTINGS_SETUP_RERUN_HINT,
} from "./read-only-ui-copy.js";

export type SettingsCardKey =
  | "bridge"
  | "dataRoot"
  | "dataRootSafe"
  | "write"
  | "sandbox"
  | "backup"
  | "pilot"
  | "sqliteMirror"
  | "mirror"
  | "mirrorImport"
  | "serviceStatus"
  | "dataSource"
  | "editingMode"
  | "setup";

/** One-line operator action for a Settings card (no paths or PHI). */
export function resolveSettingsOperatorNextStep(
  card: SettingsCardKey,
  bridgePhase: BridgeHealthPhase,
  writeCapability: BridgeDevStatusResponse | null,
  mirrorStatus: MirrorStatusResponse | null,
  options?: { sandboxWritePilot?: boolean; nowMs?: number },
): string | null {
  const nowMs = options?.nowMs ?? Date.now();
  const pilotOn = options?.sandboxWritePilot ?? false;

  switch (card) {
    case "bridge":
      if (bridgePhase === "connected") return null;
      if (
        bridgePhase === "offline" &&
        (!writeCapability || !writeCapability.dataRootConfigured || !writeCapability.sqlitePathConfigured)
      ) {
        return SETTINGS_NEXT_STEP_DESKTOP_SETUP;
      }
      return SETTINGS_NEXT_STEP_BRIDGE;
    case "dataRoot":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (!writeCapability.dataRootConfigured) return SETTINGS_NEXT_STEP_DATA_ROOT;
      return null;
    case "dataRootSafe":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (writeCapability.dataRootConfigured && !writeCapability.writableSandbox) {
        return SETTINGS_NEXT_STEP_DATA_ROOT_FORBIDDEN;
      }
      return null;
    case "write":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (writeCapability.writeMode === "disabled") return SETTINGS_NEXT_STEP_WRITE_DISABLED;
      if (writeCapability.writeMode === "dry-run") return SETTINGS_NEXT_STEP_WRITE_DRY_RUN;
      return SETTINGS_NEXT_STEP_WRITE_ENABLED;
    case "sandbox":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (!writeCapability.writableSandbox) return SETTINGS_NEXT_STEP_SANDBOX;
      return null;
    case "backup":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (writeCapability.writeMode === "enabled" && !writeCapability.backupDirConfigured) {
        return SETTINGS_NEXT_STEP_BACKUP;
      }
      return null;
    case "pilot":
      if (!pilotOn && writeCapability?.writeMode === "enabled") {
        return SETTINGS_NEXT_STEP_PILOT_BUILD;
      }
      return null;
    case "sqliteMirror":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (!writeCapability.sqlitePathConfigured) return SETTINGS_NEXT_STEP_MIRROR_IMPORT;
      return null;
    case "mirror":
      if (bridgePhase !== "connected") return null;
      if (mirrorStatus === null) return SETTINGS_NEXT_STEP_MIRROR_REFRESH;
      if (isMirrorImportStale(mirrorStatus, nowMs)) return SETTINGS_NEXT_STEP_MIRROR_STALE;
      if (mirrorStatus.latestImportRuns.length === 0) return SETTINGS_NEXT_STEP_MIRROR_IMPORT;
      if (mirrorStatus.latestImportRuns.some((r) => r.status === "partial" || r.status === "failed")) {
        return SETTINGS_NEXT_STEP_MIRROR_IMPORT;
      }
      return null;
    case "mirrorImport":
      if (bridgePhase !== "connected") return null;
      if (mirrorStatus === null) return SETTINGS_NEXT_STEP_MIRROR_REFRESH;
      if (mirrorStatus.latestImportRuns.length === 0) return SETTINGS_NEXT_STEP_MIRROR_IMPORT;
      if (isMirrorImportStale(mirrorStatus, nowMs)) return SETTINGS_NEXT_STEP_MIRROR_STALE;
      if (mirrorStatus.latestImportRuns.some((r) => r.status === "partial" || r.status === "failed")) {
        return SETTINGS_NEXT_STEP_MIRROR_IMPORT;
      }
      return null;
    case "serviceStatus":
      if (bridgePhase === "connected") return null;
      if (
        bridgePhase === "offline" &&
        (!writeCapability || !writeCapability.dataRootConfigured || !writeCapability.sqlitePathConfigured)
      ) {
        return SETTINGS_NEXT_STEP_DESKTOP_SETUP;
      }
      return SETTINGS_NEXT_STEP_BRIDGE;
    case "dataSource":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (!writeCapability.dataRootConfigured) return SETTINGS_NEXT_STEP_DATA_ROOT;
      return null;
    case "editingMode":
      if (bridgePhase !== "connected" || !writeCapability) return null;
      if (writeCapability.writeMode === "disabled") return SETTINGS_NEXT_STEP_WRITE_DISABLED;
      if (writeCapability.writeMode === "dry-run") return SETTINGS_NEXT_STEP_WRITE_DRY_RUN;
      return SETTINGS_NEXT_STEP_WRITE_ENABLED;
    case "setup":
      return SETTINGS_NEXT_STEP_DESKTOP_SETUP;
    default:
      return null;
  }
}
