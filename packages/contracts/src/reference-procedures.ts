import { z } from "zod";

/** One procedure dictionary row from PROCCHRT.DBF (safe fields only). */
export const ReferenceProcedureItemSchema = z.object({
  /** Trimmed `PROCNB` — join key for `OPERTBL.PROCNB` after normalization. */
  procedureCode: z.string().min(1),
  /** Trimmed `PROCEDURE` label when present. */
  displayName: z.string().nullable(),
  /** Trimmed `CLASS` when present (procedure class / category text). */
  category: z.string().nullable(),
  /** Trimmed legacy `CATAGORY` column when present. */
  categoryCode: z.string().nullable(),
  /** `CLASS_ID` when non-zero; otherwise null. */
  classId: z.number().int().nullable(),
  /** `CHART` logical — dictionary row is chart-relevant. */
  chartRelevant: z.boolean(),
});

export type ReferenceProcedureItem = z.infer<typeof ReferenceProcedureItemSchema>;

export const ReferenceProceduresResponseSchema = z.object({
  procedures: z.array(ReferenceProcedureItemSchema),
});

export type ReferenceProceduresResponse = z.infer<typeof ReferenceProceduresResponseSchema>;
