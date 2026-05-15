import { describe, expect, it } from "vitest";
import { buildDoctorLabelMap, doctorDisplayLabel, normalizeDoctorId } from "./doctor-labels.js";

describe("normalizeDoctorId", () => {
  it("returns null for zero and invalid values", () => {
    expect(normalizeDoctorId(0)).toBeNull();
    expect(normalizeDoctorId("0")).toBeNull();
    expect(normalizeDoctorId(null)).toBeNull();
    expect(normalizeDoctorId("")).toBeNull();
    expect(normalizeDoctorId(-1)).toBeNull();
  });

  it("normalizes positive integers", () => {
    expect(normalizeDoctorId(7)).toBe("7");
    expect(normalizeDoctorId("7")).toBe("7");
    expect(normalizeDoctorId("07")).toBe("7");
  });
});

describe("buildDoctorLabelMap", () => {
  it("maps doctorId to displayName only", () => {
    const map = buildDoctorLabelMap([
      { doctorId: "3", displayName: "Synthetic Provider Alpha", active: true },
      { doctorId: "12", displayName: "Synthetic Provider Beta", active: null },
    ]);
    expect(map.get("3")).toBe("Synthetic Provider Alpha");
    expect(map.get("12")).toBe("Synthetic Provider Beta");
    expect([...map.keys()]).toEqual(["3", "12"]);
  });
});

describe("doctorDisplayLabel", () => {
  const labels = buildDoctorLabelMap([
    { doctorId: "5", displayName: "Synthetic Provider Gamma", active: true },
  ]);

  it("uses reference displayName when present", () => {
    expect(doctorDisplayLabel(5, labels)).toBe("Synthetic Provider Gamma");
    expect(doctorDisplayLabel("5", labels)).toBe("Synthetic Provider Gamma");
  });

  it("falls back to Doctor {id} when missing from reference", () => {
    expect(doctorDisplayLabel(9, labels)).toBe("Doctor 9");
  });

  it("returns null when there is no provider id", () => {
    expect(doctorDisplayLabel(0, labels)).toBeNull();
    expect(doctorDisplayLabel(null, labels)).toBeNull();
  });
});
