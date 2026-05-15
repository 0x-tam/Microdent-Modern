import type { PatientChartEntry } from "@microdent/contracts";

/** Sort by tooth number, then chart type; stable tie-break on entry id. */
export function sortChartEntriesForDisplay(items: readonly PatientChartEntry[]): PatientChartEntry[] {
  return [...items].sort((a, b) => {
    const ta = a.toothNumber ?? -1;
    const tb = b.toothNumber ?? -1;
    if (ta !== tb) return ta - tb;
    const ca = a.chartType ?? -1;
    const cb = b.chartType ?? -1;
    if (ca !== cb) return ca - cb;
    return a.chartEntryId.localeCompare(b.chartEntryId);
  });
}

export function chartToothLabel(toothNumber: number | null): string {
  if (toothNumber === null) return "Tooth —";
  return `Tooth ${toothNumber}`;
}

/** Opaque legacy chart variant code — no decoded clinical labels. */
export function chartTypeLabel(chartType: number | null): string {
  if (chartType === null) return "Type —";
  return `Type ${chartType}`;
}

export function chartTreatedLabel(treated: boolean): string {
  return treated ? "Treated" : "Not treated";
}
