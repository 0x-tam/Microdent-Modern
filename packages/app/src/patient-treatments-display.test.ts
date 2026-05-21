import { describe, expect, it } from "vitest";
import type { PatientTreatmentItem } from "@microdent/contracts";
import {
  filterTreatmentsForDisplay,
  formatTreatmentDate,
  formatTreatmentMonthHeading,
  groupTreatmentsByMonth,
  sortTreatmentsForDisplay,
  treatmentProcedureCodesFromItems,
  treatmentProcedureLine,
  treatmentProviderLabel,
  treatmentStatusLabel,
  treatmentToothLabel,
  treatmentYearsFromItems,
  treatmentsFiltersActive,
} from "./patient-treatments-display.js";

const base: PatientTreatmentItem = {
  treatmentId: "1",
  patientId: "42",
  date: "2024-01-01",
  tooth: null,
  procedureCode: null,
  procedureLabel: null,
  doctorId: null,
  doctorLabel: null,
  status: null,
  hasDescription: false,
};

describe("patient-treatments-display", () => {
  it("sorts by date descending then treatment id", () => {
    const items: PatientTreatmentItem[] = [
      { ...base, treatmentId: "a", date: "2023-01-01" },
      { ...base, treatmentId: "b", date: "2024-06-01" },
      { ...base, treatmentId: "c", date: null },
    ];
    const sorted = sortTreatmentsForDisplay(items);
    expect(sorted.map((t) => t.treatmentId)).toEqual(["b", "a", "c"]);
  });

  it("builds procedure line from code and label", () => {
    expect(treatmentProcedureLine({ ...base, procedureCode: "SYN01", procedureLabel: "Synthetic label" })).toBe(
      "SYN01 · Synthetic label",
    );
    expect(treatmentProcedureLine({ ...base, procedureCode: "X" })).toBe("X");
  });

  it("prefers API doctor label over reference map", () => {
    const labels = new Map([["3", "Reference name"]]);
    expect(
      treatmentProviderLabel({ ...base, doctorId: "3", doctorLabel: "Api name" }, labels),
    ).toBe("Api name");
    expect(treatmentProviderLabel({ ...base, doctorId: "3", doctorLabel: null }, labels)).toBe("Reference name");
    expect(treatmentProviderLabel({ ...base, doctorId: "9", doctorLabel: null }, labels)).toBe("Doctor 9");
  });

  it("formats tooth and status as opaque labels", () => {
    expect(treatmentToothLabel(14)).toBe("Tooth 14");
    expect(treatmentToothLabel(null)).toBeNull();
    expect(treatmentStatusLabel(2)).toBe("Status 2");
    expect(treatmentStatusLabel(null)).toBeNull();
  });

  it("formats ISO dates for display", () => {
    expect(formatTreatmentDate("2024-06-01")).toMatch(/2024/);
    expect(formatTreatmentDate(null)).toBeNull();
  });

  it("groups treatments by month with undated bucket last", () => {
    const groups = groupTreatmentsByMonth([
      { ...base, treatmentId: "1", date: "2024-06-15" },
      { ...base, treatmentId: "2", date: "2024-01-10" },
      { ...base, treatmentId: "3", date: null },
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(["2024-06", "2024-01", "undated"]);
    expect(formatTreatmentMonthHeading("2024-06")).toMatch(/2024/);
  });

  it("filters by year, provider, and procedure code", () => {
    const labels = new Map<string, string>();
    const items: PatientTreatmentItem[] = [
      { ...base, treatmentId: "1", date: "2024-06-01", procedureCode: "A", doctorLabel: "Dr A" },
      { ...base, treatmentId: "2", date: "2023-06-01", procedureCode: "B", doctorLabel: "Dr B" },
    ];
    expect(treatmentYearsFromItems(items)).toEqual(["2024", "2023"]);
    expect(treatmentProcedureCodesFromItems(items)).toEqual(["A", "B"]);
    const filtered = filterTreatmentsForDisplay(
      items,
      { year: "2024", provider: "Dr A", procedureCode: "A" },
      labels,
    );
    expect(filtered.map((t) => t.treatmentId)).toEqual(["1"]);
    expect(
      treatmentsFiltersActive({ year: null, provider: null, procedureCode: null }),
    ).toBe(false);
    expect(
      treatmentsFiltersActive({ year: "2024", provider: null, procedureCode: null }),
    ).toBe(true);
  });

  it("uses safe filter labels without forbidden DBF field tokens", () => {
    const labels = treatmentYearsFromItems([base]).concat(
      treatmentProcedureCodesFromItems([base]),
    );
    for (const label of labels) {
      expect(label).not.toMatch(/\bPAT_NAME\b|\bTELEPHONE\b|\bAMOUNT\b|\bSAMOUNT\b/i);
    }
    expect(treatmentProviderLabel({ ...base, doctorLabel: "Synthetic Provider" }, new Map())).not.toMatch(
      /\bCOMMENT\b|\bNOTE\b/i,
    );
  });
});
