import type { ScheduleAppointmentItem } from "@microdent/contracts";

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
export function patientApptRowMeta(appt: ScheduleAppointmentItem): string {
  const parts: string[] = [`Room ${appt.room}`];
  if (appt.docId !== 0) {
    parts.push(`Doctor ${appt.docId}`);
  }
  if (appt.procClass !== 0) {
    parts.push(`Proc ${appt.procClass}`);
  }
  return parts.join(" · ");
}
