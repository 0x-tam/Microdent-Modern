import { describe, expect, it } from "vitest";
import { normalizePatientSearchResultItemForWire } from "@microdent/contracts";

describe("normalizePatientSearchResultItemForWire", () => {
  it("coerces bigint patientId to string", () => {
    const r = normalizePatientSearchResultItemForWire({
      patientId: BigInt(12),
      chartNumber: null,
      displayName: "Synth",
      phoneMask: null,
    });
    expect(r.patientId).toBe("12");
    expect(Object.keys(r).sort()).toEqual(["chartNumber", "displayName", "patientId", "phoneMask"]);
  });
});
