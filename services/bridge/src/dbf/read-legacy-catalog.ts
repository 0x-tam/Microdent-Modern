import { existsSync } from "node:fs";
import { DBFFile } from "dbffile";
import type { DataRootSet } from "../config.js";
import { LEGACY_CATALOG_REGISTRY } from "./legacy-catalog-registry.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

export type LegacyCatalogRow = {
  tableId: string;
  displayName: string;
  fileName: string;
  present: boolean;
  recordCount: number | null;
  fieldCount: number | null;
};

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
        try {
          const dbf = await DBFFile.open(abs);
          recordCount = dbf.recordCount;
          fieldCount = dbf.fields.length;
        } catch {
          recordCount = null;
          fieldCount = null;
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
