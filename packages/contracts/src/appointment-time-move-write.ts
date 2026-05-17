import { z } from "zod";
import { PositiveIntegerIdSchema } from "./safe-write-plan.js";

export const AppointmentTimeMovePathParamsSchema = z.object({
  appointmentId: PositiveIntegerIdSchema,
});

export type AppointmentTimeMovePathParams = z.infer<typeof AppointmentTimeMovePathParamsSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const timeHm = z.string().regex(/^\d{1,2}:\d{2}$/, "time must be HH:MM");

export const AppointmentTimeMoveBodySchema = z
  .object({
    date: isoDate,
    time: timeHm,
    room: z.number().int().min(1).max(99),
    durationSlots: z.number().int().min(1).max(99).optional(),
  })
  .strict();

export type AppointmentTimeMoveBody = z.infer<typeof AppointmentTimeMoveBodySchema>;
