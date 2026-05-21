import type { PatientTreatmentItem } from "@microdent/contracts";
import { doctorDisplayLabel } from "./doctor-labels.js";
import { PATIENT_TAB_SECTION_UNDATED } from "./read-only-ui-copy.js";

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

export const TREATMENTS_UNDATED_MONTH_KEY = "undated";

export function treatmentYearFromIso(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 4);
}

export function treatmentMonthKeyFromIso(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return TREATMENTS_UNDATED_MONTH_KEY;
  return iso.slice(0, 7);
}

export function formatTreatmentMonthHeading(monthKey: string): string {
  if (monthKey === TREATMENTS_UNDATED_MONTH_KEY) return PATIENT_TAB_SECTION_UNDATED;
  try {
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
      new Date(`${monthKey}-01T12:00:00`),
    );
  } catch {
    return monthKey;
  }
}

export type TreatmentDisplayFilters = {
  year: string | null;
  provider: string | null;
  procedureCode: string | null;
};

export function treatmentYearsFromItems(items: readonly PatientTreatmentItem[]): string[] {
  const years = new Set<string>();
  for (const t of items) {
    const y = treatmentYearFromIso(t.date);
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

export function treatmentProvidersFromItems(
  items: readonly PatientTreatmentItem[],
  doctorLabels: ReadonlyMap<string, string>,
): string[] {
  const labels = new Set<string>();
  for (const t of items) {
    const label = treatmentProviderLabel(t, doctorLabels);
    if (label) labels.add(label);
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

export function treatmentProcedureCodesFromItems(items: readonly PatientTreatmentItem[]): string[] {
  const codes = new Set<string>();
  for (const t of items) {
    const code = t.procedureCode?.trim();
    if (code) codes.add(code);
  }
  return [...codes].sort((a, b) => a.localeCompare(b));
}

export function filterTreatmentsForDisplay(
  items: readonly PatientTreatmentItem[],
  filters: TreatmentDisplayFilters,
  doctorLabels: ReadonlyMap<string, string>,
): PatientTreatmentItem[] {
  return items.filter((t) => {
    if (filters.year) {
      const y = treatmentYearFromIso(t.date);
      if (y !== filters.year) return false;
    }
    if (filters.provider) {
      const label = treatmentProviderLabel(t, doctorLabels);
      if (label !== filters.provider) return false;
    }
    if (filters.procedureCode) {
      const code = t.procedureCode?.trim() ?? null;
      if (code !== filters.procedureCode) return false;
    }
    return true;
  });
}

export function treatmentsFiltersActive(filters: TreatmentDisplayFilters): boolean {
  return filters.year !== null || filters.provider !== null || filters.procedureCode !== null;
}

export type TreatmentMonthGroup = {
  monthKey: string;
  heading: string;
  items: PatientTreatmentItem[];
};

export function groupTreatmentsByMonth(items: readonly PatientTreatmentItem[]): TreatmentMonthGroup[] {
  const sorted = sortTreatmentsForDisplay(items);
  const map = new Map<string, PatientTreatmentItem[]>();
  for (const t of sorted) {
    const key = treatmentMonthKeyFromIso(t.date);
    const bucket = map.get(key) ?? [];
    bucket.push(t);
    map.set(key, bucket);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === TREATMENTS_UNDATED_MONTH_KEY) return 1;
    if (b === TREATMENTS_UNDATED_MONTH_KEY) return -1;
    return b.localeCompare(a);
  });
  return keys.map((monthKey) => ({
    monthKey,
    heading: formatTreatmentMonthHeading(monthKey),
    items: map.get(monthKey) ?? [],
  }));
}
