import { z } from "zod";
import { PatientProfilePathParamsSchema } from "./patient-profile.js";

const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);

/** Path params for `GET /v1/patients/:patientId/medical-summary` (same id rules as profile). */
export const PatientMedicalSummaryPathParamsSchema = PatientProfilePathParamsSchema;

export type PatientMedicalSummaryPathParams = z.infer<typeof PatientMedicalSummaryPathParamsSchema>;

/**
 * FoxPro `L` screening flags from `MEDICAL.DBF` only — never free-text `PROBLEM`, `ALLERGY_TO`, or `NOTES`.
 * Keys mirror legacy column names in camelCase.
 */
export const MedicalConditionFlagsSchema = z
  .object({
    hospital: z.boolean().nullable(),
    physician: z.boolean().nullable(),
    medicine: z.boolean().nullable(),
    ill: z.boolean().nullable(),
    reaction: z.boolean().nullable(),
    bleeding: z.boolean().nullable(),
    allergic: z.boolean().nullable(),
    heartTrouble: z.boolean().nullable(),
    congenitalHeart: z.boolean().nullable(),
    heartMurmur: z.boolean().nullable(),
    highBloodPressure: z.boolean().nullable(),
    lowBloodPressure: z.boolean().nullable(),
    anemia: z.boolean().nullable(),
    rheumaticFever: z.boolean().nullable(),
    jaundice: z.boolean().nullable(),
    asthma: z.boolean().nullable(),
    cough: z.boolean().nullable(),
    kidneyTrouble: z.boolean().nullable(),
    med1: z.boolean().nullable(),
    diabetes: z.boolean().nullable(),
    tuberculosis: z.boolean().nullable(),
    hepatitis: z.boolean().nullable(),
    arthritis: z.boolean().nullable(),
    stroke: z.boolean().nullable(),
    epilepsy: z.boolean().nullable(),
    psychiatric: z.boolean().nullable(),
    sinusTrouble: z.boolean().nullable(),
    pregnant: z.boolean().nullable(),
    ulcers: z.boolean().nullable(),
    aids: z.boolean().nullable(),
    med2: z.boolean().nullable(),
  })
  .strict();

export type MedicalConditionFlags = z.infer<typeof MedicalConditionFlagsSchema>;

/** Read-only medical screening summary (`MEDICAL.DBF` only). */
export const PatientMedicalSummaryResponseSchema = z
  .object({
    patientId: z.string(),
    /** `true` when at least one non-deleted `MEDICAL` row matches `PATIENT_ID`. */
    hasMedicalRecord: z.boolean(),
    /**
     * `true` when blocked text fields appear populated (`PROBLEM`, `ALLERGY_TO`, or `NOTES`);
     * values are never returned.
     */
    hasSensitiveMedicalDetails: z.boolean(),
    /** Latest questionnaire `DATE` on the chosen row, when readable. */
    lastUpdated: isoDate,
    /** `LAST_DENTA` on the chosen row (date only). */
    lastDentalVisit: isoDate,
    /** Count of screening flags that resolved to `true`. */
    flaggedConditionCount: z.number().int().nonnegative(),
    /** Present when `hasMedicalRecord`; each flag is `true`, `false`, or `null` if unreadable. */
    conditions: MedicalConditionFlagsSchema.nullable(),
    /**
     * Fixed notice: free-text and memo columns from `MEDICAL` are never exposed by this route.
     */
    privacyNote: z.literal(
      "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed.",
    ),
  })
  .strict();

export type PatientMedicalSummaryResponse = z.infer<typeof PatientMedicalSummaryResponseSchema>;
