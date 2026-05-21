import type { PatientChartEntry } from "@microdent/contracts";
import { describe, expect, it } from "vitest";
import {
  chartToothLabel,
  chartTreatedLabel,
  chartTypeLabel,
  filterChartEntriesForDisplay,
  groupChartEntriesByTooth,
  sortChartEntriesForDisplay,
} from "./patient-chart-display.js";

const entry = (overrides: Partial<PatientChartEntry> = {}): PatientChartEntry => ({
  chartEntryId: "14-1-1",
  patientId: "42",
  toothNumber: 14,
  chartType: 1,
  treated: true,
  hasNote: false,
  ...overrides,
});

describe("patient-chart-display", () => {
  it("sorts by tooth, type, then entry id", () => {
    const sorted = sortChartEntriesForDisplay([
      entry({ chartEntryId: "32-2-1", toothNumber: 32, chartType: 2 }),
      entry({ chartEntryId: "14-1-1", toothNumber: 14, chartType: 1 }),
      entry({ chartEntryId: "14-2-1", toothNumber: 14, chartType: 2 }),
    ]);
    expect(sorted.map((e) => e.chartEntryId)).toEqual(["14-1-1", "14-2-1", "32-2-1"]);
  });

  it("formats safe row labels", () => {
    expect(chartToothLabel(14)).toBe("Tooth 14");
    expect(chartToothLabel(null)).toBe("Tooth —");
    expect(chartTypeLabel(1)).toBe("Type 1");
    expect(chartTypeLabel(null)).toBe("Type —");
    expect(chartTreatedLabel(true)).toBe("Treated");
    expect(chartTreatedLabel(false)).toBe("Not treated");
  });

  it("filters to treated entries only", () => {
    const items = [
      entry({ chartEntryId: "a", treated: true }),
      entry({ chartEntryId: "b", treated: false }),
    ];
    expect(filterChartEntriesForDisplay(items, "treated").map((e) => e.chartEntryId)).toEqual(["a"]);
    expect(filterChartEntriesForDisplay(items, "all")).toHaveLength(2);
  });

  it("groups entries by tooth with counts", () => {
    const groups = groupChartEntriesByTooth([
      entry({ chartEntryId: "14-1", toothNumber: 14 }),
      entry({ chartEntryId: "14-2", toothNumber: 14 }),
      entry({ chartEntryId: "32-1", toothNumber: 32 }),
    ]);
    expect(groups.map((g) => g.toothKey)).toEqual(["14", "32"]);
    expect(groups[0]?.entries).toHaveLength(2);
    expect(groups[0]?.toothLabel).toBe("Tooth 14");
  });

  it("uses safe filter and group labels without forbidden tokens", () => {
    const labels = [
      chartToothLabel(14),
      chartTypeLabel(1),
      chartTreatedLabel(true),
      chartTreatedLabel(false),
    ];
    for (const label of labels) {
      expect(label).not.toMatch(/\bPAT_NAME\b|\bNOTE\b|\bAMOUNT\b|\brawRow\b/i);
    }
  });
});
