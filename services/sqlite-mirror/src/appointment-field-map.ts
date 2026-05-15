export type SafeAppointmentRow = {
  appointmentId: string;
  date: string;
  time: string;
  durationSlots: number;
  periodMinutes: number | null;
  room: number;
  status: number;
  docId: number;
  patientId: string;
  procClass: number;
  vacId: number;
  recall: number;
  unreason: number;
  missed: boolean;
  hasComment: boolean;
  sourceDeleted: boolean;
};

function strField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(row: Record<string, unknown>, key: string, def = 0): number {
  const v = row[key];
  if (v === null || v === undefined) return def;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : def;
}

function strId(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "0";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  const s = String(v).trim();
  return s.length > 0 ? s : "0";
}

function formatRowDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function toBool(v: unknown): boolean {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    return s === "T" || s === "Y" || s === "1";
  }
  return Boolean(v);
}

/**
 * True when COMMENT appears non-empty without reading memo body into storage.
 */
function hasNonEmptyComment(row: Record<string, unknown>): boolean {
  const v = row.COMMENT;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "object" && v !== null && "length" in v) {
    const len = (v as { length: unknown }).length;
    if (typeof len === "number") return len > 0;
  }
  return Boolean(v);
}

function isValidAppointmentId(appointmentId: string, row: Record<string, unknown>): boolean {
  if (appointmentId === "0") {
    const raw = row.ID;
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "string" && raw.trim().length === 0) return false;
  }
  return appointmentId.length > 0;
}

/**
 * Maps one SCHEDULE.DBF row to safe mirror fields. Never reads PAT_NAME, TELEPHONE, COMMENT text, or CASENUM.
 */
export function mapSafeAppointmentRow(
  row: Record<string, unknown>,
  sourceDeleted: boolean,
): SafeAppointmentRow | null {
  const appointmentId = strId(row, "ID");
  if (!isValidAppointmentId(appointmentId, row)) return null;

  const date = formatRowDate(row.DATE);
  if (date === null) return null;

  const period = Math.trunc(num(row, "PERIOD"));
  return {
    appointmentId,
    date,
    time: strField(row, "TIME"),
    durationSlots: Math.trunc(num(row, "DURATION")),
    periodMinutes: period > 0 ? period : null,
    room: Math.trunc(num(row, "ROOM")),
    status: Math.trunc(num(row, "STATUS")),
    docId: Math.trunc(num(row, "DOC_ID")),
    patientId: strId(row, "PAT_ID"),
    procClass: Math.trunc(num(row, "PROC_CLASS")),
    vacId: Math.trunc(num(row, "VAC_ID")),
    recall: Math.trunc(num(row, "RECALL")),
    unreason: Math.trunc(num(row, "UNREASON")),
    missed: toBool(row.MISSED),
    hasComment: hasNonEmptyComment(row),
    sourceDeleted,
  };
}
