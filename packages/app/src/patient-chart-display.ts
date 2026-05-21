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

export type ChartTreatedFilter = "all" | "treated";

export function filterChartEntriesForDisplay(
  items: readonly PatientChartEntry[],
  treatedFilter: ChartTreatedFilter,
): PatientChartEntry[] {
  if (treatedFilter === "all") return [...items];
  return items.filter((e) => e.treated);
}

export type ChartToothGroup = {
  toothKey: string;
  toothLabel: string;
  entries: PatientChartEntry[];
};

export function chartToothGroupKey(toothNumber: number | null): string {
  if (toothNumber === null) return "unknown";
  return String(toothNumber);
}

export function groupChartEntriesByTooth(items: readonly PatientChartEntry[]): ChartToothGroup[] {
  const sorted = sortChartEntriesForDisplay(items);
  const map = new Map<string, PatientChartEntry[]>();
  for (const e of sorted) {
    const key = chartToothGroupKey(e.toothNumber);
    const bucket = map.get(key) ?? [];
    bucket.push(e);
    map.set(key, bucket);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return keys.map((toothKey) => {
    const sample = map.get(toothKey)?.[0];
    const label =
      toothKey === "unknown" ? chartToothLabel(null) : chartToothLabel(sample?.toothNumber ?? Number(toothKey));
    return {
      toothKey,
      toothLabel: label,
      entries: map.get(toothKey) ?? [],
    };
  });
}
