import { describe, expect, it } from "vitest";
import {
  CLINIC_FRIENDLY_DBF_FALLBACK,
  CLINIC_FRIENDLY_LOCAL_COPY_READY,
  CLINIC_FRIENDLY_READ_ONLY,
  friendlyEditingStatus,
  friendlyLocalCopyStatus,
  friendlyMirrorReadinessLabel,
  friendlyWriteModeChipLabel,
} from "./clinic-friendly-copy.js";

describe("clinic-friendly-copy", () => {
  it("maps technical mirror readiness labels to clinic-friendly strings", () => {
    expect(friendlyMirrorReadinessLabel("Mirror unavailable — DBF fallback")).toBe(CLINIC_FRIENDLY_DBF_FALLBACK);
    expect(friendlyMirrorReadinessLabel("Mirror active")).toBe(CLINIC_FRIENDLY_LOCAL_COPY_READY);
    expect(friendlyMirrorReadinessLabel("Mirror stale (older than 48h)")).toMatch(/outdated/i);
  });

  it("maps write-mode chip labels without exposing write mode jargon", () => {
    expect(friendlyWriteModeChipLabel("Writes off")).toBe(CLINIC_FRIENDLY_READ_ONLY);
    expect(friendlyWriteModeChipLabel("Write mode: dry-run")).toMatch(/preview/i);
    expect(friendlyWriteModeChipLabel("Checking capability loads")).toMatch(/checking/i);
  });

  it("friendlyLocalCopyStatus never returns SQLite or mirror tokens", () => {
    const offline = friendlyLocalCopyStatus("offline", null);
    const fallback = friendlyLocalCopyStatus("connected", { sqliteUsable: false } as never);
    const blob = [offline.label, fallback.label].join(" ");
    expect(blob).not.toMatch(/sqlite|dbf|mirror/i);
    expect(fallback.label).toBe(CLINIC_FRIENDLY_DBF_FALLBACK);
  });

  it("friendlyEditingStatus uses read-only and preview labels", () => {
    const disabled = friendlyEditingStatus({
      writeMode: "disabled",
      writableSandbox: false,
      writesPermitted: false,
      dataRootConfigured: true,
      backupDirConfigured: false,
    } as never);
    const dryRun = friendlyEditingStatus(
      {
        writeMode: "dry-run",
        writableSandbox: true,
        writesPermitted: false,
        dataRootConfigured: true,
        backupDirConfigured: false,
      } as never,
      true,
    );
    expect(disabled.label).toBe(CLINIC_FRIENDLY_READ_ONLY);
    expect(dryRun.label).toMatch(/preview/i);
    expect(JSON.stringify([disabled, dryRun])).not.toMatch(/write mode|sandbox write pilot/i);
  });
});
