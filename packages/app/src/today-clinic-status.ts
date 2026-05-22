import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import type { BridgeHealthPhase } from "./bridge-health.js";
import {
  CLINIC_FRIENDLY_EDITING_LABEL,
  CLINIC_FRIENDLY_LOCAL_COPY_LABEL,
  CLINIC_FRIENDLY_SERVICE_LABEL,
  friendlyBridgeStatus,
  friendlyEditingStatus,
  friendlyLocalCopyStatus,
  type ClinicFriendlyTone,
} from "./clinic-friendly-copy.js";

export type TodayClinicStatusRow = {
  key: string;
  label: string;
  value: string;
  tone: ClinicFriendlyTone;
};

export type TodayClinicStatusOptions = {
  bridgePhase: BridgeHealthPhase;
  mirrorStatus: MirrorStatusResponse | null;
  writeCapability: BridgeDevStatusResponse | null;
  /** Build-time sandbox write pilot flag (no paths). */
  sandboxWritePilot?: boolean;
  nowMs?: number;
};

/**
 * Three friendly status rows for Today side panel (Wave 2).
 * No paths, no PHI — Service, Local copy, Editing only.
 */
export function resolveTodayClinicStatus(options: TodayClinicStatusOptions): TodayClinicStatusRow[] {
  const nowMs = options.nowMs ?? Date.now();
  const service = friendlyBridgeStatus(options.bridgePhase);
  const localCopy = friendlyLocalCopyStatus(options.bridgePhase, options.mirrorStatus, nowMs);
  const editing = friendlyEditingStatus(options.writeCapability, options.sandboxWritePilot ?? false);

  return [
    {
      key: "service",
      label: CLINIC_FRIENDLY_SERVICE_LABEL,
      value: service.label,
      tone: service.tone,
    },
    {
      key: "local-copy",
      label: CLINIC_FRIENDLY_LOCAL_COPY_LABEL,
      value: localCopy.label,
      tone: localCopy.tone,
    },
    {
      key: "editing",
      label: CLINIC_FRIENDLY_EDITING_LABEL,
      value: editing.label,
      tone: editing.tone,
    },
  ];
}
