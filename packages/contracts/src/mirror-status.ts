import { z } from "zod";

export const MirrorImportRunSummarySchema = z.object({
  tableName: z.string(),
  status: z.enum(["running", "success", "partial", "failed"]),
  rowCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  finishedAt: z.string(),
});

export const MirrorSourceFileStatusSchema = z.object({
  sourceFile: z.string(),
  status: z.enum(["unchanged", "changed", "missing", "unreadable", "unknown"]),
  importedSizeBytes: z.number().int().nonnegative().nullable(),
  importedMtimeMs: z.number().nonnegative().nullable(),
  currentSizeBytes: z.number().int().nonnegative().nullable(),
  currentMtimeMs: z.number().nonnegative().nullable(),
});

export const MirrorSourceTableStatusSchema = z.object({
  tableName: z.string(),
  status: z.enum(["unchanged", "changed", "missing", "unreadable", "unknown"]),
  checkedAt: z.string(),
  sourceFiles: z.array(MirrorSourceFileStatusSchema),
});

export const MirrorStatusResponseSchema = z.object({
  sqliteConfigured: z.boolean(),
  sqliteUsable: z.boolean(),
  importedTables: z.array(z.string()),
  latestImportRuns: z.array(MirrorImportRunSummarySchema),
  sourceChangedSinceImport: z.boolean().optional(),
  sourceFileStatuses: z.array(MirrorSourceTableStatusSchema).optional(),
});

export type MirrorImportRunSummary = z.infer<typeof MirrorImportRunSummarySchema>;
export type MirrorSourceFileStatus = z.infer<typeof MirrorSourceFileStatusSchema>;
export type MirrorSourceTableStatus = z.infer<typeof MirrorSourceTableStatusSchema>;
export type MirrorStatusResponse = z.infer<typeof MirrorStatusResponseSchema>;
