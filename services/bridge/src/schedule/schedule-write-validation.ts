import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import { resolveRegisteredDbfPath } from "../dbf/resolve-registered-dbf.js";
import type { ScheduleConflictRow } from "../dbf/read-schedule-row-internal.js";
import {
  normalizeScheduleTimeHm,
  parseScheduleTimeToMinutes,
  scheduleIntervalEndMinutes,
  scheduleIntervalsOverlap,
  weekdayIndexFromIsoDate,
} from "./schedule-time-utils.js";

const PATIENT_DBF = "PATIENT.DBF";
const SC_ROOM_DBF = "SC_ROOM.DBF";
const OPEN_OPTIONS = { encoding: "win1252" as const, readMode: "loose" as const };

function strId(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "0";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  const s = String(v).trim();
  return s.length > 0 ? s : "0";
}

function num(row: Record<string, unknown>, key: string, def = 0): number {
  const v = row[key];
  if (v === null || v === undefined) return def;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : def;
}

function toBool(v: unknown): boolean {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    return s === "T" || s === "Y" || s === "1";
  }
  return Boolean(v);
}

export async function patientIdExistsInDbf(dataRoot: DataRootSet, patientId: string): Promise<boolean> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, PATIENT_DBF);
  } catch {
    return false;
  }
  if (!existsSync(abs)) return false;

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return false;
  }

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (strId(rec, "ID") === patientId) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function validateScheduleRoom(
  dataRoot: DataRootSet,
  room: number,
  isoDate: string,
): Promise<boolean> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SC_ROOM_DBF);
  } catch {
    return false;
  }
  if (!existsSync(abs)) return false;

  const weekday = weekdayIndexFromIsoDate(isoDate);
  if (weekday === null) return false;
  const dayKey = `DAY${weekday + 1}` as const;

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return false;
  }

  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      if (Math.trunc(num(rec, "ROOM")) !== room) continue;
      return toBool(rec[dayKey]);
    }
  } catch {
    return false;
  }
  return false;
}

export function detectScheduleConflict(input: {
  candidateId: string | null;
  date: string;
  time: string;
  room: number;
  durationSlots: number;
  periodMinutes: number;
  existing: readonly ScheduleConflictRow[];
}): boolean {
  const normalizedTime = normalizeScheduleTimeHm(input.time);
  const start = normalizedTime === null ? null : parseScheduleTimeToMinutes(normalizedTime);
  if (start === null) return true;
  const end = scheduleIntervalEndMinutes(start, input.durationSlots, input.periodMinutes);

  for (const other of input.existing) {
    if (input.candidateId !== null && other.id === input.candidateId) continue;
    if (other.date !== input.date || other.room !== input.room) continue;
    const otherStart = parseScheduleTimeToMinutes(normalizeScheduleTimeHm(other.time) ?? other.time);
    if (otherStart === null) continue;
    const otherEnd = scheduleIntervalEndMinutes(
      otherStart,
      other.durationSlots,
      other.periodMinutes,
    );
    if (scheduleIntervalsOverlap(start, end, otherStart, otherEnd)) {
      return true;
    }
  }
  return false;
}
