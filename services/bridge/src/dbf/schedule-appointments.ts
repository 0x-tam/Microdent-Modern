import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import type { ScheduleAppointmentItem } from "@microdent/contracts";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const SCHEDULE_DBF = "SCHEDULE.DBF";
export const SCHEDULE_APPOINTMENTS_MAX = 1000;

const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

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
 * True when COMMENT appears non-empty without serializing memo contents in API responses.
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

/** Maps one SCHEDULE row to the safe API shape; skips rows without a readable DATE. */
export function mapScheduleRowToAppointment(row: Record<string, unknown>): ScheduleAppointmentItem | null {
  const date = formatRowDate(row.DATE);
  if (date === null) return null;
  const period = Math.trunc(num(row, "PERIOD"));
  return {
    id: strId(row, "ID"),
    date: date,
    time: strField(row, "TIME"),
    durationSlots: Math.trunc(num(row, "DURATION")),
    periodMinutes: period > 0 ? period : null,
    room: Math.trunc(num(row, "ROOM")),
    status: Math.trunc(num(row, "STATUS")),
    docId: Math.trunc(num(row, "DOC_ID")),
    patId: strId(row, "PAT_ID"),
    patient: null,
    procClass: Math.trunc(num(row, "PROC_CLASS")),
    vacId: Math.trunc(num(row, "VAC_ID")),
    recall: Math.trunc(num(row, "RECALL")),
    unreason: Math.trunc(num(row, "UNREASON")),
    missed: toBool(row.MISSED),
    hasComment: hasNonEmptyComment(row),
  };
}

export type ScheduleAppointmentsOutcome =
  | { kind: "ok"; appointments: ScheduleAppointmentItem[] }
  | { kind: "missing_schedule" }
  | { kind: "read_error" };

/**
 * Read-only scan of SCHEDULE.DBF: date range inclusive, optional room filter, max {@link SCHEDULE_APPOINTMENTS_MAX}.
 * Does not expose PAT_NAME, TELEPHONE, COMMENT text, or raw rows.
 */
export async function readScheduleAppointments(
  dataRoot: DataRootSet,
  fromIso: string,
  toIso: string,
  roomFilter?: number,
  /** When set, only rows whose normalized `PAT_ID` equals this string (same form as profile `patientId`). */
  patientIdFilter?: string,
): Promise<ScheduleAppointmentsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SCHEDULE_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_schedule" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const appointments: ScheduleAppointmentItem[] = [];
  try {
    for await (const row of dbf) {
      if (appointments.length >= SCHEDULE_APPOINTMENTS_MAX) {
        break;
      }
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const dateStr = formatRowDate(rec.DATE);
      if (dateStr === null) continue;
      if (dateStr < fromIso || dateStr > toIso) continue;
      const room = Math.trunc(num(rec, "ROOM"));
      if (roomFilter !== undefined && room !== roomFilter) continue;
      if (patientIdFilter !== undefined && strId(rec, "PAT_ID") !== patientIdFilter) continue;
      const mapped = mapScheduleRowToAppointment(rec);
      if (mapped !== null) {
        appointments.push(mapped);
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "ok", appointments };
}

export type ScheduleAppointmentLookupOutcome =
  | { kind: "found" }
  | { kind: "not_found" }
  | { kind: "missing_schedule" }
  | { kind: "read_error" };

/**
 * Read-only scan of SCHEDULE.DBF until `ID` matches — confirms existence without returning row values.
 */
export async function lookupScheduleAppointmentById(
  dataRoot: DataRootSet,
  appointmentId: string,
): Promise<ScheduleAppointmentLookupOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SCHEDULE_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_schedule" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (strId(rec, "ID") === appointmentId) {
        return { kind: "found" };
      }
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "not_found" };
}
