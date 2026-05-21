import { describe, expect, it } from "vitest";
import { buildDoctorLabelMap, doctorDisplayLabel, normalizeDoctorId, profileAssignedProviderLabel } from "./doctor-labels.js";

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

describe("profileAssignedProviderLabel", () => {
  const labels = buildDoctorLabelMap([
    { doctorId: "5", displayName: "Synthetic Provider Gamma", active: true },
  ]);

  it("uses Doctor {id} fallback when reference is missing", () => {
    expect(profileAssignedProviderLabel(9, labels)).toBe("Doctor 9");
  });

  it("returns em dash when provider id is absent", () => {
    expect(profileAssignedProviderLabel(null, labels)).toBe("—");
    expect(profileAssignedProviderLabel(0, labels)).toBe("—");
  });

  it("never emits forbidden DBF field tokens in labels", () => {
    const outputs = [
      doctorDisplayLabel(9, labels),
      doctorDisplayLabel(5, labels),
      profileAssignedProviderLabel(9, labels),
      profileAssignedProviderLabel(null, labels),
    ];
    for (const out of outputs) {
      if (out) {
        expect(out).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bAMOUNT\b|\bSAMOUNT\b/i);
      }
    }
  });
});
