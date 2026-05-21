import { describe, expect, it } from "vitest";
import {
  APP_NAV_MODULES,
  APP_NAV_UNSUPPORTED_MODULES,
  APP_SIDEBAR_MODULES,
  formatSelectedPatientContextLabel,
  getAppSidebarModule,
  isAppNavPlaceholder,
  resolveSidebarNavHint,
} from "./app-nav-modules.js";

describe("app-nav-modules", () => {
  it("lists four live sidebar modules with page metadata", () => {
    expect(APP_SIDEBAR_MODULES.map((m) => m.id)).toEqual(["today", "patients", "schedule", "settings"]);
    for (const module of APP_SIDEBAR_MODULES) {
      expect(module.label.length).toBeGreaterThan(0);
      expect(module.sublabel.length).toBeGreaterThan(0);
      expect(module.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps placeholder ids in the full export for docs compatibility", () => {
    expect(APP_NAV_MODULES.map((m) => m.id)).toContain("dental-chart");
    expect(APP_NAV_MODULES.map((m) => m.id)).toContain("settings");
  });

  it("lists unsupported modules kept out of the sidebar", () => {
    expect(APP_NAV_UNSUPPORTED_MODULES.map((m) => m.id)).toEqual([
      "dental-chart",
      "treatments",
      "payments",
      "reports",
    ]);
  });

  it("classifies placeholder nav ids", () => {
    expect(isAppNavPlaceholder("reports")).toBe(true);
    expect(isAppNavPlaceholder("patients")).toBe(false);
  });

  it("resolves sidebar module metadata by id", () => {
    expect(getAppSidebarModule("schedule").label).toBe("Schedule");
    expect(getAppSidebarModule("schedule").description).toMatch(/Day and week views/i);
  });

  it("formats selected patient context labels safely", () => {
    expect(
      formatSelectedPatientContextLabel({
        patientId: "501",
        displayName: "Synthetic Smoke Patient",
        chartNumber: "SYN-SMOKE",
      }),
    ).toBe("Synthetic Smoke Patient · Chart SYN-SMOKE");
    expect(
      formatSelectedPatientContextLabel({
        patientId: "501",
        displayName: "  ",
        chartNumber: null,
      }),
    ).toBe("Patient ID 501");
  });

  it("explains hidden modules in the sidebar hint", () => {
    const hint = resolveSidebarNavHint();
    expect(hint).toMatch(/Dental Chart, Treatments, and Ledger preview are under Patients/i);
    expect(hint).toMatch(/Payments and Reports are not available in this read-only viewer yet/i);
  });
});
