import { z } from "zod";

export const TableFieldSchemaSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().int(),
  decimalPlaces: z.number().int().optional(),
});

export const TableSchemaResponseSchema = z.object({
  tableId: z.string(),
  fields: z.array(TableFieldSchemaSchema),
});

export type TableSchemaResponse = z.infer<typeof TableSchemaResponseSchema>;
