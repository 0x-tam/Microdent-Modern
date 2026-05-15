/**
 * Safe PATIENT.DBF field mapping (mirrors bridge `patient-dbf-helpers.ts`).
 * No memo reads; no address/email/insurance/notes columns.
 */

export function strField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function strIdField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  return String(v).trim();
}

export function buildDisplayName(row: Record<string, unknown>): string {
  const name = strField(row, "NAME");
  if (name.length > 0) return name;
  const first = strField(row, "FIRST_NAME");
  const last = strField(row, "LAST_NAME");
  const joined = `${first} ${last}`.trim();
  if (joined.length > 0) return joined;
  const rev = strField(row, "REV_NAME");
  if (rev.length > 0) return rev;
  const id = strIdField(row, "ID");
  return id.length > 0 ? `Patient ${id}` : "Patient";
}

function maskPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `…${digits.slice(-4)}`;
}

export function pickPhoneMask(row: Record<string, unknown>): string | null {
  return maskPhone(row.HOME_PHONE) ?? maskPhone(row.MOBILE);
}

export function formatFoxProDateValue(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function logicalToBoolOrNull(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    if (s === "T" || s === "Y" || s === "1") return true;
    if (s === "F" || s === "N" || s === "0" || s === "") return false;
  }
  return null;
}

export function doctorIdFromRow(row: Record<string, unknown>): string | null {
  const v = row.DOCTOR_NB;
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

export function reverseNameFromRow(row: Record<string, unknown>): string | null {
  const r = strField(row, "REV_NAME");
  return r.length > 0 ? r : null;
}

/** Lowercase haystack for mirror search — id, chart, and name columns only. */
export function buildSearchBlob(row: Record<string, unknown>): string {
  const parts = [
    strIdField(row, "ID"),
    strField(row, "CASENB"),
    strField(row, "NAME"),
    strField(row, "REV_NAME"),
    strField(row, "FIRST_NAME"),
    strField(row, "LAST_NAME"),
  ].filter((p) => p.length > 0);
  return parts.join(" ").toLowerCase();
}

export type SafePatientMirrorRow = {
  patientId: string;
  chartNumber: string | null;
  displayName: string;
  reverseName: string | null;
  phoneMask: string | null;
  active: boolean | null;
  doctorId: string | null;
  entryDate: string | null;
  lastVisit: string | null;
  searchBlob: string;
  sourceDeleted: boolean;
};

export function mapSafePatientRow(
  row: Record<string, unknown>,
  sourceDeleted: boolean,
): SafePatientMirrorRow | null {
  const patientId = strIdField(row, "ID");
  if (patientId.length === 0) return null;

  const chart = strField(row, "CASENB");
  const active = logicalToBoolOrNull(row.ACTIVE);

  return {
    patientId,
    chartNumber: chart.length > 0 ? chart : null,
    displayName: buildDisplayName(row),
    reverseName: reverseNameFromRow(row),
    phoneMask: pickPhoneMask(row),
    active,
    doctorId: doctorIdFromRow(row),
    entryDate: formatFoxProDateValue(row.ENTRY_DATE),
    lastVisit: formatFoxProDateValue(row.LASTVISIT),
    searchBlob: buildSearchBlob(row),
    sourceDeleted,
  };
}
