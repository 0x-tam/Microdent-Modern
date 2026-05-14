import { z } from "zod";

/** One row: field name → JSON-serializable cell value. */
export const TableRowSchema = z.record(z.unknown());

export const TableRowsResponseSchema = z.object({
  tableId: z.string(),
  limit: z.number().int(),
  offset: z.number().int(),
  totalRecords: z.number().int(),
  rows: z.array(TableRowSchema),
});

export type TableRowsResponse = z.infer<typeof TableRowsResponseSchema>;
