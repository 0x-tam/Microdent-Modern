import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DBFFile } from "dbffile";
import { parseDataRootFromValue } from "../config.js";
import { readDbfCatalogHeaderMetadata, readLegacyCatalogRows } from "./read-legacy-catalog.js";

const opertblFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "OPNUM", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
];

async function writeSyntheticOpertbl(dir: string, rowCount: number): Promise<void> {
  const path = join(dir, "OPERTBL.DBF");
  const dbf = await DBFFile.create(path, opertblFields, {});
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    ID: 100 + i,
    OPNUM: i + 1,
    STATUS: 0,
  }));
  await dbf.appendRecords(rows);
}

describe("readDbfCatalogHeaderMetadata", () => {
  it("returns header counts for a synthetic OPERTBL without reading rows", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-catalog-opertbl-"));
    try {
      await writeSyntheticOpertbl(tmp, 2);
      const abs = join(tmp, "OPERTBL.DBF");
      const header = await readDbfCatalogHeaderMetadata(abs, "OPERTBL.DBF");
      expect(header).toEqual({ recordCount: 2, fieldCount: 3 });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("falls back to loose mode when strict open fails for OPERTBL", async () => {
    const openSpy = vi.spyOn(DBFFile, "open");
    const looseDbf = {
      recordCount: 7,
      fields: [{}, {}, {}],
    } as Awaited<ReturnType<typeof DBFFile.open>>;

    openSpy.mockImplementation(async (_path, options) => {
      if (options?.readMode === "loose") return looseDbf;
      throw new Error("Type '0' is not supported");
    });

    try {
      const header = await readDbfCatalogHeaderMetadata("/fake/OPERTBL.DBF", "OPERTBL.DBF");
      expect(header).toEqual({ recordCount: 7, fieldCount: 3 });
      expect(openSpy).toHaveBeenCalledTimes(2);
      expect(openSpy.mock.calls[0]?.[1]).toBeUndefined();
      expect(openSpy.mock.calls[1]?.[1]).toMatchObject({ readMode: "loose", encoding: "win1252" });
    } finally {
      openSpy.mockRestore();
    }
  });

  it("does not use loose fallback for non-OPERTBL basenames", async () => {
    const openSpy = vi.spyOn(DBFFile, "open");
    openSpy.mockRejectedValue(new Error("unsupported"));

    try {
      const header = await readDbfCatalogHeaderMetadata("/fake/PATIENT.DBF", "PATIENT.DBF");
      expect(header).toBeNull();
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0]?.[1]).toBeUndefined();
    } finally {
      openSpy.mockRestore();
    }
  });
});

describe("readLegacyCatalogRows", () => {
  it("populates opertbl counts without exposing row payloads", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "bridge-catalog-rows-"));
    try {
      await writeSyntheticOpertbl(tmp, 4);
      const dataRoot = parseDataRootFromValue(tmp);
      if (!dataRoot.configured) throw new Error("data root");
      const rows = await readLegacyCatalogRows(dataRoot);
      const opertbl = rows.find((r) => r.tableId === "opertbl");
      expect(opertbl).toMatchObject({
        present: true,
        recordCount: 4,
        fieldCount: 3,
        fileName: "OPERTBL.DBF",
      });
      expect(opertbl).not.toHaveProperty("fields");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
