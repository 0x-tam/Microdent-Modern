import { z } from "zod";

export const OfflineLicenseRuntimeStatusSchema = z.enum([
  "not-configured",
  "missing",
  "valid",
  "expired",
  "invalid",
  "signature-unverified",
]);

export const OfflineLicenseTierSchema = z.enum([
  "read-only-free",
  "sandbox-pro",
  "clinic-enterprise",
]);

export const OfflineLicenseFeaturesSchema = z.object({
  readOnly: z.boolean(),
  sandboxWrites: z.boolean(),
  localCopyRefresh: z.boolean(),
  supportExport: z.boolean(),
});

export const OfflineLicenseStatusResponseSchema = z.object({
  status: OfflineLicenseRuntimeStatusSchema,
  configured: z.boolean(),
  licensePresent: z.boolean(),
  signatureVerified: z.boolean(),
  clinicLabel: z.string().nullable(),
  tier: OfflineLicenseTierSchema.nullable(),
  expiresAt: z.string().nullable(),
  graceUntil: z.string().nullable(),
  features: OfflineLicenseFeaturesSchema,
  message: z.string(),
});

export type OfflineLicenseRuntimeStatus = z.infer<typeof OfflineLicenseRuntimeStatusSchema>;
export type OfflineLicenseTier = z.infer<typeof OfflineLicenseTierSchema>;
export type OfflineLicenseFeatures = z.infer<typeof OfflineLicenseFeaturesSchema>;
export type OfflineLicenseStatusResponse = z.infer<typeof OfflineLicenseStatusResponseSchema>;
