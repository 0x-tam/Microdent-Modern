import { describe, expect, it } from "vitest";
import {
  resolveBackupConfiguredStatus,
  resolveDataRootConfiguredStatus,
  resolveSandboxValidityStatus,
  resolveSqliteMirrorStatus,
} from "./settings-status.js";

describe("settings-status", () => {
  it("maps sandbox validity from writableSandbox", () => {
    expect(
      resolveSandboxValidityStatus({
        writeMode: "dry-run",
        writesPermitted: false,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: true,
      }).tone,
    ).toBe("ok");
    expect(
      resolveSandboxValidityStatus({
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: false,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      }).tone,
    ).toBe("warn");
  });

  it("reads backup configured from backupDirConfigured when writes enabled", () => {
    expect(
      resolveBackupConfiguredStatus({
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: true,
        sqlitePathConfigured: true,
      }).label,
    ).toMatch(/configured/i);
    expect(
      resolveBackupConfiguredStatus({
        writeMode: "enabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      }).label,
    ).toMatch(/not configured/i);
    expect(
      resolveBackupConfiguredStatus({
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: false,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      }).label,
    ).toMatch(/not required/i);
  });

  it("maps data root configured from write capability", () => {
    expect(
      resolveDataRootConfiguredStatus({
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: false,
      }).tone,
    ).toBe("ok");
  });

  it("maps sqlite mirror usability from mirror status", () => {
    expect(
      resolveSqliteMirrorStatus("connected", {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: [],
        latestImportRuns: [],
      }, null).tone,
    ).toBe("ok");
    expect(
      resolveSqliteMirrorStatus("connected", {
        sqliteConfigured: true,
        sqliteUsable: false,
        importedTables: [],
        latestImportRuns: [],
      }, null).label,
    ).toMatch(/DBF fallback/i);
    expect(resolveSqliteMirrorStatus("offline", null, null).tone).toBe("neutral");
  });
});
