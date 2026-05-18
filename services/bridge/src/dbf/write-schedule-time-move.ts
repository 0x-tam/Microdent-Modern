import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import {
  encodeCharField,
  encodeDbf8CharDateField,
  encodeNumericField,
  fieldByteOffset,
  fieldSize,
  touchDbfLastUpdate,
} from "./dbf-record-write-helpers.js";
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

export type WriteScheduleTimeMoveInput = {
  date: string;
  time: string;
  room: number;
  durationSlots?: number;
};

export type WriteScheduleTimeMoveOutcome =
  | { kind: "ok" }
  | { kind: "missing_schedule" }
  | { kind: "not_found" }
  | { kind: "read_error" }
  | { kind: "write_error" };

/**
 * Updates `DATE`, `TIME`, `ROOM`, and optionally `DURATION` on one SCHEDULE row.
 * Does not touch COMMENT, PAT_NAME, TELEPHONE, or CASENUM.
 */
export async function writeScheduleAppointmentTimeMove(
  dataRoot: DataRootSet,
  appointmentId: string,
  input: WriteScheduleTimeMoveInput,
): Promise<WriteScheduleTimeMoveOutcome> {
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

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const recordLength = dbf._recordLength;
  const headerLength = dbf._headerLength;
  const dateOffset = fieldByteOffset(dbf.fields, "DATE");
  const timeOffset = fieldByteOffset(dbf.fields, "TIME");
  const roomOffset = fieldByteOffset(dbf.fields, "ROOM");
  const durationOffset = fieldByteOffset(dbf.fields, "DURATION");

  let physicalIndex = 0;
  let targetRecordOffset: number | null = null;

  try {
    for await (const row of dbf) {
      const rec = row as Record<string, unknown>;
      if (!row[DELETED] && strId(rec, "ID") === appointmentId) {
        targetRecordOffset = headerLength + physicalIndex * recordLength;
        break;
      }
      physicalIndex += 1;
    }
  } catch {
    return { kind: "read_error" };
  }

  if (targetRecordOffset === null) {
    return { kind: "not_found" };
  }

  const patches: { offset: number; buf: Buffer }[] = [
    {
      offset: targetRecordOffset + dateOffset,
      buf: encodeDbf8CharDateField(input.date, fieldSize(dbf, "DATE")),
    },
    {
      offset: targetRecordOffset + timeOffset,
      buf: encodeCharField(normalizedTime, fieldSize(dbf, "TIME")),
    },
    {
      offset: targetRecordOffset + roomOffset,
      buf: encodeNumericField(input.room, fieldSize(dbf, "ROOM")),
    },
  ];

  if (input.durationSlots !== undefined) {
    patches.push({
      offset: targetRecordOffset + durationOffset,
      buf: encodeNumericField(input.durationSlots, fieldSize(dbf, "DURATION")),
    });
  }

  try {
    const fh = await open(abs, "r+");
    try {
      for (const patch of patches) {
        await fh.write(patch.buf, 0, patch.buf.length, patch.offset);
      }
      await touchDbfLastUpdate(abs);
    } finally {
      await fh.close();
    }
  } catch {
    return { kind: "write_error" };
  }

  return { kind: "ok" };
}
