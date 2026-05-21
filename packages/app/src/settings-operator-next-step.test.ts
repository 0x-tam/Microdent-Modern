import { describe, expect, it } from "vitest";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { resolveSettingsOperatorNextStep } from "./settings-operator-next-step.js";
import {
  SETTINGS_NEXT_STEP_BACKUP,
  SETTINGS_NEXT_STEP_BRIDGE,
  SETTINGS_NEXT_STEP_DESKTOP_SETUP,
  SETTINGS_NEXT_STEP_MIRROR_IMPORT,
  SETTINGS_NEXT_STEP_MIRROR_STALE,
  SETTINGS_NEXT_STEP_WRITE_DRY_RUN,
  SETTINGS_NEXT_STEP_WRITE_ENABLED,
} from "./read-only-ui-copy.js";
import { MIRROR_IMPORT_STALE_MS } from "./mirror-stale.js";

const writeCapBase: BridgeDevStatusResponse = {
  writeMode: "disabled",
  writesPermitted: false,
  writableSandbox: false,
  dataRootConfigured: true,
  backupDirConfigured: false,
  sqlitePathConfigured: true,
};

describe("resolveSettingsOperatorNextStep", () => {
  it("suggests connecting the clinic service when offline", () => {
    expect(
      resolveSettingsOperatorNextStep("bridge", "offline", null, null),
    ).toBe(SETTINGS_NEXT_STEP_DESKTOP_SETUP);
  });

  it("suggests bridge start when checking", () => {
    expect(
      resolveSettingsOperatorNextStep("bridge", "checking", null, null),
    ).toBe(SETTINGS_NEXT_STEP_BRIDGE);
  });

  it("suggests backup folder when writes enabled without BACKUP_DIR", () => {
    expect(
      resolveSettingsOperatorNextStep("backup", "connected", {
        ...writeCapBase,
        writeMode: "enabled",
        backupDirConfigured: false,
      }, null),
    ).toBe(SETTINGS_NEXT_STEP_BACKUP);
  });

  it("suggests mirror import when no runs recorded", () => {
    const mirror: MirrorStatusResponse = {
      sqliteConfigured: true,
      sqliteUsable: true,
      importedTables: [],
      latestImportRuns: [],
    };
    expect(
      resolveSettingsOperatorNextStep("mirror", "connected", writeCapBase, mirror),
    ).toMatch(/mirror import/i);
  });

  it("suggests stale mirror re-import when metadata is old", () => {
    const staleFinishedAt = new Date(Date.now() - MIRROR_IMPORT_STALE_MS - 60_000).toISOString();
    const mirror: MirrorStatusResponse = {
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
    };
    expect(
      resolveSettingsOperatorNextStep("mirror", "connected", writeCapBase, mirror),
    ).toBe(SETTINGS_NEXT_STEP_MIRROR_STALE);
    expect(
      resolveSettingsOperatorNextStep("mirrorImport", "connected", writeCapBase, mirror),
    ).toBe(SETTINGS_NEXT_STEP_MIRROR_STALE);
  });

  it("suggests dry-run guidance when write mode is dry-run", () => {
    expect(
      resolveSettingsOperatorNextStep(
        "write",
        "connected",
        { ...writeCapBase, writeMode: "dry-run", writableSandbox: true },
        null,
      ),
    ).toBe(SETTINGS_NEXT_STEP_WRITE_DRY_RUN);
  });

  it("suggests enabled-write caution when commits are on", () => {
    expect(
      resolveSettingsOperatorNextStep(
        "write",
        "connected",
        { ...writeCapBase, writeMode: "enabled", writableSandbox: true, writesPermitted: true },
        null,
      ),
    ).toBe(SETTINGS_NEXT_STEP_WRITE_ENABLED);
  });

  it("returns null for bridge card when connected", () => {
    expect(resolveSettingsOperatorNextStep("bridge", "connected", writeCapBase, null)).toBeNull();
  });
});
