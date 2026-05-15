import { z } from "zod";
import { PatientProfilePathParamsSchema } from "./patient-profile.js";

const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]);

/** Path params for `GET /v1/patients/:patientId/ledger` (same id rules as profile). */
export const PatientLedgerPathParamsSchema = PatientProfilePathParamsSchema;

export type PatientLedgerPathParams = z.infer<typeof PatientLedgerPathParamsSchema>;

/** One ledger line from `TRANS.DBF` (safe fields only — no amounts or memo text). */
export const LedgerEntryV1Schema = z
  .object({
    /** `TRANS_NB` stringified. */
    ledgerEntryId: z.string().min(1),
    patientId: z.string(),
    date: isoDate,
    /** `CH_TYPE` when readable; opaque charge category code. */
    chargeTypeCode: z.number().int().nullable(),
    /** `ADJ_TYPE` when readable; opaque adjustment category code. */
    adjustmentTypeCode: z.number().int().nullable(),
    /** `PAY_TYPE` when readable; opaque payment category code. */
    paymentTypeCode: z.number().int().nullable(),
    /** `CARD` logical when readable. */
    isCardPayment: z.boolean().nullable(),
    /** True when `DESCR` memo appears populated; memo body never returned. */
    hasDescription: z.boolean(),
  })
  .strict();

export type LedgerEntryV1 = z.infer<typeof LedgerEntryV1Schema>;

export const PatientLedgerResponseSchema = z
  .object({
    patientId: z.string(),
    entries: z.array(LedgerEntryV1Schema),
    /**
     * True when more than the server cap of matching rows exist for this patient
     * (scan stopped at the cap).
     */
    truncated: z.boolean(),
    privacyNote: z.literal(
      "Ledger amounts, memo text, insurance identifiers, plan numbers, and raw TRANS rows are never exposed by this route.",
    ),
  })
  .strict();

export type PatientLedgerResponse = z.infer<typeof PatientLedgerResponseSchema>;
