import type { BridgeClient } from "@microdent/bridge-client";

export type BridgeHealthStatus = "connected" | "offline";

export type BridgeHealthProbe = { status: BridgeHealthStatus; error?: unknown };

/**
 * Calls `client.getHealth()` once (GET /health). On failure, returns `"offline"` and the thrown value for optional dev logging — never rethrown.
 */
export async function probeBridgeHealth(client: Pick<BridgeClient, "getHealth">): Promise<BridgeHealthProbe> {
  try {
    await client.getHealth();
    return { status: "connected" };
  } catch (error) {
    return { status: "offline", error };
  }
}
