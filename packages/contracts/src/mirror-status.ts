import { z } from "zod";

export const MirrorImportRunSummarySchema = z.object({
  tableName: z.string(),
  status: z.enum(["running", "success", "partial", "failed"]),
  rowCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  finishedAt: z.string(),
});

export const MirrorStatusResponseSchema = z.object({
  sqliteConfigured: z.boolean(),
  sqliteUsable: z.boolean(),
  importedTables: z.array(z.string()),
  latestImportRuns: z.array(MirrorImportRunSummarySchema),
});

export type MirrorImportRunSummary = z.infer<typeof MirrorImportRunSummarySchema>;
export type MirrorStatusResponse = z.infer<typeof MirrorStatusResponseSchema>;
