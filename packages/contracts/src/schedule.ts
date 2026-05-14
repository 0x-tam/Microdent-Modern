import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "invalid calendar date");

/** One room row from SC_ROOM (+ optional DICSCHED label). */
export const ScheduleRoomActiveDaysSchema = z.object({
  sunday: z.boolean(),
  monday: z.boolean(),
  tuesday: z.boolean(),
  wednesday: z.boolean(),
  thursday: z.boolean(),
  friday: z.boolean(),
  saturday: z.boolean(),
});

export type ScheduleRoomActiveDays = z.infer<typeof ScheduleRoomActiveDaysSchema>;

export const ScheduleRoomItemSchema = z.object({
  /** Room index (matches SCHEDULE.ROOM). */
  room: z.number().int(),
  /** Trimmed label from DICSCHED `ROOM{n}` when present; not patient content. */
  displayName: z.string().nullable(),
  /** SC_ROOM DAY1…DAY7 mapped Sunday→Saturday (see phase-1b-calendar-mapping). */
  activeDays: ScheduleRoomActiveDaysSchema,
  /** SC_ROOM DOCT when non-zero; otherwise null. */
  doctorId: z.number().int().nullable(),
});

export type ScheduleRoomItem = z.infer<typeof ScheduleRoomItemSchema>;

export const ScheduleRoomsResponseSchema = z.object({
  rooms: z.array(ScheduleRoomItemSchema),
});

export type ScheduleRoomsResponse = z.infer<typeof ScheduleRoomsResponseSchema>;

/**
 * Safe patient summary attached to a schedule row — resolved from PATIENT.DBF only.
 * No phone mask here; schedule responses never include masked phone hints.
 */
function wirePatientId(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "bigint") return String(v);
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.length > 0 ? s : "0";
}

function wireChartNumber(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const s = String(Math.trunc(v));
    return s.length > 0 ? s : null;
  }
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function wireDisplayName(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.length > 0 ? s : "Patient";
}

export const ScheduleAppointmentPatientSummarySchema = z.preprocess(
  (raw) => {
    if (raw === null || raw === undefined || typeof raw !== "object") {
      return raw;
    }
    const o = raw as Record<string, unknown>;
    return {
      patientId: wirePatientId(o.patientId),
      displayName: wireDisplayName(o.displayName),
      chartNumber: wireChartNumber(o.chartNumber),
    };
  },
  z.object({
    patientId: z.string(),
    displayName: z.string().min(1),
    chartNumber: z.string().nullable(),
  }),
);

export type ScheduleAppointmentPatientSummary = z.infer<typeof ScheduleAppointmentPatientSummarySchema>;

/** One appointment — safe subset only; no PAT_NAME, TELEPHONE, COMMENT body, or raw row. */
export const ScheduleAppointmentItemSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Start time as stored in SCHEDULE.TIME (trimmed character field). */
  time: z.string(),
  durationSlots: z.number().int(),
  /** Minutes per slot from PERIOD; null if zero/missing (clients may assume 30 per product notes). */
  periodMinutes: z.number().int().nullable(),
  room: z.number().int(),
  status: z.number().int(),
  docId: z.number().int(),
  patId: z.string(),
  /**
   * Resolved from PATIENT.DBF by patId when the file exists and a row matches.
   * `null` when patId is zero, lookup misses, or PATIENT.DBF is absent — never from SCHEDULE.PAT_NAME.
   */
  patient: ScheduleAppointmentPatientSummarySchema.nullable(),
  procClass: z.number().int(),
  vacId: z.number().int(),
  recall: z.number().int(),
  unreason: z.number().int(),
  missed: z.boolean(),
  hasComment: z.boolean(),
});

export type ScheduleAppointmentItem = z.infer<typeof ScheduleAppointmentItemSchema>;

export const ScheduleAppointmentsResponseSchema = z.object({
  appointments: z.array(ScheduleAppointmentItemSchema).max(1000),
});

export type ScheduleAppointmentsResponse = z.infer<typeof ScheduleAppointmentsResponseSchema>;

const MAX_INCLUSIVE_DAY_SPAN = 14;

function parseUtcDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function inclusiveDaySpan(from: string, to: string): number {
  const a = parseUtcDateOnly(from).getTime();
  const b = parseUtcDateOnly(to).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** Query string for `GET /v1/schedule/appointments` (from/to; optional `room` as digits-only string). */
export const ScheduleAppointmentsQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    room: z
      .string()
      .optional()
      .refine((s) => s === undefined || s.trim() === "" || /^\d+$/.test(s.trim()), {
        message: "room must be a non-negative integer",
      })
      .transform((s) => {
        if (s === undefined || s.trim() === "") return undefined;
        return Number.parseInt(s.trim(), 10);
      }),
  })
  .superRefine((q, ctx) => {
    const df = parseUtcDateOnly(q.from).getTime();
    const dt = parseUtcDateOnly(q.to).getTime();
    if (df > dt) {
      ctx.addIssue({ code: "custom", message: "from must be on or before to", path: ["from"] });
      return;
    }
    const span = inclusiveDaySpan(q.from, q.to);
    if (span > MAX_INCLUSIVE_DAY_SPAN) {
      ctx.addIssue({
        code: "custom",
        message: `date range must be at most ${MAX_INCLUSIVE_DAY_SPAN} calendar days inclusive`,
        path: ["to"],
      });
    }
  });

export type ScheduleAppointmentsQuery = z.infer<typeof ScheduleAppointmentsQuerySchema>;
