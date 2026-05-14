import { describe, expect, it } from "vitest";
import { probeBridgeHealth } from "./bridge-health.js";

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
