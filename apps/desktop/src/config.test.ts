import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  defaultDesktopConfig,
  desktopConfigDir,
  desktopConfigNeedsSetup,
  configPath,
  loadDesktopConfig,
  saveDesktopConfig,
} from "./config.js";

const homedirMock = vi.hoisted(() => vi.fn(() => "/home/operator"));
const platformMock = vi.hoisted(() => vi.fn(() => "linux"));

function portablePath(value: string): string {
  return value.replace(/\\/g, "/");
}

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: homedirMock,
    platform: platformMock,
  };
});

describe("desktop config defaults", () => {
  it("defaults WRITE_MODE to disabled for packaged safety", () => {
    expect(defaultDesktopConfig().writeMode).toBe("disabled");
  });

  it("does not set dataRoot or sqlitePath in defaults", () => {
    const config = defaultDesktopConfig();
    expect(config).not.toHaveProperty("dataRoot");
    expect(config).not.toHaveProperty("sqlitePath");
    expect("dataRoot" in config).toBe(false);
    expect("sqlitePath" in config).toBe(false);
  });

  it("only ships operator-controlled path fields when explicitly configured", () => {
    const keys = Object.keys(defaultDesktopConfig());
    expect(keys).toEqual(["version", "bridgePort", "writeMode"]);
  });

  it("does not include backupDir in defaults", () => {
    expect(defaultDesktopConfig()).not.toHaveProperty("backupDir");
  });
});

describe("desktopConfigNeedsSetup", () => {
  it("requires dataRoot and sqlitePath", () => {
    expect(desktopConfigNeedsSetup(defaultDesktopConfig())).toBe(true);
    expect(
      desktopConfigNeedsSetup({
        version: 1,
        dataRoot: "/tmp/data",
        sqlitePath: "/tmp/mirror.sqlite",
      }),
    ).toBe(false);
  });
});

describe("desktopConfigDir", () => {
  afterEach(() => {
    platformMock.mockReset();
    homedirMock.mockReset();
    homedirMock.mockReturnValue("/home/operator");
  });

  it("uses AppData on Windows", () => {
    platformMock.mockReturnValue("win32");
    expect(portablePath(desktopConfigDir())).toBe("/home/operator/AppData/Microdent");
    expect(portablePath(configPath())).toBe("/home/operator/AppData/Microdent/config.json");
  });

  it("uses Application Support on macOS", () => {
    platformMock.mockReturnValue("darwin");
    expect(portablePath(desktopConfigDir())).toBe(
      "/home/operator/Library/Application Support/Microdent",
    );
  });

  it("uses XDG-style config on Linux and other Unix", () => {
    platformMock.mockReturnValue("linux");
    expect(portablePath(desktopConfigDir())).toBe("/home/operator/.config/microdent");
  });

  it("accepts Windows AppData-style paths in saved config", () => {
    expect(
      desktopConfigNeedsSetup({
        version: 1,
        dataRoot: "C:\\Users\\Operator\\AppData\\Local\\Microdent\\Write-Sandbox\\DATA",
        sqlitePath: "C:\\Users\\Operator\\AppData\\Local\\Microdent\\mirror.sqlite",
        writeMode: "disabled",
      }),
    ).toBe(false);
  });

  it("still requires setup when AppData-style paths are blank", () => {
    expect(
      desktopConfigNeedsSetup({
        version: 1,
        dataRoot: "   ",
        sqlitePath: "C:\\Users\\Operator\\AppData\\Local\\Microdent\\mirror.sqlite",
      }),
    ).toBe(true);
  });
});

describe("saveDesktopConfig round-trip", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
    homedirMock.mockReturnValue("/home/operator");
    platformMock.mockReturnValue("linux");
  });

  it("persists spaced paths and keeps writeMode disabled after load", () => {
    const home = mkdtempSync(join(tmpdir(), "microdent-home-"));
    cleanup.push(home);
    homedirMock.mockReturnValue(home);
    platformMock.mockReturnValue("win32");

    const spacedRoot = join(home, "My Sandbox", "DATA");
    const spacedSqlite = join(home, "My Sandbox", "mirror.sqlite");
    saveDesktopConfig({
      ...defaultDesktopConfig(),
      dataRoot: spacedRoot,
      sqlitePath: spacedSqlite,
      writeMode: "disabled",
    });

    const configFile = join(home, "AppData", "Microdent", "config.json");
    expect(existsSync(configFile)).toBe(true);
    const loaded = loadDesktopConfig();
    expect(loaded.writeMode).toBe("disabled");
    expect(loaded.dataRoot).toBe(spacedRoot);
    expect(loaded.sqlitePath).toBe(spacedSqlite);
    expect(readFileSync(configFile, "utf8")).toContain("My Sandbox");
  });
});
