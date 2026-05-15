import type { PatientChartEntry } from "@microdent/contracts";
import { describe, expect, it } from "vitest";
import {
  chartToothLabel,
  chartTreatedLabel,
  chartTypeLabel,
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
});
