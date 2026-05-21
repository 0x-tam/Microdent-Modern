import type { BridgeDevStatusResponse } from "@microdent/contracts";

/** Pilot write UI is opt-in from the host (e.g. `VITE_SANDBOX_WRITE_PILOT`). */
export function isSandboxWritePilotEnabled(flag: boolean): boolean {
  return flag === true;
}

/** True when the bridge reports enabled sandbox writes are permitted. */
export function isSandboxWriteReady(status: BridgeDevStatusResponse): boolean {
  return (
    status.writeMode === "enabled" &&
    status.writesPermitted === true &&
    status.writableSandbox === true
  );
}

export type SandboxWriteBlockReason = "pilot-off" | "write-mode-off" | "sandbox-not-ready";

/** Why sandbox write UI should stay hidden (pilot off). */
export function isSandboxWriteHidden(
  writePilotEnabled: boolean,
): boolean {
  return !isSandboxWritePilotEnabled(writePilotEnabled);
}

/** Why sandbox write UI should show a blocked notice instead of controls. */
export function resolveSandboxWriteBlockReason(
  writePilotEnabled: boolean,
  writeCapability: BridgeDevStatusResponse | null,
): SandboxWriteBlockReason | null {
  if (!isSandboxWritePilotEnabled(writePilotEnabled)) {
    return null;
  }
  if (!writeCapability) {
    return "sandbox-not-ready";
  }
  if (writeCapability.writeMode === "disabled") {
    return "write-mode-off";
  }
  if (!isSandboxWriteReady(writeCapability)) {
    return "sandbox-not-ready";
  }
  return null;
}
