import { describe, expect, it } from "vitest";
import {
  MEDICAL_CONDITION_LABELS,
  medicalConditionItemsForDisplay,
} from "./patient-medical-summary-display.js";

describe("medicalConditionItemsForDisplay", () => {
  it("returns generic labels for true flags and omits med1, med2, and aids", () => {
    const items = medicalConditionItemsForDisplay({
      hospital: false,
      physician: null,
      medicine: null,
      ill: null,
      reaction: null,
      bleeding: null,
      allergic: null,
      heartTrouble: null,
      congenitalHeart: null,
      heartMurmur: null,
      highBloodPressure: null,
      lowBloodPressure: null,
      anemia: null,
      rheumaticFever: null,
      jaundice: null,
      asthma: true,
      cough: null,
      kidneyTrouble: null,
      med1: true,
      diabetes: true,
      tuberculosis: null,
      hepatitis: null,
      arthritis: null,
      stroke: null,
      epilepsy: null,
      psychiatric: null,
      sinusTrouble: null,
      pregnant: null,
      ulcers: null,
      aids: true,
      med2: true,
    });
    const labels = items.map((i) => i.label);
    expect(labels).toContain(MEDICAL_CONDITION_LABELS.asthma);
    expect(labels).toContain(MEDICAL_CONDITION_LABELS.diabetes);
    expect(labels).not.toContain("med1");
    expect(labels).not.toContain("med2");
    expect(labels).not.toContain("aids");
    expect(items.some((i) => i.key === "med1")).toBe(false);
    expect(items.some((i) => i.key === "aids")).toBe(false);
  });
});
