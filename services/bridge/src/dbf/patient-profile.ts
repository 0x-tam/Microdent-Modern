import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { PatientProfileResponse } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";
import {
  buildDisplayName,
  doctorIdFromRow,
  formatFoxProDateValue,
  logicalToBoolOrNull,
  pickPhoneMask,
  strField,
  strIdField,
} from "./patient-dbf-helpers.js";

const PATIENT_DBF = "PATIENT.DBF";
const PATIENT_OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function reverseNameFromRow(row: Record<string, unknown>): string | null {
  const r = strField(row, "REV_NAME");
  return r.length > 0 ? r : null;
}

function rowIdMatches(row: Record<string, unknown>, patientIdDigits: string): boolean {
  return strIdField(row, "ID") === patientIdDigits;
}

function toProfile(row: Record<string, unknown>, patientId: string): PatientProfileResponse {
  const chart = strField(row, "CASENB");
  return {
    patientId,
    chartNumber: chart.length > 0 ? chart : null,
    displayName: buildDisplayName(row),
    phoneMask: pickPhoneMask(row),
    reverseName: reverseNameFromRow(row),
    active: logicalToBoolOrNull(row.ACTIVE),
    doctorId: doctorIdFromRow(row),
    entryDate: formatFoxProDateValue(row.ENTRY_DATE),
    lastVisit: formatFoxProDateValue(row.LASTVISIT),
  };
}

export type ReadPatientProfileOutcome =
  | { kind: "ok"; profile: PatientProfileResponse }
  | { kind: "missing_table" }
  | { kind: "not_found" }
  | { kind: "read_error"; message: string };

/**
 * Read-only: loads one non-deleted `PATIENT.DBF` row by `ID` (stringified match to search `patientId`).
 * Does not read memo columns; does not return raw rows.
 */
export async function readPatientProfileFromDbf(
  dataRoot: DataRootSet,
  patientIdDigits: string,
): Promise<ReadPatientProfileOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, PATIENT_DBF);
  } catch {
    return { kind: "read_error", message: "invalid path" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, PATIENT_OPEN_OPTIONS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open failed";
    return { kind: "read_error", message: msg };
  }

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (!rowIdMatches(rec, patientIdDigits)) continue;
      return { kind: "ok", profile: toProfile(rec, patientIdDigits) };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return { kind: "read_error", message: msg };
  }

  return { kind: "not_found" };
}
