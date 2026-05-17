import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

const SCHEDULE_DBF = "SCHEDULE.DBF";
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

function formatRowDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

export type ScheduleRowInternal = {
  id: string;
  date: string;
  time: string;
  room: number;
  durationSlots: number;
  periodMinutes: number;
};

export type ReadScheduleRowOutcome =
  | { kind: "ok"; row: ScheduleRowInternal }
  | { kind: "not_found" }
  | { kind: "missing_schedule" }
  | { kind: "read_error" };

/** Internal read for write validation — never log row contents on failure. */
export async function readScheduleRowInternal(
  dataRoot: DataRootSet,
  appointmentId: string,
): Promise<ReadScheduleRowOutcome> {
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
      if (strId(rec, "ID") !== appointmentId) continue;
      const date = formatRowDate(rec.DATE);
      if (date === null) return { kind: "read_error" };
      const period = Math.trunc(num(rec, "PERIOD"));
      return {
        kind: "ok",
        row: {
          id: appointmentId,
          date,
          time: String(rec.TIME ?? "").trim(),
          room: Math.trunc(num(rec, "ROOM")),
          durationSlots: Math.trunc(num(rec, "DURATION", 1)),
          periodMinutes: period > 0 ? period : 30,
        },
      };
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "not_found" };
}

export type ScheduleConflictRow = {
  id: string;
  date: string;
  time: string;
  room: number;
  durationSlots: number;
  periodMinutes: number;
};

export type ListScheduleRowsForConflictOutcome =
  | { kind: "ok"; rows: ScheduleConflictRow[] }
  | { kind: "missing_schedule" }
  | { kind: "read_error" };

/** Lists active rows in a date range for overlap checks (no PHI columns read). */
export async function listScheduleRowsForConflictCheck(
  dataRoot: DataRootSet,
  fromIso: string,
  toIso: string,
): Promise<ListScheduleRowsForConflictOutcome> {
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

  const rows: ScheduleConflictRow[] = [];
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const date = formatRowDate(rec.DATE);
      if (date === null || date < fromIso || date > toIso) continue;
      const period = Math.trunc(num(rec, "PERIOD"));
      rows.push({
        id: strId(rec, "ID"),
        date,
        time: String(rec.TIME ?? "").trim(),
        room: Math.trunc(num(rec, "ROOM")),
        durationSlots: Math.trunc(num(rec, "DURATION", 1)),
        periodMinutes: period > 0 ? period : 30,
      });
    }
  } catch {
    return { kind: "read_error" };
  }

  return { kind: "ok", rows };
}
