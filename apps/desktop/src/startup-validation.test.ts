import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectDesktopStartupWarnings,
  validateDesktopStartupConfig,
} from "./startup-validation.js";

describe("collectDesktopStartupWarnings", () => {
  it("warns when write mode is enabled without BACKUP_DIR", () => {
    const warnings = collectDesktopStartupWarnings({
      version: 1,
      writeMode: "enabled",
      dataRoot: "C:\\sandbox\\DATA",
      sqlitePath: "C:\\mirror.sqlite",
    });
    expect(warnings.some((w) => /BACKUP_DIR/i.test(w))).toBe(true);
  });

  it("does not warn when write mode is disabled", () => {
    expect(
      collectDesktopStartupWarnings({
        version: 1,
        writeMode: "disabled",
        dataRoot: "C:\\sandbox\\DATA",
        sqlitePath: "C:\\mirror.sqlite",
      }),
    ).toHaveLength(0);
  });
});

describe("validateDesktopStartupConfig", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it("requires DATA_ROOT and SQLITE_PATH", () => {
    expect(() => validateDesktopStartupConfig({ version: 1 })).toThrow(/DATA_ROOT is required/i);
    expect(() =>
      validateDesktopStartupConfig({ version: 1, dataRoot: "C:\\sandbox\\DATA" }),
    ).toThrow(/SQLITE_PATH is required/i);
  });

  it("rejects unknown writeMode", () => {
    expect(() =>
      validateDesktopStartupConfig({
        version: 1,
        writeMode: "production" as "disabled",
      }),
    ).toThrow(/invalid writeMode/i);
  });

  it("rejects relative DATA_ROOT with masked hint", () => {
    expect(() =>
      validateDesktopStartupConfig({
        version: 1,
        dataRoot: "relative/data",
        sqlitePath: "C:\\mirror.sqlite",
      }),
    ).toThrow(/DATA_ROOT.*absolute/i);
  });

  it("accepts a not-yet-created local copy path when parent can be created", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "microdent-startup-data-"));
    const mirrorParent = mkdtempSync(join(tmpdir(), "microdent-startup-mirror-"));
    cleanup.push(dataRoot, mirrorParent);
    expect(() =>
      validateDesktopStartupConfig({
        version: 1,
        dataRoot,
        sqlitePath: join(mirrorParent, "nested", "clinic.sqlite"),
        writeMode: "disabled",
      }),
    ).not.toThrow();
  });
});
