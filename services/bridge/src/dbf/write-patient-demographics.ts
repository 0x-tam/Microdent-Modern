import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { DBFFile, DELETED } from "dbffile";
import type { PatientDemographicsUpdateBody } from "@microdent/contracts";
import type { DataRootSet } from "../config.js";
import {
  encodeCharField,
  encodeNumericField,
  fieldByteOffset,
  fieldSize,
  touchDbfLastUpdate,
} from "./dbf-record-write-helpers.js";
import { resolveRegisteredDbfPath } from "./resolve-registered-dbf.js";
import { strIdField } from "./patient-dbf-helpers.js";

const PATIENT_DBF = "PATIENT.DBF";
const OPEN_OPTIONS = {
  encoding: "win1252" as const,
  readMode: "loose" as const,
  includeDeletedRecords: true,
};

export type WritePatientDemographicsOutcome =
  | { kind: "ok"; fieldsWritten: string[] }
  | { kind: "missing_table" }
  | { kind: "not_found" }
  | { kind: "read_error" }
  | { kind: "write_error" };

function logicalBuffer(value: boolean, size: number): Buffer {
  const buf = Buffer.alloc(size, 0x20);
  buf[0] = value ? 0x54 : 0x46;
  return buf;
}

/**
 * Field-level merge on one PATIENT row for allowlisted demographics only.
 */
export async function writePatientDemographics(
  dataRoot: DataRootSet,
  patientId: string,
  body: PatientDemographicsUpdateBody,
): Promise<WritePatientDemographicsOutcome> {
  let abs: string;
  try {
    abs = resolveRegisteredDbfPath(dataRoot, PATIENT_DBF);
  } catch {
    return { kind: "read_error" };
  }
  if (!existsSync(abs)) {
    return { kind: "missing_table" };
  }

  let dbf: DBFFile;
  try {
    dbf = await DBFFile.open(abs, OPEN_OPTIONS);
  } catch {
    return { kind: "read_error" };
  }

  const recordLength = dbf._recordLength;
  const headerLength = dbf._headerLength;
  let physicalIndex = 0;
  let targetRecordOffset: number | null = null;

  try {
    for await (const row of dbf) {
      const rec = row as Record<string, unknown>;
      if (!row[DELETED] && strIdField(rec, "ID") === patientId) {
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

  const patches: { field: string; buf: Buffer }[] = [];
  const fieldsWritten: string[] = [];

  if (body.firstName !== undefined) {
    patches.push({
      field: "FIRST_NAME",
      buf: encodeCharField(body.firstName, fieldSize(dbf, "FIRST_NAME")),
    });
    fieldsWritten.push("FIRST_NAME");
  }
  if (body.lastName !== undefined) {
    patches.push({
      field: "LAST_NAME",
      buf: encodeCharField(body.lastName, fieldSize(dbf, "LAST_NAME")),
    });
    fieldsWritten.push("LAST_NAME");
  }
  if (body.displayName !== undefined) {
    patches.push({
      field: "NAME",
      buf: encodeCharField(body.displayName, fieldSize(dbf, "NAME")),
    });
    fieldsWritten.push("NAME");
  }
  if (body.reverseName !== undefined) {
    patches.push({
      field: "REV_NAME",
      buf: encodeCharField(body.reverseName, fieldSize(dbf, "REV_NAME")),
    });
    fieldsWritten.push("REV_NAME");
  }
  if (body.chartNumber !== undefined) {
    patches.push({
      field: "CASENB",
      buf: encodeCharField(body.chartNumber ?? "", fieldSize(dbf, "CASENB")),
    });
    fieldsWritten.push("CASENB");
  }
  if (body.active !== undefined) {
    patches.push({
      field: "ACTIVE",
      buf: logicalBuffer(body.active, fieldSize(dbf, "ACTIVE")),
    });
    fieldsWritten.push("ACTIVE");
  }
  if (body.doctorId !== undefined) {
    const docNum = body.doctorId === null ? 0 : Number(body.doctorId);
    patches.push({
      field: "DOCTOR_NB",
      buf: encodeNumericField(docNum, fieldSize(dbf, "DOCTOR_NB")),
    });
    fieldsWritten.push("DOCTOR_NB");
  }

  if (patches.length === 0) {
    return { kind: "write_error" };
  }

  try {
    const fh = await open(abs, "r+");
    try {
      for (const patch of patches) {
        const offset = targetRecordOffset + fieldByteOffset(dbf.fields, patch.field);
        await fh.write(patch.buf, 0, patch.buf.length, offset);
      }
      await touchDbfLastUpdate(abs);
    } finally {
      await fh.close();
    }
  } catch {
    return { kind: "write_error" };
  }

  return { kind: "ok", fieldsWritten };
}
