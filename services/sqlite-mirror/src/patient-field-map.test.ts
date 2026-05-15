import { describe, expect, it } from "vitest";
import { buildSearchBlob, mapSafePatientRow, pickPhoneMask } from "./patient-field-map.js";

describe("patient-field-map", () => {
  it("returns null for rows without a patient id", () => {
    expect(mapSafePatientRow({}, false)).toBeNull();
  });

  it("masks phone to last four digits only", () => {
    expect(pickPhoneMask({ HOME_PHONE: "(555) 123-4567" })).toBe("…4567");
    expect(pickPhoneMask({ HOME_PHONE: "12" })).toBeNull();
  });

  it("builds search_blob from safe name and id columns only", () => {
    const blob = buildSearchBlob({
      ID: 42,
      CASENB: "X-1",
      NAME: "Test Name",
      HOME_PHONE: "5550001111",
      STREET: "hidden street",
    });
    expect(blob).toContain("42");
    expect(blob).toContain("test name");
    expect(blob).not.toContain("hidden");
    expect(blob).not.toContain("555");
  });
});
