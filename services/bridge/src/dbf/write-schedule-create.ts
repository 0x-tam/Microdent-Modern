import { existsSync } from "node:fs";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import { touchDbfLastUpdate } from "./dbf-record-write-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";
import { normalizeScheduleTimeHm } from "../schedule/schedule-time-utils.js";

const SCHEDULE_DBF = "SCHEDULE.DBF";
const OPEN_OPTIONS = {
  encoding: "win1252" as const,
  readMode: "loose" as const,
  includeDeletedRecords: true,
};

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

export type WriteScheduleCreateInput = {
  date: string;
  time: string;
  room: number;
  durationSlots: number;
  patId: string;
  docId: number;
  procClass: number;
  periodMinutes: number;
  status: number;
};

export type WriteScheduleCreateOutcome =
  | { kind: "ok"; appointmentId: string }
  | { kind: "missing_schedule" }
  | { kind: "read_error" }
  | { kind: "write_error" };

async function allocateNextScheduleId(dataRoot: DataRootSet): Promise<string | null> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SCHEDULE_DBF);
  } catch {
    return null;
  }
  if (!existsSync(abs)) return null;

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return null;
  }

  let maxId = 0;
  try {
    for await (const row of dbf) {
      if (row[DELETED]) continue;
      const rec = row as Record<string, unknown>;
      const id = Math.trunc(num(rec, "ID"));
      if (id > maxId) maxId = id;
    }
  } catch {
    return null;
  }

  return String(maxId + 1);
}

/**
 * Appends a SCHEDULE row without writing blocked PHI columns (left empty/default).
 */
export async function writeScheduleAppointmentCreate(
  dataRoot: DataRootSet,
  input: WriteScheduleCreateInput,
): Promise<WriteScheduleCreateOutcome> {
  const normalizedTime = normalizeScheduleTimeHm(input.time);
  if (normalizedTime === null) {
    return { kind: "write_error" };
  }

  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, SCHEDULE_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_schedule" };
  }

  const nextId = await allocateNextScheduleId(dataRoot);
  if (nextId === null) {
    return { kind: "read_error" };
  }

  const dateParts = input.date.split("-").map((x) => Number(x));
  const dateValue = new Date(Date.UTC(dateParts[0]!, dateParts[1]! - 1, dateParts[2]!));

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  try {
    await dbf.appendRecords([
      {
        ID: Number(nextId),
        DATE: dateValue,
        TIME: normalizedTime,
        DURATION: input.durationSlots,
        ROOM: input.room,
        COMMENT: "",
        PROC_CLASS: input.procClass,
        PAT_ID: Number(input.patId),
        PAT_NAME: "",
        DOC_ID: input.docId,
        PERIOD: input.periodMinutes,
        TELEPHONE: "",
        STATUS: input.status,
        CASENUM: "",
        VAC_ID: 0,
        RECALL: 0,
        UNREASON: 0,
        MISSED: false,
      },
    ]);
    await touchDbfLastUpdate(abs);
  } catch {
    return { kind: "write_error" };
  }

  return { kind: "ok", appointmentId: nextId };
}
