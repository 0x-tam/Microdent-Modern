import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { MedicalConditionFlags, PatientMedicalSummaryResponse } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { formatFoxProDateValue, logicalToBoolOrNull, strField, strIdField } from "./patient-dbf-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const MEDICAL_DBF = "MEDICAL.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

/** Legacy `L` columns mapped to {@link MedicalConditionFlags} keys (order preserved for counts). */
const FLAG_FIELD_MAP: ReadonlyArray<{ dbf: string; key: keyof MedicalConditionFlags }> = [
  { dbf: "HOSPITAL", key: "hospital" },
  { dbf: "PHYSICIAN", key: "physician" },
  { dbf: "MEDICINE", key: "medicine" },
  { dbf: "ILL", key: "ill" },
  { dbf: "REACTION", key: "reaction" },
  { dbf: "BLEEDING", key: "bleeding" },
  { dbf: "ALLERGIC", key: "allergic" },
  { dbf: "HEART_TRBL", key: "heartTrouble" },
  { dbf: "CONG_HEART", key: "congenitalHeart" },
  { dbf: "HEART_MRM", key: "heartMurmur" },
  { dbf: "HIGH_PRESS", key: "highBloodPressure" },
  { dbf: "LOW_PRESS", key: "lowBloodPressure" },
  { dbf: "ANEMIA", key: "anemia" },
  { dbf: "RH_FEVER", key: "rheumaticFever" },
  { dbf: "JAUNDICE", key: "jaundice" },
  { dbf: "ASTHMA", key: "asthma" },
  { dbf: "COUGH", key: "cough" },
  { dbf: "KIDNEYS", key: "kidneyTrouble" },
  { dbf: "MED1", key: "med1" },
  { dbf: "DIABETS", key: "diabetes" },
  { dbf: "TUBERCUL", key: "tuberculosis" },
  { dbf: "HEPATISIS", key: "hepatitis" },
  { dbf: "ARTHRITIS", key: "arthritis" },
  { dbf: "STROKE", key: "stroke" },
  { dbf: "EPILEPSEY", key: "epilepsy" },
  { dbf: "PSYCHIATRI", key: "psychiatric" },
  { dbf: "SINUS_TRBL", key: "sinusTrouble" },
  { dbf: "PREGNANT", key: "pregnant" },
  { dbf: "ULCERS", key: "ulcers" },
  { dbf: "AIDS", key: "aids" },
  { dbf: "MED2", key: "med2" },
];

function rowPatientIdMatches(row: Record<string, unknown>, patientIdDigits: string): boolean {
  return strIdField(row, "PATIENT_ID") === patientIdDigits;
}

/** Normalized PATIENT_ID for mirror grouping; null when missing or invalid. */
export function rowPatientIdMatchesMedical(row: Record<string, unknown>): string | null {
  const id = strIdField(row, "PATIENT_ID");
  return id.length > 0 ? id : null;
}

/** True when blocked text/memo columns appear populated — never serializes their contents. */
function rowHasSensitiveMedicalDetails(row: Record<string, unknown>): boolean {
  if (strField(row, "PROBLEM").length > 0) return true;
  if (strField(row, "ALLERGY_TO").length > 0) return true;
  return notesAppearNonEmpty(row);
}

function notesAppearNonEmpty(row: Record<string, unknown>): boolean {
  const v = row.NOTES;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "object" && v !== null && "length" in v) {
    const len = (v as { length: unknown }).length;
    if (typeof len === "number") return len > 0;
  }
  return Boolean(v);
}

function buildConditionFlags(row: Record<string, unknown>): MedicalConditionFlags {
  const out = {} as MedicalConditionFlags;
  for (const { dbf, key } of FLAG_FIELD_MAP) {
    out[key] = logicalToBoolOrNull(row[dbf]);
  }
  return out;
}

function countFlaggedTrue(flags: MedicalConditionFlags): number {
  let n = 0;
  for (const { key } of FLAG_FIELD_MAP) {
    if (flags[key] === true) n += 1;
  }
  return n;
}

function compareIsoDates(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b);
}

function rowQuestionnaireDate(row: Record<string, unknown>): string | null {
  return formatFoxProDateValue(row.DATE);
}

export function pickPreferredMedicalRow(
  current: Record<string, unknown> | null,
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  if (current === null) return candidate;
  const curDate = rowQuestionnaireDate(current);
  const candDate = rowQuestionnaireDate(candidate);
  const cmp = compareIsoDates(candDate, curDate);
  if (cmp > 0) return candidate;
  if (cmp < 0) return current;
  return candidate;
}

function emptySummary(patientId: string): PatientMedicalSummaryResponse {
  return {
    patientId,
    hasMedicalRecord: false,
    hasSensitiveMedicalDetails: false,
    lastUpdated: null,
    lastDentalVisit: null,
    flaggedConditionCount: 0,
    conditions: null,
    privacyNote:
      "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed.",
  };
}

/** Safe medical summary fields for SQLite mirror import (no free text, no `privacyNote`). */
export type MedicalSummaryMirrorRecord = {
  patientId: string;
  hasMedicalRecord: true;
  hasSensitiveMedicalDetails: boolean;
  lastUpdated: string | null;
  lastDentalVisit: string | null;
  flaggedConditionCount: number;
  conditions: MedicalConditionFlags;
};

function toMirrorSummary(row: Record<string, unknown>, patientId: string): MedicalSummaryMirrorRecord {
  const conditions = buildConditionFlags(row);
  return {
    patientId,
    hasMedicalRecord: true,
    hasSensitiveMedicalDetails: rowHasSensitiveMedicalDetails(row),
    lastUpdated: formatFoxProDateValue(row.DATE),
    lastDentalVisit: formatFoxProDateValue(row.LAST_DENTA),
    flaggedConditionCount: countFlaggedTrue(conditions),
    conditions,
  };
}

export function toMedicalSummary(row: Record<string, unknown>, patientId: string): PatientMedicalSummaryResponse {
  return {
    ...toMirrorSummary(row, patientId),
    privacyNote:
      "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed.",
  };
}

export type ReadAllMedicalSummariesOutcome =
  | { kind: "missing_table" }
  | { kind: "read_error"; message: string }
  | {
      kind: "ok";
      summaries: MedicalSummaryMirrorRecord[];
      invalidPatientIdRows: Array<{ rowIndex: number }>;
    };

/**
 * Read-only: scans `MEDICAL.DBF` and returns one derived summary per `PATIENT_ID`
 * (latest `DATE` wins). Never includes `PROBLEM`, `ALLERGY_TO`, `NOTES`, or raw rows.
 */
export async function readAllMedicalSummariesFromDbf(
  dataRoot: DataRootSet,
): Promise<ReadAllMedicalSummariesOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, MEDICAL_DBF);
  } catch {
    return { kind: "read_error", message: "invalid path" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open failed";
    return { kind: "read_error", message: msg };
  }

  const byPatient = new Map<string, Record<string, unknown>>();
  const invalidPatientIdRows: Array<{ rowIndex: number }> = [];
  let rowIndex = 0;

  try {
    for await (const row of dbf) {
      rowIndex += 1;
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const patientId = strIdField(rec, "PATIENT_ID");
      if (patientId.length === 0) {
        invalidPatientIdRows.push({ rowIndex });
        continue;
      }
      const existing = byPatient.get(patientId) ?? null;
      byPatient.set(patientId, pickPreferredMedicalRow(existing, rec));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return { kind: "read_error", message: msg };
  }

  const summaries = [...byPatient.entries()].map(([patientId, row]) => toMirrorSummary(row, patientId));
  return { kind: "ok", summaries, invalidPatientIdRows };
}

export type ReadPatientMedicalSummaryOutcome =
  | { kind: "ok"; summary: PatientMedicalSummaryResponse }
  | { kind: "missing_table" }
  | { kind: "read_error"; message: string };

/**
 * Read-only: loads the latest non-deleted `MEDICAL.DBF` row for `PATIENT_ID` (string match to profile `patientId`).
 * Never returns `PROBLEM`, `ALLERGY_TO`, `NOTES`, or raw rows.
 */
export async function readPatientMedicalSummaryFromDbf(
  dataRoot: DataRootSet,
  patientIdDigits: string,
): Promise<ReadPatientMedicalSummaryOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, MEDICAL_DBF);
  } catch {
    return { kind: "read_error", message: "invalid path" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open failed";
    return { kind: "read_error", message: msg };
  }

  let chosen: Record<string, unknown> | null = null;
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (!rowPatientIdMatches(rec, patientIdDigits)) continue;
      chosen = pickPreferredMedicalRow(chosen, rec);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scan failed";
    return { kind: "read_error", message: msg };
  }

  if (chosen === null) {
    return { kind: "ok", summary: emptySummary(patientIdDigits) };
  }
  return { kind: "ok", summary: toMedicalSummary(chosen, patientIdDigits) };
}
