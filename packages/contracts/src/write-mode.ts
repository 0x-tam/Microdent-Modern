import { z } from "zod";

/** Bridge `WRITE_MODE` env — mutations are gated by this value (see phase-3 write docs). */
export const WriteModeSchema = z.enum(["disabled", "dry-run", "enabled"]);

export type WriteMode = z.infer<typeof WriteModeSchema>;

/** JSON body for non-production `GET /debug/status` (safe operator diagnostics). */
export const BridgeDevStatusResponseSchema = z.object({
  writeMode: WriteModeSchema,
  /** True only when all write gates pass; false until write routes and safety checks ship. */
  writesPermitted: z.boolean(),
  /**
   * True when `DATA_ROOT` passes the disposable sandbox marker guard and `WRITE_MODE` is not disabled.
   * Used by dev-only UI to offer sandbox apply (still plan-only until commit ships).
   */
  writableSandbox: z.boolean(),
});

export type BridgeDevStatusResponse = z.infer<typeof BridgeDevStatusResponseSchema>;

/** JSON body for `GET /v1/meta/write-capability` (same safe fields as debug status). */
export const WriteCapabilityResponseSchema = BridgeDevStatusResponseSchema;

export type WriteCapabilityResponse = BridgeDevStatusResponse;
