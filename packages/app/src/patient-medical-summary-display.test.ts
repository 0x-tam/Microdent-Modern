import { describe, expect, it } from "vitest";
import {
  formatMedicalQuestionnaireDate,
  MEDICAL_CONDITION_LABELS,
  medicalConditionItemsForDisplay,
  medicalConditionSectionsForDisplay,
  medicalFlaggedCountNeedsPartialNote,
} from "./patient-medical-summary-display.js";

describe("medicalConditionItemsForDisplay", () => {
  it("returns empty array for null conditions", () => {
    expect(medicalConditionItemsForDisplay(null)).toEqual([]);
  });

  it("returns empty array when no flags are true", () => {
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
      asthma: false,
      cough: null,
      kidneyTrouble: null,
      med1: null,
      diabetes: false,
      tuberculosis: null,
      hepatitis: null,
      arthritis: null,
      stroke: null,
      epilepsy: null,
      psychiatric: null,
      sinusTrouble: null,
      pregnant: null,
      ulcers: null,
      aids: null,
      med2: null,
    });
    expect(items).toEqual([]);
  });

  it("skips unknown keys without generic labels", () => {
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
      med1: null,
      diabetes: null,
      tuberculosis: null,
      hepatitis: null,
      arthritis: null,
      stroke: null,
      epilepsy: null,
      psychiatric: null,
      sinusTrouble: null,
      pregnant: null,
      ulcers: null,
      aids: null,
      med2: null,
      unknownLegacyKey: true,
    } as Parameters<typeof medicalConditionItemsForDisplay>[0]);
    expect(items.map((i) => i.key)).toEqual(["asthma"]);
    expect(items[0]?.label).toBe(MEDICAL_CONDITION_LABELS.asthma);
  });

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

  it("formats questionnaire dates with Intl", () => {
    expect(formatMedicalQuestionnaireDate("2024-06-01")).toMatch(/2024/);
    expect(formatMedicalQuestionnaireDate(null)).toBeNull();
  });

  it("detects when flagged count exceeds visible named flags", () => {
    expect(medicalFlaggedCountNeedsPartialNote(3, 2)).toBe(true);
    expect(medicalFlaggedCountNeedsPartialNote(2, 2)).toBe(false);
    expect(medicalFlaggedCountNeedsPartialNote(0, 0)).toBe(false);
  });

  it("splits flags into general screening and additional markers", () => {
    const sections = medicalConditionSectionsForDisplay({
      hospital: true,
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
      med1: null,
      diabetes: null,
      tuberculosis: null,
      hepatitis: null,
      arthritis: null,
      stroke: null,
      epilepsy: null,
      psychiatric: null,
      sinusTrouble: null,
      pregnant: null,
      ulcers: null,
      aids: null,
      med2: null,
    });
    expect(sections.general.map((i) => i.key)).toEqual(["hospital"]);
    expect(sections.additional.map((i) => i.key)).toEqual(["asthma"]);
    expect(medicalConditionItemsForDisplay({
      hospital: true,
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
      med1: null,
      diabetes: null,
      tuberculosis: null,
      hepatitis: null,
      arthritis: null,
      stroke: null,
      epilepsy: null,
      psychiatric: null,
      sinusTrouble: null,
      pregnant: null,
      ulcers: null,
      aids: null,
      med2: null,
    })).toHaveLength(2);
  });

  it("sorts labels alphabetically for stable display", () => {
    const items = medicalConditionItemsForDisplay({
      hospital: false,
      physician: null,
      medicine: null,
      ill: null,
      reaction: null,
      bleeding: null,
      allergic: null,
      heartTrouble: true,
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
      med1: null,
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
      aids: null,
      med2: null,
    });
    const labels = items.map((i) => i.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});
