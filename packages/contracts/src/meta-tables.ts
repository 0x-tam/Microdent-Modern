import { z } from "zod";

export const TableListItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  fileName: z.string(),
});

export const TablesListResponseSchema = z.object({
  tables: z.array(TableListItemSchema),
});

export type TablesListResponse = z.infer<typeof TablesListResponseSchema>;
