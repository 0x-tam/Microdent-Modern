import { z } from "zod";
import { PositiveIntegerIdSchema } from "./safe-write-plan.js";

/** Path params for `PATCH /v1/schedule/appointments/:appointmentId/status`. */
export const AppointmentStatusPathParamsSchema = z.object({
  appointmentId: PositiveIntegerIdSchema,
});

export type AppointmentStatusPathParams = z.infer<typeof AppointmentStatusPathParamsSchema>;

/** Allowed legacy `STATUS` codes for the first write band (opaque integers). */
export const APPOINTMENT_STATUS_MIN = 0;
export const APPOINTMENT_STATUS_MAX = 5;

/** Body for `PATCH /v1/schedule/appointments/:appointmentId/status`. */
export const AppointmentStatusUpdateBodySchema = z
  .object({
    status: z
      .number()
      .int("status must be an integer")
      .min(APPOINTMENT_STATUS_MIN, `status must be between ${APPOINTMENT_STATUS_MIN} and ${APPOINTMENT_STATUS_MAX}`)
      .max(APPOINTMENT_STATUS_MAX, `status must be between ${APPOINTMENT_STATUS_MIN} and ${APPOINTMENT_STATUS_MAX}`),
  })
  .strict();

export type AppointmentStatusUpdateBody = z.infer<typeof AppointmentStatusUpdateBodySchema>;
