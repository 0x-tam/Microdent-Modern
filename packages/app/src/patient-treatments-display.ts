import type { PatientTreatmentItem } from "@microdent/contracts";
import { doctorDisplayLabel } from "./doctor-labels.js";

/** Sort newest first; stable tie-break on treatment id. */
export function sortTreatmentsForDisplay(items: readonly PatientTreatmentItem[]): PatientTreatmentItem[] {
  return [...items].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.treatmentId.localeCompare(a.treatmentId);
  });
}

export function treatmentToothLabel(tooth: number | null): string | null {
  if (tooth === null) return null;
  return `Tooth ${tooth}`;
}

/** Procedure code and/or chart label — never raw OPERTBL.PROCEDURE text from the row. */
export function treatmentProcedureLine(t: PatientTreatmentItem): string | null {
  const parts: string[] = [];
  if (t.procedureCode) parts.push(t.procedureCode);
  if (t.procedureLabel) parts.push(t.procedureLabel);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/** Provider from API label or reference map; opaque id fallback only when needed. */
export function treatmentProviderLabel(
  t: PatientTreatmentItem,
  doctorLabels: ReadonlyMap<string, string>,
): string | null {
  const fromApi = t.doctorLabel?.trim();
  if (fromApi) return fromApi;
  return doctorDisplayLabel(t.doctorId, doctorLabels);
}

/** Opaque legacy status code — no free-text status fields. */
export function treatmentStatusLabel(status: number | null): string | null {
  if (status === null) return null;
  return `Status ${status}`;
}

export function formatTreatmentDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso + "T12:00:00"));
  } catch {
    return iso;
  }
}
