import { z } from "zod";

/** Bridge `WRITE_MODE` env — mutations are gated by this value (see phase-3 write docs). */
export const WriteModeSchema = z.enum(["disabled", "dry-run", "enabled"]);

export type WriteMode = z.infer<typeof WriteModeSchema>;

/** JSON body for non-production `GET /debug/status` (safe operator diagnostics). */
export const BridgeDevStatusResponseSchema = z.object({
  writeMode: WriteModeSchema,
  /** True only when all write gates pass; false until write routes and safety checks ship. */
  writesPermitted: z.boolean(),
});

export type BridgeDevStatusResponse = z.infer<typeof BridgeDevStatusResponseSchema>;
