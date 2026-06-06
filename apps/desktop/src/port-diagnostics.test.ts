import { describe, expect, it, vi } from "vitest";
import {
  diagnoseClinicServicePorts,
  resolveClinicServicePortCleanupPolicy,
} from "./port-diagnostics.js";

describe("diagnoseClinicServicePorts", () => {
  it("reports healthy when the configured port responds", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;

    const result = await diagnoseClinicServicePorts({
      configuredPort: 17890,
      activePort: 17890,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Clinic service port is healthy.");
    expect(result.configuredPortState).toBe("responding");
  });

  it("reports backup port when configured and active ports both respond", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;

    const result = await diagnoseClinicServicePorts({
      configuredPort: 17890,
      activePort: 17891,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.activePort).toBe(17891);
    expect(result.message).toMatch(/backup port/i);
  });

  it("reports not responding when no known clinic service port responds", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await diagnoseClinicServicePorts({
      configuredPort: 17890,
      activePort: null,
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.configuredPortState).toBe("not-responding");
    expect(result.message).toMatch(/not responding/i);
  });
});

describe("resolveClinicServicePortCleanupPolicy", () => {
  it("returns safe guidance without process identifiers or kill instructions", () => {
    const result = resolveClinicServicePortCleanupPolicy({
      configuredPort: 17890,
      activePort: 17891,
    });
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(true);
    expect(result.canAutoClean).toBe(false);
    expect(result.configuredPort).toBe(17890);
    expect(result.activePort).toBe(17891);
    expect(result.steps.join(" ")).toMatch(/Restart clinic service/i);
    expect(serialized).not.toMatch(/\bPID\b/i);
    expect(serialized).not.toMatch(/\bkill\b/i);
    expect(serialized).not.toMatch(/\btaskkill\b/i);
  });
});
