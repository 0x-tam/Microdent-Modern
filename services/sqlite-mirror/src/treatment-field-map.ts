/**
 * Safe OPERTBL field mapping (mirrors bridge `patient-treatments.ts`).
 * Never persists memo text, fees, or raw row payloads.
 */

import { formatFoxProDateValue, strField, strIdField } from "./patient-field-map.js";

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
export function rowHasDescription(row: Record<string, unknown>): boolean {
  if (strField(row, "DESC").length > 0) return true;
  return memoAppearsNonEmpty(row.DESCRIPT);
}

export function buildProcedureLabelLookup(
  procedures: Array<{ procedureCode: string; label: string }>,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const p of procedures) {
    const code = p.procedureCode.trim();
    if (code.length === 0) continue;
    const displayName = p.label.trim().length > 0 ? p.label.trim() : null;
    map.set(code, displayName);
    const left6 = code.slice(0, 6);
    if (left6.length > 0 && left6 !== code) {
      map.set(left6, displayName);
    }
    if (code.length < 12) {
      map.set(code.padEnd(12, " "), displayName);
    }
  }
  return map;
}

export function resolveProcedureLabel(rawCode: string, lookup: Map<string, string | null>): string | null {
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

export function buildDoctorLabelLookup(doctors: Array<{ doctorId: string; displayLabel: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of doctors) {
    map.set(d.doctorId, d.displayLabel);
  }
  return map;
}

/**
 * Coerces `DATE` to ISO `YYYY-MM-DD` or null when absent.
 * Returns false when a non-empty legacy value cannot be coerced (quarantine at import).
 */
export function coerceTreatmentDate(row: Record<string, unknown>): string | null | false {
  const raw = row.DATE;
  if (raw === null || raw === undefined) return null;
  const iso = formatFoxProDateValue(raw);
  if (iso !== null) return iso;
  if (typeof raw === "string" && raw.trim().length === 0) return null;
  return false;
}

export type SafeTreatmentMirrorRow = {
  patientId: string;
  treatmentId: string;
  treatmentDate: string | null;
  tooth: number | null;
  procedureCode: string | null;
  procedureLabel: string | null;
  doctorId: string | null;
  doctorLabel: string | null;
  status: number | null;
  hasDescription: boolean;
  sourceDeleted: boolean;
};

export type MapTreatmentRowResult =
  | { kind: "ok"; row: SafeTreatmentMirrorRow }
  | { kind: "error"; errorCode: string };

export function mapSafeTreatmentRow(
  row: Record<string, unknown>,
  sourceDeleted: boolean,
  procedureLookup: Map<string, string | null>,
  doctorLookup: Map<string, string>,
): MapTreatmentRowResult {
  const patientId = strIdField(row, "ID");
  if (patientId.length === 0 || patientId === "0") {
    return { kind: "error", errorCode: "TREATMENT_PATIENT_ID_INVALID" };
  }

  const treatmentId = strIdField(row, "OPNUM");
  if (treatmentId.length === 0) {
    return { kind: "error", errorCode: "TREATMENT_MISSING_OPNUM" };
  }

  const treatmentDate = coerceTreatmentDate(row);
  if (treatmentDate === false) {
    return { kind: "error", errorCode: "TREATMENT_INVALID_DATE" };
  }

  const procedureCodeRaw = strField(row, "PROCNB");
  const procedureCode = procedureCodeRaw.length > 0 ? procedureCodeRaw : null;
  const doctorId = doctorIdFromDoctField(row);

  return {
    kind: "ok",
    row: {
      patientId,
      treatmentId,
      treatmentDate,
      tooth: intFieldOrNull(row, "TOOTHNB"),
      procedureCode,
      procedureLabel:
        procedureCode !== null ? resolveProcedureLabel(procedureCode, procedureLookup) : null,
      doctorId,
      doctorLabel: doctorId !== null ? (doctorLookup.get(doctorId) ?? null) : null,
      status: statusFieldOrNull(row),
      hasDescription: rowHasDescription(row),
      sourceDeleted,
    },
  };
}
