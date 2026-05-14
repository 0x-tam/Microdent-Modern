import { z } from "zod";

/** JSON body for `GET /health` (bridge and clients share this contract). */
export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
