import { describe, expect, it } from "vitest";
import {
  buildProcedureReferenceMaps,
  normalizeProcedureCode,
  procClassDisplayLabel,
} from "./procedure-reference.js";

const syntheticProcedures = [
  {
    procedureCode: "SYN01",
    displayName: "Synthetic procedure label alpha",
    category: "Synthetic category A",
    categoryCode: null,
    classId: 101,
    chartRelevant: true,
  },
  {
    procedureCode: "SYN02",
    displayName: "Synthetic procedure label beta",
    category: "Synthetic category B",
    categoryCode: null,
    classId: 101,
    chartRelevant: false,
  },
  {
    procedureCode: "000003",
    displayName: "Synthetic padded code label",
    category: null,
    categoryCode: null,
    classId: null,
    chartRelevant: true,
  },
  {
    procedureCode: "SYN04",
    displayName: null,
    category: "Synthetic category only",
    categoryCode: null,
    classId: 44,
    chartRelevant: false,
  },
] as const;

describe("normalizeProcedureCode", () => {
  it("trims procedure codes", () => {
    expect(normalizeProcedureCode("  SYN01  ")).toBe("SYN01");
  });
});

describe("buildProcedureReferenceMaps", () => {
  it("indexes by procedureCode and classId without fee fields", () => {
    const maps = buildProcedureReferenceMaps([...syntheticProcedures]);
    expect(maps.byProcedureCode.get("SYN01")?.displayName).toBe("Synthetic procedure label alpha");
    expect(maps.byClassId.get(101)?.length).toBe(2);
    const entry = maps.byProcedureCode.get("SYN01");
    expect(entry).toBeDefined();
    expect(entry).not.toHaveProperty("price");
    expect(entry).not.toHaveProperty("PRICE1");
    expect(entry).not.toHaveProperty("PER_PROF");
  });
});

describe("procClassDisplayLabel", () => {
  const maps = buildProcedureReferenceMaps([...syntheticProcedures]);

  it("returns null for procClass zero", () => {
    expect(procClassDisplayLabel(0, maps)).toBeNull();
  });

  it("uses displayName when classId matches procClass unambiguously via category", () => {
    expect(procClassDisplayLabel(44, maps)).toBe("Synthetic category only");
  });

  it("falls back when classId matches multiple conflicting display names", () => {
    expect(procClassDisplayLabel(101, maps)).toBe("Procedure class 101");
  });

  it("uses displayName when procedureCode matches procClass (padded)", () => {
    expect(procClassDisplayLabel(3, maps)).toBe("Synthetic padded code label");
  });

  it("falls back when reference is empty", () => {
    expect(procClassDisplayLabel(9)).toBe("Procedure class 9");
  });

  it("falls back for unknown procClass with loaded reference", () => {
    expect(procClassDisplayLabel(77, maps)).toBe("Procedure class 77");
  });

  it("uses displayName when a single dictionary row matches classId", () => {
    const single = buildProcedureReferenceMaps([
      {
        procedureCode: "SYN55",
        displayName: "Synthetic single class label",
        category: "Synthetic cat",
        categoryCode: null,
        classId: 55,
        chartRelevant: true,
      },
    ]);
    expect(procClassDisplayLabel(55, single)).toBe("Synthetic single class label");
  });
});

describe("procedure reference privacy", () => {
  it("stores only safe dictionary fields on built entries", () => {
    const maps = buildProcedureReferenceMaps([
      {
        procedureCode: "SYN99",
        displayName: "Synthetic privacy check",
        category: null,
        categoryCode: null,
        classId: 5,
        chartRelevant: false,
      },
    ]);
    const entry = maps.byProcedureCode.get("SYN99");
    expect(entry).toBeDefined();
    expect(Object.keys(entry ?? {})).toEqual(["procedureCode", "displayName", "category", "classId"]);
    expect(procClassDisplayLabel(5, maps)).toBe("Synthetic privacy check");
  });
});
