import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadBridgeConfig,
  loadWriteModeFromEnv,
  parseWriteModeFromValue,
  writesPermitted,
  type BridgeConfig,
} from "./config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseWriteModeFromValue", () => {
  it("defaults unset WRITE_MODE to disabled", () => {
    expect(parseWriteModeFromValue(undefined)).toBe("disabled");
  });

  it("defaults empty WRITE_MODE to disabled", () => {
    expect(parseWriteModeFromValue("")).toBe("disabled");
    expect(parseWriteModeFromValue("   ")).toBe("disabled");
  });

  it("falls back invalid WRITE_MODE to disabled", () => {
    expect(parseWriteModeFromValue("bogus")).toBe("disabled");
    expect(parseWriteModeFromValue("commit")).toBe("disabled");
  });

  it("parses dry-run", () => {
    expect(parseWriteModeFromValue("dry-run")).toBe("dry-run");
    expect(parseWriteModeFromValue(" DRY-RUN ")).toBe("dry-run");
  });

  it("parses enabled and permits writes only with backup dir and data root", () => {
    expect(parseWriteModeFromValue("enabled")).toBe("enabled");
    expect(parseWriteModeFromValue("ENABLED")).toBe("enabled");

    const withoutBackup: BridgeConfig = {
      listen: { host: "127.0.0.1", port: 0 },
      dataRoot: { configured: true, path: "/tmp/data", realPath: "/tmp/data" },
      sqlitePath: { configured: false },
      backupDir: { configured: false },
      writeMode: "enabled",
    };
    expect(writesPermitted(withoutBackup)).toBe(false);

    const ready: BridgeConfig = {
      ...withoutBackup,
      backupDir: { configured: true, path: "/tmp/backups" },
    };
    expect(writesPermitted(ready)).toBe(true);
  });
});

describe("loadWriteModeFromEnv", () => {
  it("reads WRITE_MODE from the environment", () => {
    vi.stubEnv("WRITE_MODE", "dry-run");
    expect(loadWriteModeFromEnv()).toBe("dry-run");
  });
});

describe("loadBridgeConfig", () => {
  it("includes writeMode disabled when WRITE_MODE is unset", () => {
    vi.stubEnv("WRITE_MODE", "");
    expect(loadBridgeConfig().writeMode).toBe("disabled");
  });
});
