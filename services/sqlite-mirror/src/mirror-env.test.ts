import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMirrorEnvFromProcess, parseSqlitePathFromValue } from "./mirror-env.js";
import { parseDataRootFromValue } from "@microdent/bridge/import-source";

describe("parseSqlitePathFromValue", () => {
  it("treats missing value as not configured", () => {
    expect(parseSqlitePathFromValue(undefined)).toEqual({ configured: false });
  });

  it("treats blank value as not configured", () => {
    expect(parseSqlitePathFromValue("   ")).toEqual({ configured: false });
  });

  it("accepts an absolute path", () => {
    const parsed = parseSqlitePathFromValue("/tmp/mirror.sqlite");
    expect(parsed).toEqual({ configured: true, path: "/tmp/mirror.sqlite" });
  });

  it("rejects a relative path", () => {
    expect(() => parseSqlitePathFromValue("mirror.sqlite")).toThrow(/SQLITE_PATH must be an absolute path/);
  });
});

describe("loadMirrorEnvFromProcess", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports missing DATA_ROOT and SQLITE_PATH", () => {
    vi.stubEnv("DATA_ROOT", "");
    vi.stubEnv("SQLITE_PATH", "");
    const loaded = loadMirrorEnvFromProcess();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.missing).toContain("DATA_ROOT");
      expect(loaded.missing).toContain("SQLITE_PATH");
    }
  });

  it("returns env when both absolute paths are set", () => {
    vi.stubEnv("DATA_ROOT", "/tmp/data-root");
    vi.stubEnv("SQLITE_PATH", "/tmp/mirror.sqlite");
    const loaded = loadMirrorEnvFromProcess();
    expect(loaded).toEqual({
      ok: true,
      env: { dataRoot: "/tmp/data-root", sqlitePath: "/tmp/mirror.sqlite" },
    });
  });

  it("throws when DATA_ROOT is relative", () => {
    vi.stubEnv("DATA_ROOT", "relative/data");
    vi.stubEnv("SQLITE_PATH", "/tmp/mirror.sqlite");
    expect(() => loadMirrorEnvFromProcess()).toThrow(/DATA_ROOT must be an absolute path/);
  });

  it("throws when SQLITE_PATH is relative", () => {
    vi.stubEnv("DATA_ROOT", "/tmp/data-root");
    vi.stubEnv("SQLITE_PATH", "mirror.sqlite");
    expect(() => loadMirrorEnvFromProcess()).toThrow(/SQLITE_PATH must be an absolute path/);
  });
});

describe("parseDataRootFromValue (mirror)", () => {
  it("rejects relative DATA_ROOT", () => {
    expect(() => parseDataRootFromValue("data")).toThrow(/DATA_ROOT must be an absolute path/);
  });
});
