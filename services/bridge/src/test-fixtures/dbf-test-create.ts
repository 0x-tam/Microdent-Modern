import { open } from "node:fs/promises";
import { DBFFile, type FieldDescriptor } from "dbffile";

/** Creates an empty VFP-style DBF (including memo field descriptors) for bridge tests. */
export async function createTestDbf(path: string, fields: FieldDescriptor[]): Promise<DBFFile> {
  const fileVersion = 0x30;
  const fd = await open(path, "wx");
  try {
    const buffer = Buffer.alloc(32);
    buffer.writeUInt8(fileVersion, 0x00);
    const now = new Date();
    buffer.writeUInt8(now.getFullYear() - 1900, 0x01);
    buffer.writeUInt8(now.getMonth() + 1, 0x02);
    buffer.writeUInt8(now.getDate(), 0x03);
    buffer.writeInt32LE(0, 0x04);
    const headerLength = 34 + fields.length * 32;
    buffer.writeUInt16LE(headerLength, 0x08);
    const recordLength = 1 + fields.reduce((sum, f) => sum + f.size, 0);
    buffer.writeUInt16LE(recordLength, 0x0a);
    await fd.write(buffer, 0, 32, 0);

    for (let i = 0; i < fields.length; i++) {
      const { name, type, size, decimalPlaces } = fields[i]!;
      const desc = Buffer.alloc(32, 0);
      desc.write(name, 0, Math.min(name.length, 10), "latin1");
      desc.writeUInt8(type.charCodeAt(0), 0x0b);
      desc.writeUInt8(size, 0x10);
      desc.writeUInt8(decimalPlaces ?? 0, 0x11);
      desc.writeUInt8(0x01, 0x14);
      await fd.write(desc, 0, 32, 32 + i * 32);
    }

    const terminator = Buffer.from([0x0d, 0x00, 0x1a]);
    await fd.write(terminator, 0, 3, 32 + fields.length * 32);
  } finally {
    await fd.close();
  }

  return DBFFile.open(path, {
    encoding: "win1252",
    readMode: "loose",
    includeDeletedRecords: true,
  });
}
