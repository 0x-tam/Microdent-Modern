import { z } from "zod";

/** One known legacy Microdent table — metadata only; no row payloads. */
export const LegacyCatalogTableItemSchema = z.object({
  tableId: z.string(),
  displayName: z.string(),
  fileName: z.string(),
  /** True when the DBF basename exists under DATA_ROOT (and path resolves safely). */
  present: z.boolean(),
  /** Active record count from DBF header when the file could be opened; otherwise null. */
  recordCount: z.number().int().nullable(),
  /** Number of field definitions in the DBF header when readable; otherwise null. */
  fieldCount: z.number().int().nullable(),
});

export const LegacyCatalogResponseSchema = z.object({
  tables: z.array(LegacyCatalogTableItemSchema),
});

export type LegacyCatalogTableItem = z.infer<typeof LegacyCatalogTableItemSchema>;
export type LegacyCatalogResponse = z.infer<typeof LegacyCatalogResponseSchema>;
