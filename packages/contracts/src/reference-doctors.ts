import { z } from "zod";

/** One provider row from `DOCTORS.DBF` — safe reference fields only. */
export const ReferenceDoctorItemSchema = z
  .object({
    /** `DOCTOR_NB` as a positive integer string (join key for schedule `DOC_ID`, patient `DOCTOR_NB`, etc.). */
    doctorId: z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,14}$/, "doctorId must be a positive integer without leading zeros"),
    /** Trimmed `NAME` when non-empty; otherwise a neutral `Doctor {id}` label. */
    displayName: z.string().min(1),
    /**
     * Derived from `SCHEDULE` (`N` 1,0) when value is exactly 0 or 1; `null` if absent or ambiguous.
     * Legacy semantics for `SCHEDULE` are not fully documented — treat as scheduling-enabled hint only.
     */
    active: z.boolean().nullable(),
  })
  .strict();

export type ReferenceDoctorItem = z.infer<typeof ReferenceDoctorItemSchema>;

export const ReferenceDoctorsResponseSchema = z
  .object({
    doctors: z.array(ReferenceDoctorItemSchema),
  })
  .strict();

export type ReferenceDoctorsResponse = z.infer<typeof ReferenceDoctorsResponseSchema>;
