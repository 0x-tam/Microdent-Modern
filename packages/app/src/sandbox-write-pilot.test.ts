import { describe, expect, it } from "vitest";
import {
  isSandboxWriteHidden,
  isSandboxWritePilotEnabled,
  isSandboxWriteReady,
  resolveSandboxWriteBlockReason,
} from "./sandbox-write-pilot.js";

const readyCapability = {
  writeMode: "enabled" as const,
  writesPermitted: true,
  writableSandbox: true,
  dataRootConfigured: true,
  backupDirConfigured: true,
  sqlitePathConfigured: true,
};

describe("sandbox-write-pilot", () => {
  it("isSandboxWritePilotEnabled requires explicit true", () => {
    expect(isSandboxWritePilotEnabled(false)).toBe(false);
    expect(isSandboxWritePilotEnabled(true)).toBe(true);
  });

  it("isSandboxWriteHidden when pilot flag is off", () => {
    expect(isSandboxWriteHidden(false)).toBe(true);
    expect(isSandboxWriteHidden(true)).toBe(false);
  });

  it("isSandboxWriteReady requires enabled sandbox gates", () => {
    expect(isSandboxWriteReady(readyCapability)).toBe(true);
    expect(isSandboxWriteReady({ ...readyCapability, writesPermitted: false })).toBe(false);
    expect(isSandboxWriteReady({ ...readyCapability, writeMode: "dry-run" })).toBe(false);
    expect(isSandboxWriteReady({ ...readyCapability, writableSandbox: false })).toBe(false);
  });

  it("resolveSandboxWriteBlockReason returns null when ready", () => {
    expect(resolveSandboxWriteBlockReason(true, readyCapability)).toBeNull();
  });

  it("resolveSandboxWriteBlockReason blocks when write mode is disabled", () => {
    expect(
      resolveSandboxWriteBlockReason(true, {
        ...readyCapability,
        writeMode: "disabled",
        writesPermitted: false,
      }),
    ).toBe("write-mode-off");
  });

  it("resolveSandboxWriteBlockReason blocks when capability is missing or sandbox invalid", () => {
    expect(resolveSandboxWriteBlockReason(true, null)).toBe("sandbox-not-ready");
    expect(
      resolveSandboxWriteBlockReason(true, {
        ...readyCapability,
        writeMode: "dry-run",
        writesPermitted: false,
      }),
    ).toBe("sandbox-not-ready");
  });

  it("resolveSandboxWriteBlockReason returns null when pilot is off (hidden, not blocked)", () => {
    expect(resolveSandboxWriteBlockReason(false, null)).toBeNull();
  });
});
