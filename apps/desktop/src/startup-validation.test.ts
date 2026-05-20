import { describe, expect, it } from "vitest";
import { validateDesktopStartupConfig } from "./startup-validation.js";

describe("validateDesktopStartupConfig", () => {
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
});
