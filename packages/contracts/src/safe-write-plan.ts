import { z } from "zod";
import { WriteModeSchema } from "./write-mode.js";

/** Positive integer id without leading zeros (legacy keys on write routes). */
export const PositiveIntegerIdSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,14}$/, "id must be a positive integer without leading zeros");

export type PositiveIntegerId = z.infer<typeof PositiveIntegerIdSchema>;

/** One field-level change in a safe write plan (no before/after values). */
export const SafeWritePlanFieldChangeSchema = z
  .object({
    table: z.string().min(1),
    recordId: z.string().min(1),
    field: z.string().min(1),
    changeType: z.enum(["set", "clear"]),
  })
  .strict();

export type SafeWritePlanFieldChange = z.infer<typeof SafeWritePlanFieldChangeSchema>;

/** Operator-safe warning attached to a write plan. */
export const SafeWritePlanWarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    severity: z.enum(["info", "warn", "block"]),
  })
  .strict();

export type SafeWritePlanWarning = z.infer<typeof SafeWritePlanWarningSchema>;

/**
 * Safe DTO for dry-run and post-validation write responses.
 * Describes what would change — never row values, memos, PHI, or amounts.
 */
export const SafeWritePlanSchema = z
  .object({
    operationId: z.string().uuid(),
    workflow: z.string().min(1),
    mode: WriteModeSchema,
    tablesAffected: z.array(z.string().min(1)),
    recordIds: z.array(z.string().min(1)),
    fieldsChanged: z.array(SafeWritePlanFieldChangeSchema),
    backupRequired: z.boolean(),
    backupWouldCreate: z.boolean().optional(),
    warnings: z.array(SafeWritePlanWarningSchema),
    committed: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type SafeWritePlan = z.infer<typeof SafeWritePlanSchema>;

/** Response body for appointment status mutation in dry-run mode. */
export const AppointmentStatusDryRunResponseSchema = z
  .object({
    plan: SafeWritePlanSchema,
    committed: z.literal(false),
  })
  .strict();

export type AppointmentStatusDryRunResponse = z.infer<typeof AppointmentStatusDryRunResponseSchema>;
