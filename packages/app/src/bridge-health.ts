import type { BridgeClient } from "@microdent/bridge-client";
import { BridgeClientError } from "@microdent/bridge-client";

/** Top-bar bridge probe lifecycle (includes the initial in-flight check). */
export type BridgeHealthPhase = "checking" | "connected" | "offline";

export type BridgeHealthStatus = "connected" | "offline";

export type BridgeHealthProbe = { status: BridgeHealthStatus; error?: unknown };

/**
 * Short, non-technical summary for dev UI when a bridge health probe fails.
 * Does not include stack traces, raw objects, or PHI.
 */
export function describeBridgeHealthProbeError(error: unknown): string {
  if (error instanceof BridgeClientError) {
    if (error.kind === "network") {
      return "Network or CORS: the browser could not read the response. If /health works in another tab, the preview URL port may not be allowed by the bridge.";
    }
    if (error.kind === "invalid_body") {
      return "The bridge returned a response this app could not parse.";
    }
    if (error.kind === "invalid_argument") {
      return "Invalid bridge URL configuration.";
    }
    if (error.kind === "http") {
      const s = error.status !== undefined ? `HTTP ${error.status}` : "HTTP error";
      return error.apiCode !== undefined ? `${s} (${error.apiCode})` : s;
    }
  }
  return "Bridge check failed.";
}

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
