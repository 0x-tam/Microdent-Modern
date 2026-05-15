import { describe, expect, it } from "vitest";
import { mapSafeTreatmentRow, rowHasDescription } from "./treatment-field-map.js";

describe("treatment-field-map", () => {
  it("detects description presence without reading memo bodies", () => {
    expect(rowHasDescription({ DESC: "secret memo text" })).toBe(true);
    expect(rowHasDescription({ DESC: "", DESCRIPT: "also secret" })).toBe(true);
    expect(rowHasDescription({ DESC: "", DESCRIPT: null })).toBe(false);
  });

  it("maps source_deleted from the DBF deleted flag", () => {
    const procedureLookup = new Map<string, string | null>();
    const doctorLookup = new Map<string, string>();
    const row = {
      ID: 502,
      OPNUM: 50,
      TOOTHNB: 3,
      DATE: new Date(Date.UTC(2024, 0, 1)),
      STATUS: 0,
      PROCNB: "OTHER",
      DOCT: 0,
      DESC: "",
    };
    const mapped = mapSafeTreatmentRow(row, true, procedureLookup, doctorLookup);
    expect(mapped.kind).toBe("ok");
    if (mapped.kind === "ok") {
      expect(mapped.row.sourceDeleted).toBe(true);
    }
  });
});
