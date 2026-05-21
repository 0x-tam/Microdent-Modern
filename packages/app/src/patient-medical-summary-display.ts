import type { MedicalConditionFlags } from "@microdent/contracts";

/** Generic screening labels — never expose FoxPro column names or free-text fields. */
export const MEDICAL_CONDITION_LABELS: Record<string, string> = {
  hospital: "Hospital admission (screening)",
  physician: "Under physician care (screening)",
  medicine: "Taking medicine (screening)",
  ill: "Serious illness (screening)",
  reaction: "Adverse reaction (screening)",
  bleeding: "Bleeding tendency (screening)",
  allergic: "Allergies indicated (screening flag only)",
  heartTrouble: "Heart trouble (screening)",
  congenitalHeart: "Congenital heart condition (screening)",
  heartMurmur: "Heart murmur (screening)",
  highBloodPressure: "High blood pressure (screening)",
  lowBloodPressure: "Low blood pressure (screening)",
  anemia: "Anemia (screening)",
  rheumaticFever: "Rheumatic fever (screening)",
  jaundice: "Jaundice (screening)",
  asthma: "Asthma (screening)",
  cough: "Persistent cough (screening)",
  kidneyTrouble: "Kidney trouble (screening)",
  diabetes: "Diabetes (screening)",
  tuberculosis: "Tuberculosis (screening)",
  hepatitis: "Hepatitis (screening)",
  arthritis: "Arthritis (screening)",
  stroke: "Stroke (screening)",
  epilepsy: "Epilepsy (screening)",
  psychiatric: "Psychiatric condition (screening)",
  sinusTrouble: "Sinus trouble (screening)",
  pregnant: "Pregnancy (screening)",
  ulcers: "Ulcers (screening)",
};

/** Keys omitted from named lists — still counted via API `flaggedConditionCount`. */
const OMIT_FROM_NAMED_LIST = new Set(["med1", "med2", "aids"]);

/** Core intake screening — shown under “General screening”. */
const GENERAL_SCREENING_KEYS = new Set([
  "hospital",
  "physician",
  "medicine",
  "ill",
  "reaction",
  "bleeding",
  "allergic",
]);

export type MedicalConditionDisplayItem = { key: string; label: string };

export type MedicalConditionSections = {
  general: MedicalConditionDisplayItem[];
  additional: MedicalConditionDisplayItem[];
};

function medicalConditionItem(key: string): MedicalConditionDisplayItem | null {
  const label = MEDICAL_CONDITION_LABELS[key];
  return label ? { key, label } : null;
}

/** Returns safe generic labels for flags that are `true`, excluding legacy/opaque keys. */
export function medicalConditionItemsForDisplay(
  conditions: MedicalConditionFlags | null,
): MedicalConditionDisplayItem[] {
  const sections = medicalConditionSectionsForDisplay(conditions);
  return [...sections.general, ...sections.additional];
}

/** Splits named screening flags into general intake vs additional markers. */
export function medicalConditionSectionsForDisplay(
  conditions: MedicalConditionFlags | null,
): MedicalConditionSections {
  const general: MedicalConditionDisplayItem[] = [];
  const additional: MedicalConditionDisplayItem[] = [];
  if (!conditions) return { general, additional };

  for (const [key, value] of Object.entries(conditions)) {
    if (value !== true || OMIT_FROM_NAMED_LIST.has(key)) continue;
    const item = medicalConditionItem(key);
    if (!item) continue;
    if (GENERAL_SCREENING_KEYS.has(key)) general.push(item);
    else additional.push(item);
  }
  general.sort((a, b) => a.label.localeCompare(b.label));
  additional.sort((a, b) => a.label.localeCompare(b.label));
  return { general, additional };
}

/** Questionnaire dates — same Intl style as treatments and ledger. */
export function formatMedicalQuestionnaireDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso + "T12:00:00"));
  } catch {
    return iso;
  }
}

/** When API count exceeds named flags (med1/med2/aids omitted from list). */
export function medicalFlaggedCountNeedsPartialNote(
  flaggedConditionCount: number,
  visibleNamedCount: number,
): boolean {
  return flaggedConditionCount > 0 && flaggedConditionCount > visibleNamedCount;
}
