import { z } from "zod";
import { PatientProfilePathParamsSchema } from "./patient-profile.js";

/** Path params for `GET /v1/patients/:patientId/chart` (same id rules as profile). */
export const PatientChartPathParamsSchema = PatientProfilePathParamsSchema;

export type PatientChartPathParams = z.infer<typeof PatientChartPathParamsSchema>;

/** One tooth chart row from `CHARTDBF.DBF` (safe fields only). */
export const PatientChartEntrySchema = z
  .object({
    /** Opaque stable id within this response (`{toothNumber}-{chartType}-{ordinal}`). */
    chartEntryId: z.string().min(1),
    patientId: z.string(),
    /** `TOOTH_NB` when non-zero; otherwise null. */
    toothNumber: z.number().int().nullable(),
    /** `TYPE` chart variant code when readable; opaque semantics. */
    chartType: z.number().int().nullable(),
    /** `TREATED` logical when readable; false when unknown. */
    treated: z.boolean(),
    /** True when `NOTE` memo appears populated; memo text never returned. */
    hasNote: z.boolean(),
  })
  .strict();

export type PatientChartEntry = z.infer<typeof PatientChartEntrySchema>;

export const PatientChartResponseSchema = z
  .object({
    patientId: z.string(),
    entries: z.array(PatientChartEntrySchema),
    /**
     * True when more than the server cap of matching rows exist for this patient
     * (scan stopped at the cap).
     */
    truncated: z.boolean(),
    privacyNote: z.literal(
      "Chart memos, layer code legends, clinical labels, and raw CHARTDBF rows are never exposed by this route.",
    ),
  })
  .strict();

export type PatientChartResponse = z.infer<typeof PatientChartResponseSchema>;
