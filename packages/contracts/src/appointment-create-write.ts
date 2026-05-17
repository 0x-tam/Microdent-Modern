import { z } from "zod";
import { PositiveIntegerIdSchema } from "./safe-write-plan.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const timeHm = z.string().regex(/^\d{1,2}:\d{2}$/, "time must be HH:MM");

export const AppointmentCreateBodySchema = z
  .object({
    date: isoDate,
    time: timeHm,
    room: z.number().int().min(1).max(99),
    durationSlots: z.number().int().min(1).max(99).default(1),
    patId: PositiveIntegerIdSchema,
    docId: z.number().int().min(0).max(99999).optional(),
    procClass: z.number().int().min(0).max(99).optional(),
    periodMinutes: z.number().int().min(1).max(120).optional(),
    status: z.number().int().min(0).max(5).optional(),
  })
  .strict();

export type AppointmentCreateBody = z.infer<typeof AppointmentCreateBodySchema>;
