import { existsSync } from "node:fs";
import { DBFFile, DELETED, type FieldDescriptor } from "dbffile";
import type { DataRootSet } from "../config.js";
import {
  appendDbfRecordBuffer,
  buildBlankDbfRecordBuffer,
  encodeCharField,
  encodeDbf8CharDateField,
  encodeLogicalField,
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

const ALLOWLISTED_FIELD_NAMES = new Set([
  "ID",
  "DATE",
  "TIME",
  "DURATION",
  "ROOM",
  "PAT_ID",
  "DOC_ID",
  "PERIOD",
  "STATUS",
  "PROC_CLASS",
  "VAC_ID",
  "RECALL",
  "UNREASON",
  "MISSED",
]);

const BLOCKED_PHI_CHAR_FIELD_NAMES = new Set(["PAT_NAME", "TELEPHONE", "CASENUM"]);

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

function hasMemoFields(fields: FieldDescriptor[]): boolean {
  return fields.some((f) => f.type === "M");
}

function fieldByName(fields: FieldDescriptor[], name: string): FieldDescriptor | undefined {
  return fields.find((f) => f.name === name);
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

function buildAppendRecordsPayload(
  fields: FieldDescriptor[],
  input: WriteScheduleCreateInput,
  nextId: string,
  dateValue: Date,
  normalizedTime: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "M") continue;
    if (ALLOWLISTED_FIELD_NAMES.has(field.name)) {
      switch (field.name) {
        case "ID":
          row.ID = Number(nextId);
          break;
        case "DATE":
          row.DATE = dateValue;
          break;
        case "TIME":
          row.TIME = normalizedTime;
          break;
        case "DURATION":
          row.DURATION = input.durationSlots;
          break;
        case "ROOM":
          row.ROOM = input.room;
          break;
        case "PAT_ID":
          row.PAT_ID = Number(input.patId);
          break;
        case "DOC_ID":
          row.DOC_ID = input.docId;
          break;
        case "PERIOD":
          row.PERIOD = input.periodMinutes;
          break;
        case "STATUS":
          row.STATUS = input.status;
          break;
        case "PROC_CLASS":
          row.PROC_CLASS = input.procClass;
          break;
        case "VAC_ID":
          row.VAC_ID = 0;
          break;
        case "RECALL":
          row.RECALL = 0;
          break;
        case "UNREASON":
          row.UNREASON = 0;
          break;
        case "MISSED":
          row.MISSED = false;
          break;
      }
    } else if (BLOCKED_PHI_CHAR_FIELD_NAMES.has(field.name) && field.type === "C") {
      row[field.name] = "";
    }
  }
  return row;
}

function writeFieldToRecordBuffer(
  buf: Buffer,
  fields: FieldDescriptor[],
  fieldName: string,
  patch: Buffer,
): void {
  if (!fieldByName(fields, fieldName)) return;
  patch.copy(buf, fieldByteOffset(fields, fieldName));
}

async function appendScheduleRowBytes(
  abs: string,
  dbf: DBFFile,
  input: WriteScheduleCreateInput,
  nextId: string,
  normalizedTime: string,
): Promise<void> {
  const buf = buildBlankDbfRecordBuffer(dbf.fields, dbf._recordLength);
  writeFieldToRecordBuffer(buf, dbf.fields, "ID", encodeNumericField(Number(nextId), fieldSize(dbf, "ID")));
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "DATE",
    encodeDbf8CharDateField(input.date, fieldSize(dbf, "DATE")),
  );
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "TIME",
    encodeCharField(normalizedTime, fieldSize(dbf, "TIME")),
  );
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "DURATION",
    encodeNumericField(input.durationSlots, fieldSize(dbf, "DURATION")),
  );
  writeFieldToRecordBuffer(buf, dbf.fields, "ROOM", encodeNumericField(input.room, fieldSize(dbf, "ROOM")));
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "PAT_ID",
    encodeNumericField(Number(input.patId), fieldSize(dbf, "PAT_ID")),
  );
  writeFieldToRecordBuffer(buf, dbf.fields, "DOC_ID", encodeNumericField(input.docId, fieldSize(dbf, "DOC_ID")));
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "PERIOD",
    encodeNumericField(input.periodMinutes, fieldSize(dbf, "PERIOD")),
  );
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "STATUS",
    encodeNumericField(input.status, fieldSize(dbf, "STATUS")),
  );
  writeFieldToRecordBuffer(
    buf,
    dbf.fields,
    "PROC_CLASS",
    encodeNumericField(input.procClass, fieldSize(dbf, "PROC_CLASS")),
  );
  writeFieldToRecordBuffer(buf, dbf.fields, "VAC_ID", encodeNumericField(0, fieldSize(dbf, "VAC_ID")));
  writeFieldToRecordBuffer(buf, dbf.fields, "RECALL", encodeNumericField(0, fieldSize(dbf, "RECALL")));
  writeFieldToRecordBuffer(buf, dbf.fields, "UNREASON", encodeNumericField(0, fieldSize(dbf, "UNREASON")));
  if (fieldByName(dbf.fields, "MISSED")) {
    writeFieldToRecordBuffer(buf, dbf.fields, "MISSED", encodeLogicalField(false));
  }
  for (const name of BLOCKED_PHI_CHAR_FIELD_NAMES) {
    const field = fieldByName(dbf.fields, name);
    if (field?.type === "C") {
      writeFieldToRecordBuffer(buf, dbf.fields, name, encodeCharField("", field.size));
    }
  }
  await appendDbfRecordBuffer(abs, dbf, buf);
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

  const memoPresent = hasMemoFields(dbf.fields);

  try {
    if (!memoPresent) {
      try {
        await dbf.appendRecords([
          buildAppendRecordsPayload(dbf.fields, input, nextId, dateValue, normalizedTime),
        ]);
        await touchDbfLastUpdate(abs);
        return { kind: "ok", appointmentId: nextId };
      } catch {
        // Fall through to byte-level append (e.g. unsupported column types).
      }
    }
    await appendScheduleRowBytes(abs, dbf, input, nextId, normalizedTime);
    await touchDbfLastUpdate(abs);
  } catch {
    return { kind: "write_error" };
  }

  return { kind: "ok", appointmentId: nextId };
}
