import { z } from "zod";
import { PatientProfilePathParamsSchema } from "./patient-profile.js";

const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);

/** Path params for `GET /v1/patients/:patientId/treatments` (same id rules as profile). */
export const PatientTreatmentsPathParamsSchema = PatientProfilePathParamsSchema;

export type PatientTreatmentsPathParams = z.infer<typeof PatientTreatmentsPathParamsSchema>;

/** One procedure line from `OPERTBL.DBF` (safe fields only). */
export const PatientTreatmentItemSchema = z
  .object({
    /** `OPNUM` stringified — unique within a patient's history in legacy usage. */
    treatmentId: z.string().min(1),
    patientId: z.string(),
    date: isoDate,
    /** `TOOTHNB` when non-zero; otherwise null. */
    tooth: z.number().int().nullable(),
    /** Trimmed `PROCNB` when present. */
    procedureCode: z.string().nullable(),
    /** Label from `PROCCHRT` when resolved; never raw `OPERTBL.PROCEDURE`. */
    procedureLabel: z.string().nullable(),
    /** `DOCT` when non-zero (opaque provider index). */
    doctorId: z.string().nullable(),
    /** `DOCTORS.NAME` when resolved from reference scan. */
    doctorLabel: z.string().nullable(),
    /** `STATUS` numeric code when readable. */
    status: z.number().int().nullable(),
    /** True when `DESCRIPT` memo or `DESC` character field appear populated; values never returned. */
    hasDescription: z.boolean(),
  })
  .strict();

export type PatientTreatmentItem = z.infer<typeof PatientTreatmentItemSchema>;

export const PatientTreatmentsResponseSchema = z
  .object({
    patientId: z.string(),
    treatments: z.array(PatientTreatmentItemSchema),
    /**
     * True when more than the server cap of matching rows exist for this patient
     * (scan stopped at the cap).
     */
    truncated: z.boolean(),
    privacyNote: z.literal(
      "Procedure memos, per-line descriptions, fee columns, and raw OPERTBL rows are never exposed by this route.",
    ),
  })
  .strict();

export type PatientTreatmentsResponse = z.infer<typeof PatientTreatmentsResponseSchema>;
