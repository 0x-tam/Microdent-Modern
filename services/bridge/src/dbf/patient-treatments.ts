import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { PatientTreatmentItem, PatientTreatmentsResponse } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import { formatFoxProDateValue, strField, strIdField } from "./patient-dbf-helpers.js";
import { readReferenceDoctorsFromDbf } from "./reference-doctors.js";
import { readReferenceProcedures } from "./reference-procedures.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const OPERTBL_DBF = "OPERTBL.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

/** Hard cap on matching procedure lines returned per patient. */
export const PATIENT_TREATMENTS_MAX = 200;

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

function statusFieldOrNull(row: Record<string, unknown>): number | null {
  const v = row.STATUS;
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const n = Math.trunc(Number(String(v).trim()));
  return Number.isFinite(n) ? n : null;
}

function doctorIdFromDoctField(row: Record<string, unknown>): string | null {
  const v = row.DOCT;
  if (v === null || v === undefined) return null;
  let n: number;
  if (typeof v === "number" && Number.isFinite(v)) {
    n = Math.trunc(v);
  } else {
    n = Math.trunc(Number(String(v).trim()));
  }
  if (!Number.isFinite(n) || n === 0) return null;
  return String(n);
}

function memoAppearsNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "object" && v !== null && "length" in v) {
    const len = (v as { length: unknown }).length;
    if (typeof len === "number") return len > 0;
  }
  return Boolean(v);
}

/** True when blocked text/memo columns appear populated — never serializes their contents. */
function rowHasDescription(row: Record<string, unknown>): boolean {
  if (strField(row, "DESC").length > 0) return true;
  return memoAppearsNonEmpty(row.DESCRIPT);
}

function buildProcedureLabelLookup(procedures: Array<{ procedureCode: string; displayName: string | null }>): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const p of procedures) {
    const code = p.procedureCode.trim();
    if (code.length === 0) continue;
    map.set(code, p.displayName);
    const left6 = code.slice(0, 6);
    if (left6.length > 0 && left6 !== code) {
      map.set(left6, p.displayName);
    }
    if (code.length < 12) {
      map.set(code.padEnd(12, " "), p.displayName);
    }
  }
  return map;
}

function resolveProcedureLabel(rawCode: string, lookup: Map<string, string | null>): string | null {
  const trimmed = rawCode.trim();
  if (trimmed.length === 0) return null;
  const candidates = [trimmed, trimmed.slice(0, 6), trimmed.padEnd(12, " ")];
  for (const key of candidates) {
    if (lookup.has(key)) {
      return lookup.get(key) ?? null;
    }
  }
  return null;
}

function buildDoctorLabelLookup(
  doctors: Array<{ doctorId: string; displayName: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of doctors) {
    map.set(d.doctorId, d.displayName);
  }
  return map;
}

function compareTreatments(a: PatientTreatmentItem, b: PatientTreatmentItem): number {
  const dateCmp = compareIsoDates(b.date, a.date);
  if (dateCmp !== 0) return dateCmp;
  const aNum = Number(a.treatmentId);
  const bNum = Number(b.treatmentId);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return bNum - aNum;
  }
  return b.treatmentId.localeCompare(a.treatmentId);
}

function compareIsoDates(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b);
}

function toTreatmentItem(
  row: Record<string, unknown>,
  patientId: string,
  procedureLookup: Map<string, string | null>,
  doctorLookup: Map<string, string>,
): PatientTreatmentItem | null {
  const treatmentId = strIdField(row, "OPNUM");
  if (treatmentId.length === 0) return null;

  const procedureCodeRaw = strField(row, "PROCNB");
  const procedureCode = procedureCodeRaw.length > 0 ? procedureCodeRaw : null;
  const doctorId = doctorIdFromDoctField(row);

  return {
    treatmentId,
    patientId,
    date: formatFoxProDateValue(row.DATE),
    tooth: intFieldOrNull(row, "TOOTHNB"),
    procedureCode,
    procedureLabel: procedureCode !== null ? resolveProcedureLabel(procedureCode, procedureLookup) : null,
    doctorId,
    doctorLabel: doctorId !== null ? (doctorLookup.get(doctorId) ?? null) : null,
    status: statusFieldOrNull(row),
    hasDescription: rowHasDescription(row),
  };
}

export type ReadPatientTreatmentsOutcome =
  | { kind: "ok"; body: PatientTreatmentsResponse }
  | { kind: "missing_table" }
  | { kind: "read_error" };

/**
 * Read-only scan of `OPERTBL.DBF` for one patient (`ID` matches profile `patientId`).
 * Uses dbffile **loose** mode (VFP `_NullFlags` column). Never returns memos, fees, or raw rows.
 */
export async function readPatientTreatmentsFromDbf(
  dataRoot: DataRootSet,
  patientIdDigits: string,
): Promise<ReadPatientTreatmentsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, OPERTBL_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  const procedureLookup = new Map<string, string | null>();
  const procOutcome = await readReferenceProcedures(dataRoot);
  if (procOutcome.kind === "ok") {
    for (const [k, v] of buildProcedureLabelLookup(procOutcome.procedures)) {
      procedureLookup.set(k, v);
    }
  }

  const doctorLookup = new Map<string, string>();
  const docOutcome = await readReferenceDoctorsFromDbf(dataRoot);
  if (docOutcome.kind === "ok") {
    for (const [k, v] of buildDoctorLabelLookup(docOutcome.doctors)) {
      doctorLookup.set(k, v);
    }
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const collected: PatientTreatmentItem[] = [];
  let matchedBeyondCap = false;

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (!rowPatientIdMatches(rec, patientIdDigits)) continue;

      if (collected.length >= PATIENT_TREATMENTS_MAX) {
        matchedBeyondCap = true;
        continue;
      }

      const item = toTreatmentItem(rec, patientIdDigits, procedureLookup, doctorLookup);
      if (item !== null) {
        collected.push(item);
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  collected.sort(compareTreatments);

  return {
    kind: "ok",
    body: {
      patientId: patientIdDigits,
      treatments: collected,
      truncated: matchedBeyondCap,
      privacyNote:
        "Procedure memos, per-line descriptions, fee columns, and raw OPERTBL rows are never exposed by this route.",
    },
  };
}
