import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { PatientChartEntry, PatientChartResponse } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { logicalToBoolOrNull, memoFieldAppearsNonEmpty, strIdField } from "./patient-dbf-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const CHARTDBF_DBF = "CHARTDBF.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const };

/** Hard cap on matching chart rows returned per patient. */
export const PATIENT_CHART_MAX = 128;

function rowPatientIdMatches(row: Record<string, unknown>, patientIdDigits: string): boolean {
  return strIdField(row, "ID") === patientIdDigits;
}

function intFieldOrNull(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n === 0 ? null : n;
  }
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function chartTypeFieldOrNull(row: Record<string, unknown>): number | null {
  const v = row.TYPE;
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) ? n : null;
}

function rowHasNote(row: Record<string, unknown>): boolean {
  return memoFieldAppearsNonEmpty(row.NOTE);
}

function buildChartEntryId(toothNumber: number | null, chartType: number | null, ordinal: number): string {
  const tooth = toothNumber ?? 0;
  const type = chartType ?? 0;
  return `${tooth}-${type}-${ordinal}`;
}

function compareChartEntries(a: PatientChartEntry, b: PatientChartEntry): number {
  const aTooth = a.toothNumber ?? -1;
  const bTooth = b.toothNumber ?? -1;
  if (aTooth !== bTooth) return aTooth - bTooth;
  const aType = a.chartType ?? -1;
  const bType = b.chartType ?? -1;
  if (aType !== bType) return aType - bType;
  return a.chartEntryId.localeCompare(b.chartEntryId);
}

function toChartEntry(
  row: Record<string, unknown>,
  patientId: string,
  ordinal: number,
): PatientChartEntry {
  const toothNumber = intFieldOrNull(row, "TOOTH_NB");
  const chartType = chartTypeFieldOrNull(row);

  return {
    chartEntryId: buildChartEntryId(toothNumber, chartType, ordinal),
    patientId,
    toothNumber,
    chartType,
    treated: logicalToBoolOrNull(row.TREATED) === true,
    hasNote: rowHasNote(row),
  };
}

export type ReadPatientChartOutcome =
  | { kind: "ok"; body: PatientChartResponse }
  | { kind: "missing_table" }
  | { kind: "read_error" };

/**
 * Read-only scan of `CHARTDBF.DBF` for one patient (`ID` matches profile `patientId`).
 * Never returns `NOTE` text, layer legends, or raw rows.
 */
export async function readPatientChartFromDbf(
  dataRoot: DataRootSet,
  patientIdDigits: string,
): Promise<ReadPatientChartOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, CHARTDBF_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const collected: PatientChartEntry[] = [];
  let matchedBeyondCap = false;
  const ordinalByKey = new Map<string, number>();

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (!rowPatientIdMatches(rec, patientIdDigits)) continue;

      if (collected.length >= PATIENT_CHART_MAX) {
        matchedBeyondCap = true;
        continue;
      }

      const toothNumber = intFieldOrNull(rec, "TOOTH_NB");
      const chartType = chartTypeFieldOrNull(rec);
      const key = `${toothNumber ?? 0}:${chartType ?? 0}`;
      const nextOrdinal = (ordinalByKey.get(key) ?? 0) + 1;
      ordinalByKey.set(key, nextOrdinal);

      collected.push(toChartEntry(rec, patientIdDigits, nextOrdinal));
    }
  } catch {
    return { kind: "read_error" };
  }

  collected.sort(compareChartEntries);

  return {
    kind: "ok",
    body: {
      patientId: patientIdDigits,
      entries: collected,
      truncated: matchedBeyondCap,
      privacyNote:
        "Chart memos, layer code legends, clinical labels, and raw CHARTDBF rows are never exposed by this route.",
    },
  };
}
