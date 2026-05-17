import { describe, expect, it } from "vitest";
import { defaultDesktopConfig } from "./config.js";

describe("desktop config defaults", () => {
  it("defaults WRITE_MODE to disabled for packaged safety", () => {
    expect(defaultDesktopConfig().writeMode).toBe("disabled");
  });
});
