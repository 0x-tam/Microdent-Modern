import { describe, expect, it } from "vitest";
import type { BridgeDevStatusResponse, MirrorStatusResponse } from "@microdent/contracts";
import { resolveSettingsOperatorNextStep } from "./settings-operator-next-step.js";
import {
  SETTINGS_NEXT_STEP_BACKUP,
  SETTINGS_NEXT_STEP_BRIDGE,
  SETTINGS_NEXT_STEP_MIRROR_IMPORT,
} from "./read-only-ui-copy.js";

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
});
