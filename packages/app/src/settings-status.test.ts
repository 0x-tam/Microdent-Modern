import { describe, expect, it } from "vitest";
import {
  resolveBackupConfiguredStatus,
  resolveDataRootConfiguredStatus,
  resolvePilotReadinessSummary,
  resolvePilotReadinessChecklist,
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

  it("summarizes pilot readiness without paths", () => {
    const offline = resolvePilotReadinessSummary("offline", null, null);
    expect(offline).toHaveLength(1);
    expect(offline[0]?.label).toMatch(/offline/i);

    const readOnly = resolvePilotReadinessSummary(
      "connected",
      {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: true,
      },
      {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: ["patients"],
        latestImportRuns: [
          {
            tableName: "patients",
            status: "success",
            rowCount: 10,
            errorCount: 0,
            finishedAt: new Date().toISOString(),
          },
        ],
      },
    );
    expect(readOnly.some((c) => c.label.match(/read-only/i))).toBe(true);
    expect(readOnly.some((c) => c.label.match(/mirror active/i))).toBe(true);
    expect(readOnly.some((c) => c.label.match(/read-only QA/i))).toBe(true);
  });

  it("includes backup chip when backupDirConfigured", () => {
    const chips = resolvePilotReadinessSummary(
      "connected",
      {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: true,
        sqlitePathConfigured: true,
      },
      null,
    );
    expect(chips.some((c) => c.key === "backup-configured")).toBe(true);
  });

  it("builds structured checklist with six items", () => {
    const checklist = resolvePilotReadinessChecklist(
      "connected",
      {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: true,
      },
      {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: ["patients"],
        latestImportRuns: [],
      },
    );
    expect(checklist).toHaveLength(6);
    expect(checklist.map((i) => i.key)).toEqual([
      "bridge",
      "dataRoot",
      "mirror",
      "backup",
      "write",
      "sandbox",
    ]);
    expect(checklist.every((i) => !i.label.match(/C:\\\\|\/Users\//))).toBe(true);
  });
});
