import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DBFFile } from "dbffile";
import { importScheduleRooms } from "./import-schedule-rooms.js";
import { openDatabaseSync } from "./node-sqlite.js";

async function writeSyntheticScheduleRoomsFixture(dir: string): Promise<void> {
  const scFields = [
    { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "DAY1", type: "L" as const, size: 1 },
    { name: "DAY2", type: "L" as const, size: 1 },
    { name: "DAY3", type: "L" as const, size: 1 },
    { name: "DAY4", type: "L" as const, size: 1 },
    { name: "DAY5", type: "L" as const, size: 1 },
    { name: "DAY6", type: "L" as const, size: 1 },
    { name: "DAY7", type: "L" as const, size: 1 },
    { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
  ];
  const sc = await DBFFile.create(join(dir, "SC_ROOM.DBF"), scFields, {});
  await sc.appendRecords([{ ROOM: 3, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 0 }]);

  const dicFields = [
    { name: "ROOM1", type: "C" as const, size: 30 },
    { name: "ROOM3", type: "C" as const, size: 30 },
  ];
  const dic = await DBFFile.create(join(dir, "DICSCHED.DBF"), dicFields, {});
  await dic.appendRecords([{ ROOM1: "Unused slot", ROOM3: "Synthetic hygiene bay" }]);
}

describe("importScheduleRooms", () => {
  it("imports room id and label only from synthetic SC_ROOM.DBF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-schedule-rooms-import-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      await writeSyntheticScheduleRoomsFixture(dir);
      const result = await importScheduleRooms({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("success");
      expect(result.rowCount).toBe(1);
      expect(result.errorCount).toBe(0);

      const db = openDatabaseSync(sqlitePath, { readOnly: true });
      try {
        const rows = db.prepare("SELECT room_id, label FROM schedule_rooms").all() as Array<{
          room_id: string;
          label: string;
        }>;
        expect(rows).toEqual([{ room_id: "3", label: "Synthetic hygiene bay" }]);
        const dump = JSON.stringify(rows);
        expect(dump).not.toContain("DOCT");
        expect(dump).not.toContain("DAY");
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when SC_ROOM.DBF is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "microdent-schedule-rooms-missing-"));
    const sqlitePath = join(dir, "mirror.sqlite");

    try {
      const result = await importScheduleRooms({ dataRoot: dir, sqlitePath });
      expect(result.status).toBe("failed");
      expect(result.rowCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
