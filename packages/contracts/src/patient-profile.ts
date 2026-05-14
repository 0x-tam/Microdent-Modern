import { z } from "zod";
import { SafePatientSummarySchema } from "./patient-search.js";

const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);

/** Path params for `GET /v1/patients/:patientId/profile` (must match search `patientId` string form). */
export const PatientProfilePathParamsSchema = z.object({
  patientId: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,14}$/, "patientId must be a positive integer without leading zeros"),
});

export type PatientProfilePathParams = z.infer<typeof PatientProfilePathParamsSchema>;

/** Read-only profile: extends {@link SafePatientSummarySchema} with non-memo operational fields only. */
export const PatientProfileResponseSchema = SafePatientSummarySchema.extend({
  /** `REV_NAME` when non-empty; aids “Last, First” style headers without exposing other columns. */
  reverseName: z.string().nullable(),
  /** `ACTIVE` logical when readable; `null` if absent/ambiguous. */
  active: z.boolean().nullable(),
  /** `DOCTOR_NB` when non-zero (opaque staff id). */
  doctorId: z.string().nullable(),
  /** `ENTRY_DATE` as `YYYY-MM-DD` when present. */
  entryDate: isoDate,
  /** `LASTVISIT` as `YYYY-MM-DD` when present (date only; not free text). */
  lastVisit: isoDate,
}).strict();

export type PatientProfileResponse = z.infer<typeof PatientProfileResponseSchema>;
