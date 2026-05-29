import { describe, expect, it } from "vitest";
import {
  resolveBackupConfiguredStatus,
  resolveBackupReadinessSummary,
  resolveDataRootConfiguredStatus,
  resolveDataSourceStatus,
  resolveEditingModeSummary,
  resolveFrontDeskOverview,
  resolvePilotReadinessSummary,
  resolvePilotReadinessChecklist,
  resolveSandboxValidityStatus,
  resolveServiceStatusSummary,
  resolveSqliteMirrorStatus,
} from "./settings-status.js";
import { MIRROR_IMPORT_STALE_MS } from "./mirror-stale.js";

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
    expect(readOnly.some((c) => c.key === "distribution-hint")).toBe(true);
    expect(readOnly.some((c) => c.key === "windows-execution-deferred")).toBe(true);
    expect(readOnly.some((c) => c.label.match(/FIELD-TEST-START-HERE/i))).toBe(true);
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

  it("builds structured checklist with eight items", () => {
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
    expect(checklist).toHaveLength(8);
    expect(checklist.map((i) => i.key)).toEqual([
      "bridge",
      "dataRoot",
      "dataRootSafe",
      "mirror",
      "mirrorImport",
      "backup",
      "write",
      "sandbox",
    ]);
    expect(checklist.every((i) => !i.label.match(/C:\\\\|\/Users\//))).toBe(true);
    expect(checklist.some((i) => i.label.match(/not production legacy/i))).toBe(true);
    expect(checklist.some((i) => i.label.match(/mirror import healthy/i))).toBe(true);
  });

  it("flags stale mirror in readiness summary", () => {
    const staleFinishedAt = new Date(Date.now() - MIRROR_IMPORT_STALE_MS - 60_000).toISOString();
    const chips = resolvePilotReadinessSummary(
      "connected",
      {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: true,
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
            finishedAt: staleFinishedAt,
          },
        ],
      },
    );
    expect(chips.some((c) => c.key === "mirror-stale")).toBe(true);
  });

  it("marks write mode active as danger in readiness summary", () => {
    const chips = resolvePilotReadinessSummary(
      "connected",
      {
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: true,
        sqlitePathConfigured: true,
      },
      null,
    );
    expect(chips.some((c) => c.key === "writes-active" && c.tone === "danger")).toBe(true);
  });

  it("returns only bridge-offline chip when disconnected", () => {
    const chips = resolvePilotReadinessSummary("offline", null, null);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.key).toBe("bridge-offline");
  });

  it("warns on mirror import checklist when runs are stale", () => {
    const staleFinishedAt = new Date(Date.now() - MIRROR_IMPORT_STALE_MS - 60_000).toISOString();
    const checklist = resolvePilotReadinessChecklist(
      "connected",
      {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: true,
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
            finishedAt: staleFinishedAt,
          },
        ],
      },
    );
    const mirrorImport = checklist.find((i) => i.key === "mirrorImport");
    expect(mirrorImport?.tone).toBe("warn");
    expect(mirrorImport?.nextStep).toMatch(/stale|mirror import/i);
  });

  it("resolveFrontDeskOverview shows connect guidance when offline", () => {
    const rows = resolveFrontDeskOverview({
      bridgePhase: "offline",
      mirrorStatus: null,
      writeCapability: null,
      todayAppointmentCount: null,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.key).toBe("bridge");
    expect(rows[1]?.key).toBe("guidance");
    expect(rows[1]?.value).toMatch(/Connect the clinic service/i);
    expect(rows.every((r) => !r.value.match(/C:\\\\|\/Users\//))).toBe(true);
  });

  it("resolveFrontDeskOverview includes mirror, write mode, today count, and selected patient", () => {
    const rows = resolveFrontDeskOverview({
      bridgePhase: "connected",
      mirrorStatus: {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: ["patients"],
        latestImportRuns: [
          {
            tableName: "patients",
            status: "success",
            rowCount: 1,
            errorCount: 0,
            finishedAt: new Date().toISOString(),
          },
        ],
      },
      writeCapability: {
        writeMode: "disabled",
        writesPermitted: false,
        writableSandbox: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
        sqlitePathConfigured: true,
      },
      todayAppointmentCount: 3,
      selectedPatientId: "55",
      selectedPatientDisplayName: "Desk Overview Synth",
      selectedPatientChartNumber: "DO-55",
    });
    expect(rows.some((r) => r.key === "mirror" && r.value.match(/Mirror active/i))).toBe(true);
    expect(rows.some((r) => r.key === "write-mode" && r.value.match(/Writes off/i))).toBe(true);
    expect(rows.some((r) => r.key === "today" && r.value === "3 appointments")).toBe(true);
    expect(rows.some((r) => r.key === "selected-patient" && r.value.match(/Desk Overview Synth · Chart DO-55/))).toBe(
      true,
    );
    expect(rows.some((r) => r.key === "sandbox-pilot" && r.value.match(/off in this build/i))).toBe(true);
  });

  it("resolveFrontDeskOverview includes sandbox pilot on, session recent count, and status mix", () => {
    const rows = resolveFrontDeskOverview({
      bridgePhase: "connected",
      mirrorStatus: {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: ["patients"],
        latestImportRuns: [
          {
            tableName: "patients",
            status: "success",
            rowCount: 1,
            errorCount: 0,
            finishedAt: new Date().toISOString(),
          },
        ],
      },
      writeCapability: {
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: true,
        sqlitePathConfigured: true,
      },
      todayAppointmentCount: 2,
      sandboxWritePilot: true,
      sessionRecentPatientCount: 3,
      todayStatusMix: "1 scheduled · 1 confirmed",
    });
    expect(rows.some((r) => r.key === "sandbox-pilot" && r.value.match(/enabled in this app build/i))).toBe(true);
    expect(rows.some((r) => r.key === "session-recent" && r.value === "3 patients")).toBe(true);
    expect(rows.some((r) => r.key === "status-mix" && r.value === "1 scheduled · 1 confirmed")).toBe(true);
    expect(rows.every((r) => !r.value.match(/C:\\\\|\/Users\//))).toBe(true);
  });

  it("resolveFrontDeskOverview rows never include forbidden PHI tokens", () => {
    const rows = resolveFrontDeskOverview({
      bridgePhase: "connected",
      mirrorStatus: {
        sqliteConfigured: true,
        sqliteUsable: true,
        importedTables: ["patients"],
        latestImportRuns: [
          {
            tableName: "patients",
            status: "success",
            rowCount: 1,
            errorCount: 0,
            finishedAt: new Date().toISOString(),
          },
        ],
      },
      writeCapability: {
        writeMode: "enabled",
        writesPermitted: true,
        writableSandbox: true,
        dataRootConfigured: true,
        backupDirConfigured: true,
        sqlitePathConfigured: true,
      },
      todayAppointmentCount: 2,
      sandboxWritePilot: true,
      sessionRecentPatientCount: 3,
      todayStatusMix: "1 scheduled · 1 confirmed",
      selectedPatientDisplayName: "Desk Overview Synth",
      selectedPatientChartNumber: "DO-55",
    });
    const text = rows.map((r) => r.value).join(" ");
    expect(text).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bAMOUNT\b|\bSAMOUNT\b|\brawRow\b/i);
  });
});
