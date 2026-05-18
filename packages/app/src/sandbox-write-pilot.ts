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
