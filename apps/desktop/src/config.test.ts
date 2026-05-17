import { describe, expect, it } from "vitest";
import { defaultDesktopConfig } from "./config.js";

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
