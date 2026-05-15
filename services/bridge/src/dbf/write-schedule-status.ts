import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { DBFFile, DELETED } from "dbffile";
import type { DataRootSet } from "../config.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";

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

function fieldByteOffset(fields: { name: string; size: number }[], fieldName: string): number {
  let offset = 1;
  for (const field of fields) {
    if (field.name === fieldName) {
      return offset;
    }
    offset += field.size;
  }
  throw new Error(`field not found: ${fieldName}`);
}

function encodeNumericField(value: number, size: number): Buffer {
  let text = String(Math.trunc(value));
  if (text.length > size) {
    text = text.slice(-size);
  }
  const buf = Buffer.alloc(size, 0x20);
  const start = size - text.length;
  buf.write(text, start, text.length, "latin1");
  return buf;
}

async function touchDbfLastUpdate(absPath: string): Promise<void> {
  const now = new Date();
  const buf = Buffer.from([
    now.getFullYear() - 1900,
    now.getMonth() + 1,
    now.getDate(),
  ]);
  const fh = await open(absPath, "r+");
  try {
    await fh.write(buf, 0, 3, 1);
  } finally {
    await fh.close();
  }
}

export type WriteScheduleStatusOutcome =
  | { kind: "ok"; previousStatus: number }
  | { kind: "missing_schedule" }
  | { kind: "not_found" }
  | { kind: "read_error" }
  | { kind: "write_error" };

/**
 * Updates only `STATUS` on the matching SCHEDULE row. Does not read or return PHI columns.
 */
export async function writeScheduleAppointmentStatus(
  dataRoot: DataRootSet,
  appointmentId: string,
  newStatus: number,
): Promise<WriteScheduleStatusOutcome> {
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

  const statusOffset = fieldByteOffset(dbf.fields, "STATUS");
  const idOffset = fieldByteOffset(dbf.fields, "ID");
  const recordLength = dbf._recordLength;
  const headerLength = dbf._headerLength;

  let physicalIndex = 0;
  let targetRecordOffset: number | null = null;
  let previousStatus = 0;

  try {
    for await (const row of dbf) {
      const rec = row as Record<string, unknown>;
      if (!row[DELETED] && strId(rec, "ID") === appointmentId) {
        targetRecordOffset = headerLength + physicalIndex * recordLength;
        previousStatus = Math.trunc(num(rec, "STATUS"));
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

  const statusBuf = encodeNumericField(newStatus, dbf.fields.find((f) => f.name === "STATUS")!.size);
  const writeOffset = targetRecordOffset + statusOffset;

  try {
    const fh = await open(abs, "r+");
    try {
      await fh.write(statusBuf, 0, statusBuf.length, writeOffset);
      await touchDbfLastUpdate(abs);
    } finally {
      await fh.close();
    }
  } catch {
    return { kind: "write_error" };
  }

  // Sanity: ID at same record still matches (STATUS-only write).
  try {
    const idBuf = Buffer.alloc(dbf.fields.find((f) => f.name === "ID")!.size);
    const fh = await open(abs, "r");
    try {
      await fh.read(idBuf, 0, idBuf.length, targetRecordOffset + idOffset);
    } finally {
      await fh.close();
    }
    const idText = idBuf.toString("latin1").trim();
    if (idText !== appointmentId && String(Number(idText)) !== appointmentId) {
      return { kind: "write_error" };
    }
  } catch {
    return { kind: "write_error" };
  }

  return { kind: "ok", previousStatus };
}
