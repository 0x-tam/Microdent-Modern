import { existsSync } from "node:fs";
import { DBFFile } from "dbffile";
import type { DataRootSet } from "../config.js";
import { LEGACY_CATALOG_LOOSE_HEADER_FILE_NAMES, LEGACY_CATALOG_REGISTRY } from "./legacy-catalog-registry.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

export type LegacyCatalogRow = {
  tableId: string;
  displayName: string;
  fileName: string;
  present: boolean;
  recordCount: number | null;
  fieldCount: number | null;
};

const LOOSE_HEADER_OPEN_OPTIONS = {
  encoding: "win1252" as const,
  readMode: "loose" as const,
};

type CatalogHeaderCounts = { recordCount: number; fieldCount: number };

/**
 * Opens a DBF for catalog header metadata only (`recordCount`, field count).
 * Does not call `readRecords` or expose field names in API responses.
 */
export async function readDbfCatalogHeaderMetadata(
  abs: string,
  fileName: string,
): Promise<CatalogHeaderCounts | null> {
  const modes: Array<typeof LOOSE_HEADER_OPEN_OPTIONS | undefined> = LEGACY_CATALOG_LOOSE_HEADER_FILE_NAMES.has(fileName)
    ? [undefined, LOOSE_HEADER_OPEN_OPTIONS]
    : [undefined];

  for (const options of modes) {
    try {
      const dbf = await DBFFile.open(abs, options);
      return { recordCount: dbf.recordCount, fieldCount: dbf.fields.length };
    } catch {
      // try next mode when configured (e.g. OPERTBL strict → loose)
    }
  }
  return null;
}

/**
 * Builds legacy catalog rows from registry + DATA_ROOT.
 * Opens DBFs only to read header metadata (`recordCount`, field count). Does not read row values.
 */
export async function readLegacyCatalogRows(dataRoot: DataRootSet): Promise<LegacyCatalogRow[]> {
  const rows: LegacyCatalogRow[] = [];
  for (const entry of LEGACY_CATALOG_REGISTRY) {
    let present = false;
    let recordCount: number | null = null;
    let fieldCount: number | null = null;
    try {
      const abs = resolveRegisteredDbfPath(dataRoot, entry.fileName);
      present = existsSync(abs);
      if (present) {
        const header = await readDbfCatalogHeaderMetadata(abs, entry.fileName);
        if (header) {
          recordCount = header.recordCount;
          fieldCount = header.fieldCount;
        }
      }
    } catch {
      present = false;
      recordCount = null;
      fieldCount = null;
    }
    rows.push({
      tableId: entry.id,
      displayName: entry.label,
      fileName: entry.fileName,
      present,
      recordCount,
      fieldCount,
    });
  }
  return rows;
}
