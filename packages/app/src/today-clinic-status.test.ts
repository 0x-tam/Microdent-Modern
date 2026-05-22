import { describe, expect, it } from "vitest";
import { resolveTodayClinicStatus } from "./today-clinic-status.js";

describe("resolveTodayClinicStatus", () => {
  it("returns three friendly rows: Service, Local copy, Editing", () => {
    const rows = resolveTodayClinicStatus({
      bridgePhase: "connected",
      mirrorStatus: {
        sqliteUsable: true,
        sqlitePathConfigured: true,
        latestImportRuns: [{ finishedAt: new Date().toISOString(), tableCount: 1 }],
      },
      writeCapability: {
        writeMode: "disabled",
        writableSandbox: false,
        writesPermitted: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
      },
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.label)).toEqual(["Service", "Local copy", "Editing"]);
    expect(rows[0]?.value).toBe("Connected");
    expect(rows[1]?.value).toMatch(/Local copy ready/i);
    expect(rows[2]?.value).toBe("Read-only");
  });

  it("shows clinic service offline when bridge is not connected", () => {
    const rows = resolveTodayClinicStatus({
      bridgePhase: "offline",
      mirrorStatus: null,
      writeCapability: null,
    });

    expect(rows[0]?.value).toBe("Clinic service offline");
    expect(rows[1]?.value).toMatch(/Connect the clinic service/i);
    expect(rows[2]?.value).toMatch(/Checking editing/i);
  });

  it("never includes forbidden PHI tokens in row values", () => {
    const rows = resolveTodayClinicStatus({
      bridgePhase: "connected",
      mirrorStatus: null,
      writeCapability: {
        writeMode: "dry-run",
        writableSandbox: true,
        writesPermitted: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
      },
      sandboxWritePilot: true,
    });

    const blob = JSON.stringify(rows);
    expect(blob).not.toMatch(/sqlite|dbf|bridge|sandbox write pilot/i);
    expect(rows[2]?.value).toBe("Preview only");
  });
});
