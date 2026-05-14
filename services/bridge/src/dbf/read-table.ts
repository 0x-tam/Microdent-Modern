import { DBFFile } from "dbffile";
import type { DataRootSet } from "../config.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";
import type { TableRegistryEntry } from "./table-registry.js";

export async function openRegisteredDbf(
  dataRoot: DataRootSet,
  entry: TableRegistryEntry,
): Promise<DBFFile> {
  const abs = resolveRegisteredDbfPath(dataRoot, entry.fileName);
  return DBFFile.open(abs);
}

export type Pagination = { limit: number; offset: number };

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function firstQueryString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const v0 = value[0];
    if (v0 === undefined || v0 === null) return undefined;
    return String(v0);
  }
  return String(value);
}

export function parsePagination(query: Record<string, unknown>): Pagination | { error: string } {
  const rawLimit = firstQueryString(query.limit);
  const rawOffset = firstQueryString(query.offset);

  const offset = rawOffset === undefined || rawOffset === "" ? 0 : Number(rawOffset);

  if (!Number.isInteger(offset) || offset < 0) {
    return { error: "offset must be a non-negative integer" };
  }

  const limit = rawLimit === undefined || rawLimit === "" ? DEFAULT_LIMIT : Number(rawLimit);

  if (!Number.isInteger(limit) || limit < 1) {
    return { error: "limit must be a positive integer" };
  }
  if (limit > MAX_LIMIT) {
    return { error: `limit must not exceed ${MAX_LIMIT}` };
  }

  return { limit, offset };
}

/**
 * Read a page of rows using dbffile read cursor semantics (skip then take).
 */
export async function readRegisteredTableRows(
  dataRoot: DataRootSet,
  entry: TableRegistryEntry,
  pagination: Pagination,
): Promise<{ totalRecords: number; rows: Record<string, unknown>[] }> {
  const dbf = await openRegisteredDbf(dataRoot, entry);
  try {
    const totalRecords = dbf.recordCount;
    if (pagination.offset > 0) {
      await dbf.readRecords(pagination.offset);
    }
    const rows = (await dbf.readRecords(pagination.limit)) as Record<string, unknown>[];
    return { totalRecords, rows };
  } finally {
    // DBFFile has no explicit close in public API; allow GC when reference drops.
  }
}
