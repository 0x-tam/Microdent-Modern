import { z } from "zod";

/** Query string for `GET /v1/patients/search` (validated server-side). */
export const PatientSearchQueryParamsSchema = z.object({
  q: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2, "q must be at least 2 characters").max(100, "q is too long")),
});

export type PatientSearchQueryParams = z.infer<typeof PatientSearchQueryParamsSchema>;

const PHONE_MASK_RE = /^\u2026\d{4}$/;

function trimStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizePatientIdValue(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "bigint") return String(v);
  const s = trimStr(v);
  return s.length > 0 ? s : "0";
}

function normalizeNullableChart(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const s = String(Math.trunc(v));
    return s.length > 0 ? s : null;
  }
  const s = trimStr(v);
  return s.length > 0 ? s : null;
}

function normalizeDisplayNameValue(v: unknown): string {
  const s = trimStr(v);
  return s.length > 0 ? s : "Patient";
}

/** Accepts only canonical `…dddd` masks; drops anything else (never forwards full numbers). */
function normalizePhoneMaskValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = trimStr(v);
  if (s.length === 0) return null;
  if (PHONE_MASK_RE.test(s)) return s;
  return null;
}

/** Safe patient summary (search hit + profile core) — no raw DBF row, no memos, no full phone. */
export const SafePatientSummarySchema = z.object({
  /** Numeric internal id from `PATIENT.DBF` `ID` (stringified for JSON). */
  patientId: z.string(),
  /** Chart / case number from `CASENB` when present. */
  chartNumber: z.string().nullable(),
  /** Primary display string derived from `NAME` or `FIRST_NAME` + `LAST_NAME`. */
  displayName: z.string().min(1),
  /** Masked phone hint from `HOME_PHONE` or `MOBILE` (last digits only); never full number. */
  phoneMask: z.string().nullable(),
});

export type SafePatientSummary = z.infer<typeof SafePatientSummarySchema>;

/**
 * Wire-level parser for one search hit: accepts legacy JSON quirks (numeric ids, omitted nullables)
 * and yields a strict {@link SafePatientSummary}. Rejects unknown keys on each item.
 */
export const PatientSearchResultItemSchema = z
  .object({
    patientId: z.unknown(),
    chartNumber: z.unknown().optional(),
    displayName: z.unknown(),
    phoneMask: z.unknown().optional(),
  })
  .strict()
  .transform(
    (raw): SafePatientSummary => ({
      patientId: normalizePatientIdValue(raw.patientId),
      chartNumber: normalizeNullableChart(raw.chartNumber),
      displayName: normalizeDisplayNameValue(raw.displayName),
      phoneMask: normalizePhoneMaskValue(raw.phoneMask),
    }),
  )
  .pipe(SafePatientSummarySchema);

export type PatientSearchResultItem = z.output<typeof PatientSearchResultItemSchema>;

export const PatientSearchResponseSchema = z.object({
  /** At most 20 items (server-enforced cap). */
  results: z.array(PatientSearchResultItemSchema).max(20),
});

export type PatientSearchResponse = {
  results: PatientSearchResultItem[];
};

/** Canonicalize a search hit before JSON serialization (idempotent for already-valid rows). */
export function normalizePatientSearchResultItemForWire(raw: unknown): PatientSearchResultItem {
  return PatientSearchResultItemSchema.parse(raw);
}
