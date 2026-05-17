import { open } from "node:fs/promises";
import type { DBFFile } from "dbffile";

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
