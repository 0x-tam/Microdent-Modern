import type { ScheduleAppointmentItem } from "@microdent/contracts";
import { doctorDisplayLabel } from "./doctor-labels.js";
import { procClassDisplayLabel, type ProcedureReferenceMaps } from "./procedure-reference.js";
import { toLocalIsoDate } from "./patient-appointments-range.js";

/** Status codes exposed as patient appointment history filters (excludes open-slot code 0). */
export const PATIENT_APPT_FILTER_STATUS_CODES = [1, 2, 3, 4, 5] as const;

export type PatientApptFilterStatusCode = (typeof PATIENT_APPT_FILTER_STATUS_CODES)[number];

export type PatientApptTimeDirection = "all" | "past" | "upcoming";

export function patientApptStatusLabel(code: number): string {
  const map: Record<number, string> = {
    0: "Available",
    1: "Scheduled",
    2: "Confirmed",
    3: "Completed",
    4: "Cancelled",
    5: "No-show",
  };
  return map[code] ?? `Status ${code}`;
}

export function patientApptStatusBadgeVariant(
  code: number,
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (code === 2 || code === 3) return "success";
  if (code === 4) return "warning";
  if (code === 5) return "danger";
  if (code === 1) return "info";
  return "neutral";
}

export function patientApptFormatDuration(a: ScheduleAppointmentItem): string {
  const slotMin = a.periodMinutes ?? 30;
  const total = a.durationSlots * slotMin;
  return `${total} min`;
}

/** Safe appointment row text for profile history — no patient names from schedule rows. */
/** Preferred order for status mix summaries (scheduled → no-show). */
const APPT_STATUS_MIX_ORDER = [1, 2, 3, 4, 5, 0] as const;

export function countAppointmentsByStatus(
  appointments: readonly ScheduleAppointmentItem[],
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const appt of appointments) {
    counts.set(appt.status, (counts.get(appt.status) ?? 0) + 1);
  }
  return counts;
}

/** Safe status mix line, e.g. "2 scheduled · 1 completed". */
export function formatAppointmentStatusMix(
  appointments: readonly ScheduleAppointmentItem[],
): string {
  const counts = countAppointmentsByStatus(appointments);
  const parts: string[] = [];
  for (const code of APPT_STATUS_MIX_ORDER) {
    const n = counts.get(code);
    if (n !== undefined && n > 0) {
      parts.push(`${n} ${patientApptStatusLabel(code).toLowerCase()}`);
    }
  }
  for (const [code, n] of counts) {
    if (!APPT_STATUS_MIX_ORDER.includes(code as (typeof APPT_STATUS_MIX_ORDER)[number]) && n > 0) {
      parts.push(`${n} ${patientApptStatusLabel(code).toLowerCase()}`);
    }
  }
  return parts.join(" · ");
}

export function patientApptRowMeta(
  appt: ScheduleAppointmentItem,
  doctorLabels: ReadonlyMap<string, string> = new Map(),
  procedureMaps?: ProcedureReferenceMaps,
): string {
  const parts: string[] = [`Room ${appt.room}`];
  const doctor = doctorDisplayLabel(appt.docId, doctorLabels);
  if (doctor !== null) {
    parts.push(doctor);
  }
  const proc = procClassDisplayLabel(appt.procClass, procedureMaps);
  if (proc !== null) {
    parts.push(proc);
  }
  return parts.join(" · ");
}

function currentLocalTimeHm(ref = new Date()): string {
  return `${String(ref.getHours()).padStart(2, "0")}:${String(ref.getMinutes()).padStart(2, "0")}`;
}

/** Compare appointment date/time to today for past vs upcoming client filters. */
export function comparePatientApptToNow(
  appt: ScheduleAppointmentItem,
  ref = new Date(),
): -1 | 0 | 1 {
  const todayIso = toLocalIsoDate(ref);
  if (appt.date < todayIso) return -1;
  if (appt.date > todayIso) return 1;
  const nowHm = currentLocalTimeHm(ref);
  if (appt.time < nowHm) return -1;
  if (appt.time > nowHm) return 1;
  return 0;
}

export function patientApptUniqueRooms(appointments: readonly ScheduleAppointmentItem[]): number[] {
  const rooms = new Set<number>();
  for (const a of appointments) {
    rooms.add(a.room);
  }
  return [...rooms].sort((a, b) => a - b);
}

export function filterPatientAppointments(
  appointments: readonly ScheduleAppointmentItem[],
  options: {
    timeDirection?: PatientApptTimeDirection;
    statusFilter?: number | null;
    roomFilter?: number | null;
    ref?: Date;
  } = {},
): ScheduleAppointmentItem[] {
  const { timeDirection = "all", statusFilter = null, roomFilter = null, ref = new Date() } = options;
  return appointments.filter((appt) => {
    if (statusFilter !== null && appt.status !== statusFilter) {
      return false;
    }
    if (roomFilter !== null && appt.room !== roomFilter) {
      return false;
    }
    if (timeDirection === "all") {
      return true;
    }
    const cmp = comparePatientApptToNow(appt, ref);
    if (timeDirection === "past") {
      return cmp < 0;
    }
    return cmp > 0;
  });
}

export function patientApptRangeCountLabel(count: number): string {
  if (count === 1) {
    return "1 appointment in range";
  }
  return `${count} appointments in range`;
}

/** First future (or later-today) appointment in a loaded range, for summary mini-cards. */
export function findNextUpcomingPatientAppointment(
  appointments: readonly ScheduleAppointmentItem[],
  ref = new Date(),
): ScheduleAppointmentItem | null {
  const sorted = [...appointments].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  );
  for (const appt of sorted) {
    if (comparePatientApptToNow(appt, ref) >= 0) {
      return appt;
    }
  }
  return null;
}

export function formatPatientApptNextUpcoming(appt: ScheduleAppointmentItem): string {
  try {
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(appt.date + "T12:00:00"));
    return `Next: ${dateLabel} · ${appt.time}`;
  } catch {
    return `Next: ${appt.date} · ${appt.time}`;
  }
}
