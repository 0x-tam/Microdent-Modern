import { describe, expect, it } from "vitest";
import { BridgeClientError } from "@microdent/bridge-client";
import { describeBridgeHealthProbeError, probeBridgeHealth } from "./bridge-health.js";

describe("probeBridgeHealth", () => {
  it("returns connected when getHealth resolves", async () => {
    const result = await probeBridgeHealth({
      getHealth: async () => ({ ok: true, version: "test" }),
    });
    expect(result.status).toBe("connected");
    expect(result.error).toBeUndefined();
  });

  it("returns offline with error when getHealth throws", async () => {
    const boom = new Error("network");
    const result = await probeBridgeHealth({
      getHealth: async () => {
        throw boom;
      },
    });
    expect(result.status).toBe("offline");
    expect(result.error).toBe(boom);
  });
});

describe("describeBridgeHealthProbeError", () => {
  it("summarizes network / CORS failures without raw errors", () => {
    const msg = describeBridgeHealthProbeError(new BridgeClientError("x", { kind: "network" }));
    expect(msg).toContain("CORS");
    expect(msg).not.toMatch(/at /);
  });

  it("summarizes HTTP errors with status and optional api code", () => {
    expect(
      describeBridgeHealthProbeError(
        new BridgeClientError("m", { kind: "http", status: 503, apiCode: "DATA_ROOT_NOT_CONFIGURED" }),
      ),
    ).toBe("HTTP 503 (DATA_ROOT_NOT_CONFIGURED)");
  });

  it("handles unknown thrown values", () => {
    expect(describeBridgeHealthProbeError(new Error("secret stack"))).toBe("Bridge check failed.");
  });
});
