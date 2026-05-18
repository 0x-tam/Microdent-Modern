import { open } from "node:fs/promises";
import type { DBFFile, FieldDescriptor } from "dbffile";

export function fieldByteOffset(fields: { name: string; size: number }[], fieldName: string): number {
  let offset = 1;
  for (const field of fields) {
    if (field.name === fieldName) {
      return offset;
    }
    offset += field.size;
  }
  throw new Error(`field not found: ${fieldName}`);
}

export function encodeNumericField(value: number, size: number): Buffer {
  let text = String(Math.trunc(value));
  if (text.length > size) {
    text = text.slice(-size);
  }
  const buf = Buffer.alloc(size, 0x20);
  const start = size - text.length;
  buf.write(text, start, text.length, "latin1");
  return buf;
}

export function encodeCharField(value: string, size: number): Buffer {
  const buf = Buffer.alloc(size, 0x20);
  const text = value.length > size ? value.slice(0, size) : value;
  buf.write(text, 0, text.length, "latin1");
  return buf;
}

/** FoxPro `D` field: YY MM DD from UTC calendar components. */
export function encodeFoxProDateField(isoDate: string): Buffer {
  const [y, m, d] = isoDate.split("-").map((x) => Number(x));
  return Buffer.from([y - 1900, m, d]);
}

/** dBase/FoxPro `D` field as 8-char `YYYYMMDD` (dbffile read/write shape). */
export function encodeDbf8CharDateField(isoDate: string, size: number): Buffer {
  const [y, m, d] = isoDate.split("-");
  return encodeCharField(`${y}${m!.padStart(2, "0")}${d!.padStart(2, "0")}`, size);
}

export async function touchDbfLastUpdate(absPath: string): Promise<void> {
  const now = new Date();
  const buf = Buffer.from([now.getFullYear() - 1900, now.getMonth() + 1, now.getDate()]);
  const fh = await open(absPath, "r+");
  try {
    await fh.write(buf, 0, 3, 1);
  } finally {
    await fh.close();
  }
}

export function fieldSize(dbf: DBFFile, fieldName: string): number {
  const field = dbf.fields.find((f) => f.name === fieldName);
  if (!field) {
    throw new Error(`field not found: ${fieldName}`);
  }
  return field.size;
}

export function encodeLogicalField(value: boolean): Buffer {
  return Buffer.from([value ? 0x54 : 0x46]);
}

/** Blank active record: spaces, empty memo pointers, logical false. */
export function buildBlankDbfRecordBuffer(fields: FieldDescriptor[], recordLength: number): Buffer {
  const buf = Buffer.alloc(recordLength, 0x20);
  buf[0] = 0x20;
  let offset = 1;
  for (const field of fields) {
    if (field.type === "M") {
      buf.fill(0, offset, offset + field.size);
    } else if (field.type === "L") {
      buf[offset] = 0x46;
    }
    offset += field.size;
  }
  return buf;
}

/**
 * Appends one raw record buffer and updates header record count + EOF marker.
 * Used when dbffile `appendRecords` cannot write memo (M) columns.
 */
export async function appendDbfRecordBuffer(
  absPath: string,
  dbf: DBFFile,
  recordBuffer: Buffer,
): Promise<number> {
  if (recordBuffer.length !== dbf._recordLength) {
    throw new Error("record buffer length mismatch");
  }
  const recordLength = dbf._recordLength;
  const headerLength = dbf._headerLength;
  const recordOffset = headerLength + dbf.recordCount * recordLength;
  const fh = await open(absPath, "r+");
  try {
    await fh.write(recordBuffer, 0, recordLength, recordOffset);
    await fh.write(Buffer.from([0x1a]), 0, 1, recordOffset + recordLength);
    const countBuf = Buffer.alloc(4);
    countBuf.writeInt32LE(dbf.recordCount + 1, 0);
    await fh.write(countBuf, 0, 4, 4);
  } finally {
    await fh.close();
  }
  dbf.recordCount += 1;
  return recordOffset;
}
