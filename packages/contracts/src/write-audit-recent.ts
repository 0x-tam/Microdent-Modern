import { z } from "zod";

export const WriteAuditRecentEntrySchema = z.object({
  operationId: z.string(),
  workflow: z.string(),
  terminalStatus: z
    .enum(["success", "partial", "failed", "restored", "cancelled"])
    .nullable(),
  requestedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const WriteAuditRecentResponseSchema = z.object({
  sqliteConfigured: z.boolean(),
  sqliteUsable: z.boolean(),
  entries: z.array(WriteAuditRecentEntrySchema),
});

export type WriteAuditRecentEntry = z.infer<typeof WriteAuditRecentEntrySchema>;
export type WriteAuditRecentResponse = z.infer<typeof WriteAuditRecentResponseSchema>;
