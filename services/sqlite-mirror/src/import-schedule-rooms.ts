import { applyMigrations } from "./apply-migrations.js";
import {
  beginImportRun,
  finishImportRun,
  fingerprintSourceFiles,
  recordImportError,
  recordSourceFileSnapshots,
  snapshotSourceFiles,
} from "./import-run.js";
import type { ScheduleRoomItem } from "@microdent/contracts";
import { openDatabaseSync, type SqliteDatabase } from "./node-sqlite.js";
import { parseDataRootFromValue, readScheduleRooms } from "@microdent/bridge/import-source";

const SOURCE_TABLE = "schedule_rooms";
const SOURCE_FILES = ["SC_ROOM.DBF", "DICSCHED.DBF"] as const;

export type ImportScheduleRoomsOptions = {
  dataRoot: string;
  sqlitePath: string;
  trigger?: "cli" | "manual" | "scheduled";
};

export type ImportScheduleRoomsResult = {
  runId: number;
  status: "success" | "partial" | "failed";
  rowCount: number;
  errorCount: number;
};

function roomLabel(room: ScheduleRoomItem): string {
  if (room.displayName !== null && room.displayName.length > 0) {
    return room.displayName;
  }
  return `Room ${room.room}`;
}

function writeScheduleRooms(db: SqliteDatabase, rooms: ScheduleRoomItem[]): number {
  const importedAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO schedule_rooms (room_id, label, imported_at) VALUES (?, ?, ?)`,
  );

  db.exec("DELETE FROM schedule_rooms;");
  for (const room of rooms) {
    insert.run(String(room.room), roomLabel(room), importedAt);
  }
  return rooms.length;
}

/**
 * Imports schedule room ids and display labels from `SC_ROOM.DBF` (+ optional `DICSCHED.DBF` labels).
 * Does not store patient content, phones, or raw DBF rows.
 */
export async function importScheduleRooms(
  options: ImportScheduleRoomsOptions,
): Promise<ImportScheduleRoomsResult> {
  const { dataRoot, sqlitePath, trigger = "cli" } = options;

  applyMigrations(sqlitePath);

  const dataRootConfig = parseDataRootFromValue(dataRoot);
  const fingerprint = fingerprintSourceFiles(dataRoot, [...SOURCE_FILES]);

  const db = openDatabaseSync(sqlitePath);
  try {
    const runId = beginImportRun(db, {
      trigger,
      tablesRequested: [SOURCE_TABLE],
      dataRootFingerprint: fingerprint,
    });
    recordSourceFileSnapshots(db, runId, snapshotSourceFiles(dataRoot, SOURCE_TABLE, SOURCE_FILES));

    if (!dataRootConfig.configured) {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILES[0],
        errorCode: "DATA_ROOT_INVALID",
        message: "dataRoot must be a non-empty absolute path",
      });
      finishImportRun(db, runId, { status: "failed", notes: "invalid data root" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    const outcome = await readScheduleRooms(dataRootConfig);

    if (outcome.kind === "missing_sc_room") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILES[0],
        errorCode: "SC_ROOM_DBF_NOT_FOUND",
        message: "SC_ROOM.DBF not found under data root",
      });
      finishImportRun(db, runId, { status: "failed", notes: "source file missing" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    if (outcome.kind === "read_error") {
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILES[0],
        errorCode: "SCHEDULE_ROOMS_READ_ERROR",
        message: "failed to read schedule room configuration",
      });
      finishImportRun(db, runId, { status: "failed", notes: "read failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }

    db.exec("BEGIN IMMEDIATE;");
    try {
      const rowCount = writeScheduleRooms(db, outcome.rooms);
      db.exec("COMMIT;");
      finishImportRun(db, runId, {
        status: "success",
        tablesSucceeded: [SOURCE_TABLE],
        rowCounts: { schedule_rooms: rowCount },
      });
      return { runId, status: "success", rowCount, errorCount: 0 };
    } catch {
      db.exec("ROLLBACK;");
      recordImportError(db, runId, {
        sourceTable: SOURCE_TABLE,
        sourceFile: SOURCE_FILES[0],
        errorCode: "SQLITE_WRITE_ERROR",
        message: "sqlite transaction failed during schedule room import",
      });
      finishImportRun(db, runId, { status: "failed", notes: "transaction failed" });
      return { runId, status: "failed", rowCount: 0, errorCount: 1 };
    }
  } finally {
    db.close();
  }
}
