import { describe, expect, it } from "vitest";
import {
  APP_NAV_MODULES,
  APP_SIDEBAR_MODULES,
  isAppNavPlaceholder,
} from "./app-nav-modules.js";

describe("app-nav-modules", () => {
  it("lists three live sidebar modules", () => {
    expect(APP_SIDEBAR_MODULES.map((m) => m.id)).toEqual(["today", "patients", "schedule", "settings"]);
  });

  it("keeps placeholder ids in the full export for docs compatibility", () => {
    expect(APP_NAV_MODULES.map((m) => m.id)).toContain("dental-chart");
    expect(APP_NAV_MODULES.map((m) => m.id)).toContain("settings");
  });

  it("classifies placeholder nav ids", () => {
    expect(isAppNavPlaceholder("reports")).toBe(true);
    expect(isAppNavPlaceholder("patients")).toBe(false);
  });
});
