import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultDesktopConfig, desktopConfigDir, configPath } from "./config.js";

const homedirMock = vi.hoisted(() => vi.fn(() => "/home/operator"));
const platformMock = vi.hoisted(() => vi.fn(() => "linux"));

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
});

describe("desktopConfigDir", () => {
  afterEach(() => {
    platformMock.mockReset();
    homedirMock.mockReset();
    homedirMock.mockReturnValue("/home/operator");
  });

  it("uses AppData on Windows", () => {
    platformMock.mockReturnValue("win32");
    expect(desktopConfigDir()).toBe("/home/operator/AppData/Microdent");
    expect(configPath()).toBe("/home/operator/AppData/Microdent/config.json");
  });

  it("uses Application Support on macOS", () => {
    platformMock.mockReturnValue("darwin");
    expect(desktopConfigDir()).toBe(
      "/home/operator/Library/Application Support/Microdent",
    );
  });

  it("uses XDG-style config on Linux and other Unix", () => {
    platformMock.mockReturnValue("linux");
    expect(desktopConfigDir()).toBe("/home/operator/.config/microdent");
  });
});
