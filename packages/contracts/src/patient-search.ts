import { z } from "zod";

/** Query string for `GET /v1/patients/search` (validated server-side). */
export const PatientSearchQueryParamsSchema = z.object({
  q: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2, "q must be at least 2 characters").max(100, "q is too long")),
});

export type PatientSearchQueryParams = z.infer<typeof PatientSearchQueryParamsSchema>;

/** One patient search hit — safe subset only; no raw DBF row. */
export const PatientSearchResultItemSchema = z.object({
  /** Numeric internal id from `PATIENT.DBF` `ID` (stringified for JSON). */
  patientId: z.string(),
  /** Chart / case number from `CASENB` when present. */
  chartNumber: z.string().nullable(),
  /** Primary display string derived from `NAME` or `FIRST_NAME` + `LAST_NAME`. */
  displayName: z.string(),
  /** Masked phone hint from `HOME_PHONE` or `MOBILE` (last digits only); never full number. */
  phoneMask: z.string().nullable(),
});

export type PatientSearchResultItem = z.infer<typeof PatientSearchResultItemSchema>;

export const PatientSearchResponseSchema = z.object({
  /** At most 20 items (server-enforced cap). */
  results: z.array(PatientSearchResultItemSchema).max(20),
});

export type PatientSearchResponse = z.infer<typeof PatientSearchResponseSchema>;
