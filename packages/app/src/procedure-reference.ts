import type { ReferenceProcedureItem } from "@microdent/contracts";

/** Trimmed `PROCNB` — join key for dictionary lookups (no width padding). */
export function normalizeProcedureCode(code: string): string {
  return code.trim();
}

export type ProcedureDictionaryEntry = {
  procedureCode: string;
  displayName: string | null;
  category: string | null;
  classId: number | null;
};

export type ProcedureReferenceMaps = {
  byProcedureCode: ReadonlyMap<string, ProcedureDictionaryEntry>;
  /** `CLASS_ID` from PROCCHRT when non-null — used for tentative SCHEDULE.PROC_CLASS joins. */
  byClassId: ReadonlyMap<number, readonly ProcedureDictionaryEntry[]>;
};

export const EMPTY_PROCEDURE_REFERENCE_MAPS: ProcedureReferenceMaps = {
  byProcedureCode: new Map(),
  byClassId: new Map(),
};

function toEntry(item: ReferenceProcedureItem): ProcedureDictionaryEntry {
  return {
    procedureCode: normalizeProcedureCode(item.procedureCode),
    displayName: item.displayName,
    category: item.category,
    classId: item.classId,
  };
}

/** Safe maps from GET /v1/reference/procedures (no fee / price fields in the contract). */
export function buildProcedureReferenceMaps(
  procedures: readonly ReferenceProcedureItem[],
): ProcedureReferenceMaps {
  const byProcedureCode = new Map<string, ProcedureDictionaryEntry>();
  const byClassId = new Map<number, ProcedureDictionaryEntry[]>();

  for (const raw of procedures) {
    const entry = toEntry(raw);
    if (entry.procedureCode.length === 0) {
      continue;
    }
    byProcedureCode.set(entry.procedureCode, entry);
    if (entry.classId !== null && entry.classId !== 0) {
      const list = byClassId.get(entry.classId) ?? [];
      list.push(entry);
      byClassId.set(entry.classId, list);
    }
  }

  return { byProcedureCode, byClassId };
}

function nonEmptyTrimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function uniqueNonEmpty(values: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = nonEmptyTrimmed(v);
    if (s !== null) {
      set.add(s);
    }
  }
  return [...set];
}

/**
 * When displayName equals procedureCode (code-only / ambiguous), prefer category when present.
 */
function pickEntryLabel(entry: ProcedureDictionaryEntry): string | null {
  const name = nonEmptyTrimmed(entry.displayName);
  const category = nonEmptyTrimmed(entry.category);
  if (name !== null && name !== entry.procedureCode) {
    return name;
  }
  if (category !== null) {
    return category;
  }
  return name;
}

/**
 * Picks one label when every candidate agrees on a single resolved label, else a single category.
 * Returns null when names/categories conflict or are all blank.
 */
function resolveUnambiguousLabel(entries: readonly ProcedureDictionaryEntry[]): string | null {
  const labels = uniqueNonEmpty(entries.map((e) => pickEntryLabel(e)));
  if (labels.length === 1) {
    return labels[0]!;
  }
  const categories = uniqueNonEmpty(entries.map((e) => e.category));
  if (categories.length === 1) {
    return categories[0]!;
  }
  return null;
}

/** Safe label for a procedure code row when API `procedureLabel` is missing. */
export function procedureReferenceLabelForCode(
  code: string,
  maps: ProcedureReferenceMaps = EMPTY_PROCEDURE_REFERENCE_MAPS,
): string | null {
  const key = normalizeProcedureCode(code);
  if (key.length === 0) {
    return null;
  }
  const entry = maps.byProcedureCode.get(key);
  if (entry === undefined) {
    return null;
  }
  return pickEntryLabel(entry);
}

function lookupByProcedureCode(
  procClass: number,
  maps: ProcedureReferenceMaps,
): ProcedureDictionaryEntry[] {
  const candidates = [String(procClass), String(procClass).padStart(6, "0")];
  const seen = new Set<string>();
  const hits: ProcedureDictionaryEntry[] = [];
  for (const raw of candidates) {
    const key = normalizeProcedureCode(raw);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const entry = maps.byProcedureCode.get(key);
    if (entry !== undefined) {
      hits.push(entry);
    }
  }
  return hits;
}

/**
 * Label for SCHEDULE `procClass` / PROC_CLASS.
 *
 * Safe joins (see phase-1b docs — PROC_CLASS vs CLASS_ID is not fully confirmed in legacy):
 * - `classId === procClass` with one distinct dictionary displayName or category across rows.
 * - `procedureCode` equals procClass (or zero-padded) with an unambiguous dictionary row.
 *
 * Otherwise `Procedure class {id}`. Returns null when `procClass` is 0.
 */
export function procClassDisplayLabel(
  procClass: number,
  maps: ProcedureReferenceMaps = EMPTY_PROCEDURE_REFERENCE_MAPS,
): string | null {
  if (!Number.isFinite(procClass) || procClass === 0) {
    return null;
  }

  const classRows = maps.byClassId.get(procClass);
  if (classRows !== undefined && classRows.length > 0) {
    const fromClass = resolveUnambiguousLabel(classRows);
    if (fromClass !== null) {
      return fromClass;
    }
  }

  const codeHits = lookupByProcedureCode(procClass, maps);
  if (codeHits.length === 1) {
    const fromCode = resolveUnambiguousLabel(codeHits);
    if (fromCode !== null) {
      return fromCode;
    }
  }
  if (codeHits.length > 1) {
    const fromCodes = resolveUnambiguousLabel(codeHits);
    if (fromCodes !== null) {
      return fromCodes;
    }
  }

  return `Procedure class ${procClass}`;
}
