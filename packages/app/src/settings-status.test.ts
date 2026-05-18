import { describe, expect, it } from "vitest";
import { resolveBackupConfiguredStatus, resolveSandboxValidityStatus } from "./settings-status.js";

describe("settings-status", () => {
  it("maps sandbox validity from writableSandbox", () => {
    expect(
      resolveSandboxValidityStatus({
        writeMode: "dry-run",
        writesPermitted: false,
        writableSandbox: true,
      }).tone,
    ).toBe("ok");
    expect(
      resolveSandboxValidityStatus({
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
      }).tone,
    ).toBe("warn");
  });

  it("infers backup configured from writesPermitted when writes enabled", () => {
    expect(
      resolveBackupConfiguredStatus({
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
      }).label,
    ).toMatch(/configured/i);
    expect(
      resolveBackupConfiguredStatus({
        writeMode: "enabled",
        writesPermitted: false,
        writableSandbox: false,
      }).label,
    ).toMatch(/not configured/i);
    expect(
      resolveBackupConfiguredStatus({
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
      }).label,
    ).toMatch(/not required/i);
  });
});
