import { z } from "zod";
import { PositiveIntegerIdSchema } from "./safe-write-plan.js";

export const PatientDemographicsPathParamsSchema = z.object({
  patientId: PositiveIntegerIdSchema,
});

export type PatientDemographicsPathParams = z.infer<typeof PatientDemographicsPathParamsSchema>;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional();

export const PatientDemographicsUpdateBodySchema = z
  .object({
    firstName: optionalTrimmed(25),
    lastName: optionalTrimmed(25),
    displayName: optionalTrimmed(51),
    reverseName: optionalTrimmed(51),
    chartNumber: z.union([z.string().trim().max(15), z.null()]).optional(),
    active: z.boolean().optional(),
    doctorId: z.union([PositiveIntegerIdSchema, z.null()]).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one allowlisted field is required",
  });

export type PatientDemographicsUpdateBody = z.infer<typeof PatientDemographicsUpdateBodySchema>;

/** DBF column names permitted for `patient.demographics.update`. */
export const PATIENT_DEMOGRAPHICS_WRITABLE_FIELDS = [
  "FIRST_NAME",
  "LAST_NAME",
  "NAME",
  "REV_NAME",
  "CASENB",
  "ACTIVE",
  "DOCTOR_NB",
] as const;
